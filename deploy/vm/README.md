# museum-map on the VM — https://museum.xianliao.de5.net

**Since 2026-11-18 this is the production site.** `museum.xianliao.de5.net` was detached from the Cloudflare
Worker and now points at the Azure VM (`ssh -i ~/lab_key.pem xian@20.193.231.97`, checkout
`~/dockers/museum-map`). Same Worker code, run by wrangler's local runtime (workerd) in Docker; D1 / KV / R2
live in `deploy/vm/state/` on the VM — **that directory holds the real user data** (accounts, stamps).

The Cloudflare Worker still exists (`museum-preview.xianliao.de5.net`, `*.workers.dev`) with its own, now
stale, D1. `bunx wrangler deploy` updates only that — not the production site.

| Piece | Where |
|---|---|
| Container | `museum-map-web-1`, host port 8082 → 8787 |
| Secrets | `deploy/vm/.env.vm` on the VM (600, not in git; see `.env.vm.example`), mounted as `.dev.vars` |
| Domain / TLS | trojan container (repo `~/dockers/trojan`): SNI `museum.xianliao.de5.net` → 8449 → `host.docker.internal:8082`; Let's Encrypt cert renews with the others |
| DNS | Cloudflare `A museum → 20.193.231.97`, DNS only (grey cloud) |

## Update code

```sh
ssh -i ~/lab_key.pem xian@20.193.231.97
cd ~/dockers/museum-map && git pull --ff-only
docker compose -f deploy/vm/docker-compose.yml up -d --build
```

## Back up the data

```sh
# on the VM — the whole local state (D1 + R2 + KV)
sudo tar czf ~/backups/museum-state-$(date +%Y%m%d-%H%M).tgz -C ~/dockers/museum-map/deploy/vm state
```

## (Initial migration only) load data from Cloudflare

**Do not run this any more** — it replaces the VM's D1 with Cloudflare's stale copy and wipes every account
and stamp made since 2026-11-18. Kept for reference / disaster recovery from an export.

```sh
# on the Mac
bunx wrangler d1 export museum-map-db --remote --output .tmp/d1.sql
scp -i ~/lab_key.pem .tmp/d1.sql xian@20.193.231.97:dockers/museum-map/deploy/vm/import/d1.sql
# on the VM
cd ~/dockers/museum-map/deploy/vm && ./import.sh
```

`import.sh` loads the SQL, then pulls every `/img/<key>` the data references from the live site into local R2.
