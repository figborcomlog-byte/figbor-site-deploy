#!/usr/bin/env bash
# Configura figbor.com.br com https (CloudFront + ACM + Route53) na conta FIGBOR
set -uo pipefail
DOMAIN=figbor.com.br
WWW=www.figbor.com.br
BUCKET=figbor-site-006096426914
REGION=us-east-2
ORIGIN=${BUCKET}.s3-website-${REGION}.amazonaws.com
CALLER="figbor-$(date +%s)"

echo "############ 1) CLOUDFRONT (teste de bloqueio + cria distribuicao) ############"
cat > /tmp/cf.json <<EOF
{
  "CallerReference": "$CALLER",
  "Comment": "FIGBOR site",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "s3site",
        "DomainName": "$ORIGIN",
        "CustomHeaders": {"Quantity": 0},
        "CustomOriginConfig": {
          "HTTPPort": 80,
          "HTTPSPort": 443,
          "OriginProtocolPolicy": "http-only",
          "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
          "OriginReadTimeout": 30,
          "OriginKeepaliveTimeout": 5
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3site",
    "ViewerProtocolPolicy": "redirect-to-https",
    "Compress": true,
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }
}
EOF

CF_OUT=$(aws cloudfront create-distribution --distribution-config file:///tmp/cf.json 2>&1)
if [ $? -ne 0 ]; then
  echo ">>> CLOUDFRONT_ERRO (provavelmente conta precisa de verificacao):"
  echo "$CF_OUT"
  echo ">>> Parando aqui. Nada de DNS foi criado."
  exit 0
fi
echo "$CF_OUT" > /tmp/cf-out.json
CF_ID=$(python3 -c "import json;print(json.load(open('/tmp/cf-out.json'))['Distribution']['Id'])")
CF_DOMAIN=$(python3 -c "import json;print(json.load(open('/tmp/cf-out.json'))['Distribution']['DomainName'])")
echo ">>> CLOUDFRONT OK  id=$CF_ID  domain=$CF_DOMAIN"

echo "############ 2) ROUTE53 (zona DNS de $DOMAIN) ############"
ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" --output text)
if [ "$ZONE_ID" == "None" ] || [ -z "$ZONE_ID" ]; then
  ZONE_ID=$(aws route53 create-hosted-zone --name "$DOMAIN" --caller-reference "$CALLER" --query 'HostedZone.Id' --output text)
fi
ZONE_ID=${ZONE_ID#/hostedzone/}
echo ">>> ZONE_ID=$ZONE_ID"

echo "############ 3) CERTIFICADO ACM (us-east-1) ############"
CERT_ARN=$(aws acm request-certificate --domain-name "$DOMAIN" --subject-alternative-names "$WWW" --validation-method DNS --region us-east-1 --query CertificateArn --output text)
echo ">>> CERT_ARN=$CERT_ARN"
# espera os registros de validacao aparecerem
for i in $(seq 1 12); do
  aws acm describe-certificate --certificate-arn "$CERT_ARN" --region us-east-1 \
    --query 'Certificate.DomainValidationOptions[].ResourceRecord' --output json > /tmp/val.json
  if grep -q '"Name"' /tmp/val.json; then break; fi
  sleep 3
done
# planta os CNAMEs de validacao na zona (dedupe)
python3 - <<'PY'
import json
recs=json.load(open('/tmp/val.json'))
seen=set(); ch=[]
for r in recs or []:
    n=r['Name']
    if n in seen: continue
    seen.add(n)
    ch.append({"Action":"UPSERT","ResourceRecordSet":{"Name":n,"Type":r['Type'],"TTL":300,"ResourceRecords":[{"Value":r['Value']}]}})
json.dump({"Changes":ch}, open('/tmp/val-batch.json','w'))
print("registros de validacao:", len(ch))
PY
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file:///tmp/val-batch.json >/dev/null
echo ">>> registros de validacao plantados no Route53."

# guarda ids pra proxima etapa
cat > /tmp/figbor-state.txt <<EOF
CF_ID=$CF_ID
CF_DOMAIN=$CF_DOMAIN
CERT_ARN=$CERT_ARN
ZONE_ID=$ZONE_ID
EOF

echo ""
echo "==================== RESUMO ===================="
echo "CloudFront pronto (link temporario https):"
echo "   https://$CF_DOMAIN"
echo ""
echo ">>> SERVIDORES DNS PARA COLAR NO REGISTRO.BR:"
aws route53 get-hosted-zone --id "$ZONE_ID" --query 'DelegationSet.NameServers' --output text | tr '\t' '\n' | sed 's/^/   /'
echo ""
echo "CERT_ARN=$CERT_ARN"
echo "ZONE_ID=$ZONE_ID"
echo "CF_ID=$CF_ID"
echo "================================================"
