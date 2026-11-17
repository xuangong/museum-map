#!/usr/bin/env bash
# Load a Cloudflare D1 export + the R2 images it references into the VM's local state.
#   deploy/vm/import.sh            (expects deploy/vm/import/d1.sql, made by `wrangler d1 export --remote`)
# Replaces the local D1 completely; R2 images are fetched from the live site's /img/ route.
set -euo pipefail
cd "$(dirname "$0")"
SRC="${SRC:-https://museum.xianliao.de5.net}"
test -s import/d1.sql || { echo "missing deploy/vm/import/d1.sql"; exit 1; }
C="docker compose -f docker-compose.yml"
W="bunx wrangler"
P="--persist-to /data/state"

echo "==> stop web, reset local D1"
$C stop web
sudo rm -rf state/v3/d1 2>/dev/null || rm -rf state/v3/d1
echo "==> import D1"
$C run --rm --no-deps web $W d1 execute museum-map-db --local $P --file /import/d1.sql >/dev/null
$C run --rm --no-deps web $W d1 execute museum-map-db --local $P --json \
  --command "SELECT (SELECT count(*) FROM museums) museums, (SELECT count(*) FROM dynasties) dynasties, (SELECT count(*) FROM users) users, (SELECT count(*) FROM visits) visits" | grep -E '"(museums|dynasties|users|visits)"'

echo "==> R2 images"
grep -oE '/img/[A-Za-z0-9._-]+' import/d1.sql | sort -u | sed 's#/img/##' > import/keys.txt
echo "    $(wc -l < import/keys.txt) referenced keys"
$C run --rm --no-deps -e SRC="$SRC" web bash -c '
  set -e; mkdir -p /tmp/img; n=0; miss=0
  while read -r k; do
    ct=$(curl -fsS -m 60 -o /tmp/img/$k -w "%{content_type}" "$SRC/img/$k") || { miss=$((miss+1)); echo "    miss $k"; continue; }
    bunx wrangler r2 object put "museum-images/$k" --local --persist-to /data/state --file /tmp/img/$k --content-type "${ct:-image/jpeg}" >/dev/null
    n=$((n+1))
  done < /import/keys.txt
  echo "    stored $n, missing $miss"'
echo "==> start web"
$C up -d web
