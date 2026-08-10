#!/usr/bin/env bash
set -e
B=figbor-site-006096426914
REGION=us-east-2

# ---------------------------------------------------------------------------
# CACHE — por que o sync virou quatro passes
#
# Antes era um sync só, sem --cache-control. O S3 então gravava os arquivos SEM
# esse cabeçalho, e sem ele o navegador do celular usa CACHE HEURÍSTICO: inventa
# um prazo de validade de ~10% do tempo desde o Last-Modified. Uma página com um
# mês de vida vira ~3 dias guardados NO APARELHO — e nesse período ele nem
# pergunta ao servidor. Invalidar o CloudFront não alcança esse cache: limpa a
# borda, não o telefone. Era por isso que uma correção publicada podia não
# aparecer no celular de quem já tinha aberto o site.
#
# Agora: HTML sempre revalida (barato: 304 de poucos bytes), a arte da marca é
# cacheada por um ano.
#
# REGRA que passa a valer com "immutable": arte nova = NOME NOVO de arquivo.
# Trocar o conteúdo mantendo o nome não tem conserto para quem já visitou.
# ---------------------------------------------------------------------------
COMUM=(--exclude ".git/*" --exclude "*.sh" --exclude "README*")

echo ">> 1/4 arte da marca (assets/) — cache de 1 ano ..."
aws s3 sync ./assets "s3://$B/assets" --delete \
  --cache-control "public, max-age=31536000, immutable"

echo ">> 2/4 paginas HTML — sempre revalidar ..."
aws s3 sync . "s3://$B" "${COMUM[@]}" \
  --exclude "*" --include "*.html" --exclude "assets/*" \
  --cache-control "no-cache" \
  --content-type "text/html; charset=utf-8"

echo ">> 3/4 css e js (nome fixo) — sempre revalidar ..."
aws s3 sync . "s3://$B" "${COMUM[@]}" \
  --exclude "*" --include "*.css" --include "*.js" --exclude "assets/*" \
  --cache-control "no-cache"

# passe de faxina: os anteriores já subiram tudo, então este NÃO reenvia nada
# (e por isso não apaga os cabeçalhos que acabaram de ser gravados). Ele existe
# só para remover do bucket o que saiu do repositório — é o --delete de antes.
echo ">> 4/4 removendo do bucket o que saiu do repositorio ..."
aws s3 sync . "s3://$B" "${COMUM[@]}" --exclude "assets/*" --delete

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
