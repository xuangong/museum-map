# museum-map on a plain VM: the same Worker, run by wrangler's local runtime (workerd),
# with D1 / KV / R2 persisted to /data. Data comes from the Cloudflare deployment via
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
EXPOSE 8787
# Secrets arrive as /app/.dev.vars (mounted from the server's deploy/vm/.env.vm).
CMD ["bunx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "8787", "--persist-to", "/data/state", "--local-protocol", "http", "--show-interactive-dev-session=false"]
