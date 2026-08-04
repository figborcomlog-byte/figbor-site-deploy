#!/usr/bin/env bash
# Etapa final: valida cert, anexa no CloudFront e aponta figbor.com.br -> CloudFront
set -uo pipefail
CF_ID=E1E4IBJHHSHV6X
CERT_ARN=arn:aws:acm:us-east-1:006096426914:certificate/dce9710f-227c-44dc-8ecc-cf1ca31ab7ca
ZONE_ID=Z05852723AETQX85YD8RE
CF_DOMAIN=d22agpphscxlam.cloudfront.net
DOMAIN=figbor.com.br
WWW=www.figbor.com.br
CF_ZONE=Z2FDTNDATAQYW2   # hosted zone fixa do CloudFront (para ALIAS)

echo "### 1) status do certificado ACM"
ST=$(aws acm describe-certificate --certificate-arn "$CERT_ARN" --region us-east-1 --query 'Certificate.Status' --output text)
echo "cert status: $ST"
if [ "$ST" != "ISSUED" ]; then
  echo ">>> Certificado ainda NAO validado ($ST) - o DNS provavelmente ainda esta propagando."
  aws acm describe-certificate --certificate-arn "$CERT_ARN" --region us-east-1 \
    --query 'Certificate.DomainValidationOptions[].{dominio:DomainName,status:ValidationStatus}' --output table
  echo ">>> Rode este script de novo daqui a pouco."
  exit 0
fi

echo "### 2) anexando aliases + certificado no CloudFront"
aws cloudfront get-distribution-config --id "$CF_ID" > /tmp/dist.json
ETAG=$(python3 -c "import json;print(json.load(open('/tmp/dist.json'))['ETag'])")
python3 - "$DOMAIN" "$WWW" "$CERT_ARN" <<'PY'
import json,sys
dom,www,cert=sys.argv[1],sys.argv[2],sys.argv[3]
d=json.load(open('/tmp/dist.json'))
c=d['DistributionConfig']
c['Aliases']={"Quantity":2,"Items":[dom,www]}
c['ViewerCertificate']={
  "ACMCertificateArn":cert,
  "SSLSupportMethod":"sni-only",
  "MinimumProtocolVersion":"TLSv1.2_2021"
}
json.dump(c, open('/tmp/dist-config.json','w'))
PY
aws cloudfront update-distribution --id "$CF_ID" --distribution-config file:///tmp/dist-config.json --if-match "$ETAG" >/dev/null \
  && echo ">>> CloudFront atualizado (dominios + https)."

echo "### 3) apontando figbor.com.br e www -> CloudFront (Route53 ALIAS)"
cat > /tmp/dns-batch.json <<EOF
{
  "Changes": [
    {"Action":"UPSERT","ResourceRecordSet":{"Name":"$DOMAIN.","Type":"A","AliasTarget":{"HostedZoneId":"$CF_ZONE","DNSName":"$CF_DOMAIN","EvaluateTargetHealth":false}}},
    {"Action":"UPSERT","ResourceRecordSet":{"Name":"$WWW.","Type":"A","AliasTarget":{"HostedZoneId":"$CF_ZONE","DNSName":"$CF_DOMAIN","EvaluateTargetHealth":false}}}
  ]
}
EOF
aws route53 change-resource-record-sets --hosted-zone-id "$ZONE_ID" --change-batch file:///tmp/dns-batch.json >/dev/null \
  && echo ">>> DNS apontado (apex + www)."

echo ""
echo "=========================================="
echo "PRONTO! Em ~5-15 min (propagacao CloudFront):"
echo "   https://$DOMAIN"
echo "   https://$WWW"
echo "=========================================="
