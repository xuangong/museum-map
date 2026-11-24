// Production launcher: runs the pre-built Worker bundle in Miniflare (workerd) without wrangler dev's
// file watcher / esbuild rebuilds / live reload / inspector. Reuses wrangler's on-disk layout, so the
// existing state dir (<PERSIST>/v3/{d1,kv,r2,cache}) is read as-is.
//
// Build step (Dockerfile):  bunx wrangler deploy --dry-run --outdir dist && node deploy/vm/read-config.mjs
// Env: PERSIST_DIR (default /data/state), DEV_VARS (default /app/.dev.vars), DIST_DIR (default <repo>/dist),
//      HOST (0.0.0.0), PORT (8787)
import { readFileSync, existsSync } from "node:fs"
import { parseEnv } from "node:util"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Miniflare, Log, LogLevel } from "miniflare"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const distDir = path.resolve(process.env.DIST_DIR ?? path.join(root, "dist"))
const persist = path.resolve(process.env.PERSIST_DIR ?? "/data/state")
const devVarsPath = process.env.DEV_VARS ?? "/app/.dev.vars"
const host = process.env.HOST ?? "0.0.0.0"
const port = Number(process.env.PORT ?? 8787)

const cfg = JSON.parse(readFileSync(path.join(distDir, "runtime.json"), "utf8"))
const secrets = existsSync(devVarsPath) ? parseEnv(readFileSync(devVarsPath, "utf8")) : {}
if (!existsSync(devVarsPath)) console.warn(`warning: ${devVarsPath} not found, starting without secrets`)

const mf = new Miniflare({
  host,
  port,
  // wrangler dev passes `--persist-to X` as defaultPersistRoot = X/v3; each plugin then uses <root>/<d1|kv|r2|cache>.
  defaultPersistRoot: path.join(persist, "v3"),
  log: new Log(LogLevel.WARN),
  liveReload: false,
  verbose: false,
  name: cfg.name,
  // Explicit module list (the bundle is a single ES module; dynamic import specifiers can't be auto-scanned).
  modulesRoot: distDir,
  modules: [{ type: "ESModule", path: path.join(distDir, "index.js") }],
  compatibilityDate: cfg.compatibilityDate,
  compatibilityFlags: cfg.compatibilityFlags,
  bindings: { ...cfg.vars, ...secrets }, // .dev.vars overrides [vars], as in wrangler dev
  d1Databases: cfg.d1,
  kvNamespaces: cfg.kv,
  r2Buckets: cfg.r2,
  // Explicit: persist everything (cache API too) under defaultPersistRoot.
  d1Persist: true,
  kvPersist: true,
  r2Persist: true,
  cachePersist: true,
})

await mf.ready
console.log(`museum-map listening on http://${host}:${port} (state: ${persist}/v3)`)

let stopping = false
async function shutdown(sig) {
  if (stopping) return
  stopping = true
  console.log(`${sig} received, shutting down`)
  const t = setTimeout(() => process.exit(1), 8000)
  t.unref()
  try {
    await mf.dispose()
  } finally {
    process.exit(0)
  }
}
// Miniflare installs its own SIGTERM/SIGINT hooks that kill workerd and process.exit(143) synchronously;
// drop them so shutdown() can dispose() (stop accepting, let workerd flush SQLite) and exit 0.
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.removeAllListeners(sig)
  process.on(sig, () => shutdown(sig))
}
