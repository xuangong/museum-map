# museum-map on the VM — https://songlines.xianliao.de5.net

A second copy of the Cloudflare site, running on the Azure VM (`ssh -i ~/lab_key.pem xian@20.193.231.97`,
checkout `~/dockers/museum-map`). Same Worker code, run by wrangler's local runtime (workerd) in Docker;
D1 / KV / R2 live in `deploy/vm/state/` on the VM. It is a **one-time copy, not a sync**: stamps made here
stay here, and an import replaces this copy's D1 completely.

| Piece | Where |
|---|---|
| Container | `museum-map-web-1`, host port 8082 → 8787 |
| Secrets | `deploy/vm/.env.vm` on the VM (600, not in git; see `.env.vm.example`), mounted as `.dev.vars` |
| Domain / TLS | trojan container (repo `~/dockers/trojan`): SNI `songlines.xianliao.de5.net` → 8449 → `host.docker.internal:8082`; Let's Encrypt cert renews with the others |
| DNS | Cloudflare `A songlines → 20.193.231.97`, DNS only (grey cloud) |

## Update code

```sh
ssh -i ~/lab_key.pem xian@20.193.231.97
cd ~/dockers/museum-map && git pull --ff-only
docker compose -f deploy/vm/docker-compose.yml up -d --build
```

## Refresh data from Cloudflare (overwrites the VM's D1, incl. its users/stamps)

```sh
# on the Mac
bunx wrangler d1 export museum-map-db --remote --output .tmp/d1.sql
scp -i ~/lab_key.pem .tmp/d1.sql xian@20.193.231.97:dockers/museum-map/deploy/vm/import/d1.sql
# on the VM
cd ~/dockers/museum-map/deploy/vm && ./import.sh
```

`import.sh` loads the SQL, then pulls every `/img/<key>` the data references from the live site into local R2.
