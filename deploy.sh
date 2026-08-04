#!/usr/bin/env bash
set -e
B=figbor-site-006096426914
REGION=us-east-2

echo ">> sincronizando arquivos para s3://$B ..."
aws s3 sync . "s3://$B" \
  --exclude ".git/*" \
  --exclude "deploy.sh" \
  --exclude "README*" \
  --delete

echo ">> habilitando hospedagem de site estatico ..."
aws s3 website "s3://$B" --index-document index.html --error-document index.html

echo ">> aplicando politica de leitura publica ..."
cat > /tmp/figbor-pol.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$B/*"
    }
  ]
}
EOF
aws s3api put-bucket-policy --bucket "$B" --policy file:///tmp/figbor-pol.json

echo ""
echo "=================================================="
echo "DEPLOY OK"
echo "Site:  http://$B.s3-website-$REGION.amazonaws.com"
echo "HTTPS: https://$B.s3.$REGION.amazonaws.com/index.html"
echo "=================================================="
