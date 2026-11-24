# museum-map on the VM — https://museum.xianliao.de5.net

**Since 2026-11-18 this is the production site.** `museum.xianliao.de5.net` was detached from the Cloudflare
Worker and now points at the Azure VM (`ssh -i ~/lab_key.pem xian@20.193.231.97`, checkout
`~/dockers/museum-map`). Same Worker code, run by Miniflare's local runtime (workerd) in Docker; D1 / KV / R2
live in `deploy/vm/state/` on the VM — **that directory holds the real user data** (accounts, stamps).

The Cloudflare Worker still exists (`museum-preview.xianliao.de5.net`, `*.workers.dev`) with its own, now
stale, D1. `bunx wrangler deploy` updates only that — not the production site.

| Piece | Where |
|---|---|
| Container | `museum-map-web-1`, host port 8082 → 8787 |
| Secrets | `deploy/vm/.env.vm` on the VM (600, not in git; see `.env.vm.example`), mounted as `.dev.vars` |
| Domain / TLS | trojan container (repo `~/dockers/trojan`): SNI `museum.xianliao.de5.net` → 8449 → `host.docker.internal:8082`; Let's Encrypt cert renews with the others |
| DNS | Cloudflare `A museum → 20.193.231.97`, DNS only (grey cloud) |

## How it runs

The image bundles the Worker at build time (`wrangler deploy --dry-run --outdir /app/dist`, plus
`deploy/vm/read-config.mjs` → `dist/runtime.json` with the compat date/flags, `[vars]` and binding ids from
`wrangler.toml`). `CMD ["node", "deploy/vm/serve.mjs"]` then starts Miniflare on `0.0.0.0:8787` with that bundle:
no file watcher, no esbuild rebuilds, no live reload, no inspector, no per-request logging (only warnings/errors).
`SIGTERM` (docker stop) disposes Miniflare cleanly and exits 0.

Persistence is wrangler's layout, reused as-is: `serve.mjs` sets Miniflare's `defaultPersistRoot` to
`/data/state/v3` (exactly what `wrangler dev --persist-to /data/state` does), so it reads
`state/v3/{d1,kv,r2,cache}`. Local object names match wrangler dev's: D1 = `database_id`, KV = namespace `id`,
R2 = `bucket_name`. After the first start on the VM, sanity-check that no *new* empty stores appeared:
`ls state/v3/d1/miniflare-D1DatabaseObject state/v3/kv state/v3/r2` should show the old
`<hash>.sqlite` files and the `b7144b61…` / `museum-images` blob dirs only, and the site should still show the
existing accounts. Secrets: `/app/.dev.vars` (dotenv) overrides `[vars]`.

Env overrides (optional): `PERSIST_DIR` (`/data/state`), `DEV_VARS` (`/app/.dev.vars`), `DIST_DIR`, `HOST`, `PORT`.

## Memory limit, autoheal, checking memory

`docker-compose.yml` sets `mem_limit: 2g` and `labels: ["autoheal=true"]`. If workerd leaks, the kernel
OOM-kills the container and `restart: always` brings it back; if it merely hangs, the healthcheck (curl `/`)
goes unhealthy and the autoheal container restarts it. Check usage with:

```sh
docker stats --no-stream museum-map-web-1      # MEM USAGE / LIMIT (node launcher ~170 MB + workerd, rough)
docker inspect -f '{{.State.Health.Status}} {{.RestartCount}}' museum-map-web-1
```

## Rollback to `wrangler dev`

The old command is kept (commented) at the bottom of `deploy/vm/Dockerfile`. To roll back, either
`git revert` the launcher commit, or swap the `CMD` for the commented wrangler line and
`docker compose -f deploy/vm/docker-compose.yml up -d --build`. Same state dir, same secrets, no data migration
either way. (wrangler dev is a dev server and hit a V8 heap OOM after ~3.5 days, hence the launcher.)

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
