# museum-map on a plain VM: the same Worker, bundled at build time and run by Miniflare (workerd) via
# deploy/vm/serve.mjs, with D1 / KV / R2 persisted to /data/state (wrangler's v3 layout). Data comes from the Cloudflare deployment via
# deploy/vm/import.sh — see deploy/vm/README.md.
FROM oven/bun:1-debian
WORKDIR /app
# wrangler wants Node; bun runs the install.
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
ENV WRANGLER_SEND_METRICS=false CI=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Bundle the Worker once at build time (no network/auth needed for --dry-run) + resolve wrangler.toml to dist/runtime.json.
RUN bunx wrangler deploy --dry-run --outdir /app/dist && node deploy/vm/read-config.mjs wrangler.toml /app/dist/runtime.json
EXPOSE 8787
# Secrets arrive as /app/.dev.vars (mounted from the server's deploy/vm/.env.vm).
CMD ["node", "deploy/vm/serve.mjs"]
# Fallback (dev server: file watcher + rebuilds, leaks heap over days) -- swap in to roll back, see deploy/vm/README.md:
# CMD ["bunx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787", "--persist-to", "/data/state", "--local-protocol", "http", "--show-interactive-dev-session=false"]
