// Build-time helper: resolve wrangler.toml into the small JSON that serve.mjs needs at runtime,
// so the production process doesn't have to load wrangler itself.
//   node deploy/vm/read-config.mjs wrangler.toml dist/runtime.json
import { writeFileSync } from "node:fs"
import { unstable_readConfig } from "wrangler"

const [configPath = "wrangler.toml", out = "dist/runtime.json"] = process.argv.slice(2)
const c = unstable_readConfig({ config: configPath })
const runtime = {
  name: c.name,
  compatibilityDate: c.compatibility_date,
  compatibilityFlags: c.compatibility_flags ?? [],
  vars: c.vars ?? {},
  // Same id rules as wrangler dev (buildMiniflareBindingOptions): D1 -> database_id, KV -> id, R2 -> bucket_name.
  d1: Object.fromEntries(c.d1_databases.map((d) => [d.binding, d.preview_database_id ?? d.database_id])),
  kv: Object.fromEntries(c.kv_namespaces.map((k) => [k.binding, k.id])),
  r2: Object.fromEntries(c.r2_buckets.map((r) => [r.binding, r.bucket_name])),
}
writeFileSync(out, JSON.stringify(runtime, null, 2) + "\n")
console.log(`wrote ${out}`)
