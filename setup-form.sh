#!/usr/bin/env bash
# Backend do formulario de contato: SES + Lambda + Function URL (conta FIGBOR)
set -uo pipefail
REGION=us-east-2
TO=figborcomlog@gmail.com
FN=figbor-contato
ROLE=figbor-contato-role

echo "### 1) SES: identidade de e-mail (remetente = destinatario)"
aws sesv2 create-email-identity --email-identity "$TO" --region $REGION >/dev/null 2>&1 || echo "(identidade ja existe)"
VST=$(aws sesv2 get-email-identity --email-identity "$TO" --region $REGION --query 'VerifiedForSendingStatus' --output text 2>/dev/null)
echo "SES verificado p/ envio: $VST"

echo "### 2) IAM role da Lambda"
cat > /tmp/trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
aws iam create-role --role-name $ROLE --assume-role-policy-document file:///tmp/trust.json >/dev/null 2>&1 || echo "(role existe)"
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null 2>&1
cat > /tmp/sespol.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ses:SendEmail","ses:SendRawEmail"],"Resource":"*"}]}
EOF
aws iam put-role-policy --role-name $ROLE --policy-name ses-send --policy-document file:///tmp/sespol.json
ROLE_ARN=$(aws iam get-role --role-name $ROLE --query 'Role.Arn' --output text)
echo "ROLE_ARN=$ROLE_ARN"

echo "### 3) codigo da Lambda"
rm -rf /tmp/fn && mkdir -p /tmp/fn
cat > /tmp/fn/lambda_function.py <<'PY'
import json, os, base64, boto3
ses = boto3.client('ses')
TO = os.environ['TO']; FROM = os.environ['FROM']
H = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"content-type","content-type":"application/json"}
def r(c,b): return {"statusCode":c,"headers":H,"body":json.dumps(b)}
def handler(event, ctx):
    method = event.get("requestContext",{}).get("http",{}).get("method","POST")
    if method == "OPTIONS": return r(200,{"ok":True})
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"): body = base64.b64decode(body).decode("utf-8")
    try: d = json.loads(body)
    except Exception: return r(400,{"ok":False,"erro":"json"})
    if d.get("site"): return r(200,{"ok":True})   # honeypot anti-spam
    nome=(d.get("nome") or "").strip(); email=(d.get("email") or "").strip()
    if not nome or not email: return r(400,{"ok":False,"erro":"campos"})
    campos=[("Nome",nome),("Empresa",d.get("empresa")),("E-mail",email),("Telefone",d.get("telefone")),("Onde doi",d.get("area")),("Mensagem",d.get("mensagem"))]
    txt="Novo contato pelo site figbor.com.br\n\n"+"\n".join(f"{k}: {v}" for k,v in campos if v)+"\n"
    msg={"Source":FROM,"Destination":{"ToAddresses":[TO]},"Message":{"Subject":{"Data":f"[FIGBOR] Diagnostico - {nome}"},"Body":{"Text":{"Data":txt}}}}
    if "@" in email: msg["ReplyToAddresses"]=[email]
    try: ses.send_email(**msg)
    except Exception as e:
        print("SES erro:",repr(e)); return r(502,{"ok":False,"erro":"envio"})
    return r(200,{"ok":True})
PY
cd /tmp/fn && zip -q fn.zip lambda_function.py

echo "### 4) cria/atualiza a Lambda"
if aws lambda get-function --function-name $FN --region $REGION >/dev/null 2>&1; then
  aws lambda update-function-code --function-name $FN --zip-file fileb:///tmp/fn/fn.zip --region $REGION >/dev/null
  aws lambda wait function-updated --function-name $FN --region $REGION
  aws lambda update-function-configuration --function-name $FN --environment "Variables={TO=$TO,FROM=$TO}" --timeout 15 --region $REGION >/dev/null
else
  for i in 1 2 3 4 5 6; do
    if aws lambda create-function --function-name $FN --runtime python3.12 --handler lambda_function.handler --role "$ROLE_ARN" --zip-file fileb:///tmp/fn/fn.zip --timeout 15 --environment "Variables={TO=$TO,FROM=$TO}" --region $REGION >/dev/null 2>/tmp/lerr; then break; fi
    echo "  aguardando propagacao do role... ($i)"; sleep 8
  done
fi
aws lambda wait function-active --function-name $FN --region $REGION 2>/dev/null || true

echo "### 5) Function URL + CORS + permissao publica"
aws lambda create-function-url-config --function-name $FN --auth-type NONE --region $REGION \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}' >/dev/null 2>&1 \
  || aws lambda update-function-url-config --function-name $FN --auth-type NONE --region $REGION \
  --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["content-type"]}' >/dev/null
aws lambda add-permission --function-name $FN --statement-id public-url --action lambda:InvokeFunctionUrl --principal '*' --function-url-auth-type NONE --region $REGION >/dev/null 2>&1 || echo "(permissao ja existe)"
FURL=$(aws lambda get-function-url-config --function-name $FN --query 'FunctionUrl' --output text --region $REGION)

echo ""
echo "=================================================="
echo "FUNCTION_URL=$FURL"
echo "SES verificado: $(aws sesv2 get-email-identity --email-identity "$TO" --region $REGION --query 'VerifiedForSendingStatus' --output text 2>/dev/null)"
echo ">>> Se 'false': clique no e-mail de verificacao da AWS que chegou em $TO."
echo "=================================================="
