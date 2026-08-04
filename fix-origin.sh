#!/usr/bin/env bash
# Corrige a origem do CloudFront para o endpoint de website correto (us-east-2 usa PONTO)
set -uo pipefail
CF_ID=E1E4IBJHHSHV6X
NEW_ORIGIN=figbor-site-006096426914.s3-website.us-east-2.amazonaws.com
aws cloudfront get-distribution-config --id "$CF_ID" > /tmp/dist.json
ETAG=$(python3 -c "import json;print(json.load(open('/tmp/dist.json'))['ETag'])")
python3 - "$NEW_ORIGIN" <<'PY'
import json,sys
newo=sys.argv[1]
d=json.load(open('/tmp/dist.json'))
c=d['DistributionConfig']
c['Origins']['Items'][0]['DomainName']=newo
json.dump(c, open('/tmp/dist-config.json','w'))
PY
aws cloudfront update-distribution --id "$CF_ID" --distribution-config file:///tmp/dist-config.json --if-match "$ETAG" >/dev/null \
  && echo ">>> ORIGEM corrigida para: $NEW_ORIGIN (CloudFront vai redeployar ~5-15 min)"
