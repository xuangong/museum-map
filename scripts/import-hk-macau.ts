#!/usr/bin/env bun
// One-off additive import for the three HK/Macau museums.
// Emits INSERT-only SQL (no DELETE) so remote user data — visits in particular — is untouched.
// Usage: bun run scripts/import-hk-macau.ts [--target=local] [--confirm]
import { $ } from "bun"
import YAML from "yaml"

const TARGET = process.argv.includes("--target=local") ? "local" : "remote"
const CONFIRM = process.argv.includes("--confirm")
const MUSEUM_IDS = ["hk-history", "macau-museum", "poly-mgm"]
const DYNASTY_IDS = ["eastern-han", "ming", "neolithic", "qing", "tang", "western-han"]
const SQL_OUT = ".tmp/import-hk-macau.sql"

function sql(v: unknown): string {
  if (v === null || v === undefined) return "NULL"
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL"
  return "'" + String(v).replace(/'/g, "''") + "'"
}

const readYaml = async <T>(p: string): Promise<T> => YAML.parse(await Bun.file(p).text()) as T

const lines: string[] = []
const now = Date.now()

for (const id of MUSEUM_IDS) {
  const m = await readYaml<any>(`data/museums/${id}.yaml`)
  lines.push(
    `INSERT INTO museums (id, name, lat, lng, location, level, core_period, specialty, dynasty_coverage, timeline) VALUES (${[
      m.id, m.name, m.lat, m.lng, m.location, m.level, m.core_period, m.specialty, m.dynasty_coverage, m.timeline,
    ].map(sql).join(", ")}) ON CONFLICT(id) DO NOTHING;`,
  )
  m.treasures?.forEach((t: any, i: number) =>
    lines.push(`INSERT INTO museum_treasures (museum_id, order_index, name) VALUES (${sql(id)}, ${i}, ${sql(t.name)}) ON CONFLICT DO NOTHING;`))
  m.halls?.forEach((h: any, i: number) =>
    lines.push(`INSERT INTO museum_halls (museum_id, order_index, name) VALUES (${sql(id)}, ${i}, ${sql(h.name)}) ON CONFLICT DO NOTHING;`))
  m.artifacts?.forEach((a: any, i: number) =>
    lines.push(
      `INSERT INTO museum_artifacts (museum_id, order_index, name, period, description, image_url, image_license, image_attribution) VALUES (${[
        id, i, a.name, a.period, a.description, a.image_url, a.image_license, a.image_attribution,
      ].map(sql).join(", ")}) ON CONFLICT DO NOTHING;`))
  m.dynasty_connections?.forEach((c: any, i: number) =>
    lines.push(`INSERT INTO museum_dynasty_connections (museum_id, order_index, dynasty, description) VALUES (${sql(id)}, ${i}, ${sql(c.dynasty)}, ${sql(c.description)}) ON CONFLICT DO NOTHING;`))
  m.sources?.forEach((s: any, i: number) =>
    lines.push(`INSERT INTO museum_sources (museum_id, order_index, source) VALUES (${sql(id)}, ${i}, ${sql(s.source)}) ON CONFLICT DO NOTHING;`))
}

// Only the recommendations pointing at the new museums; existing rows keep their order_index.
for (const did of DYNASTY_IDS) {
  const d = await readYaml<any>(`data/dynasties/${did}.yaml`)
  d.recommended_museums?.forEach((r: any, i: number) => {
    if (!MUSEUM_IDS.includes(r.museum_id)) return
    lines.push(
      `INSERT INTO dynasty_recommended_museums (dynasty_id, order_index, museum_id, name, location, reason) VALUES (${[
        did, i, r.museum_id, r.name, r.location, r.reason,
      ].map(sql).join(", ")}) ON CONFLICT DO NOTHING;`)
  })
}

const prov = await readYaml<Record<string, any[]>>("data/field-provenance.yaml")
for (const id of MUSEUM_IDS) {
  for (const p of prov[id] ?? []) {
    lines.push(
      `INSERT INTO field_provenance (museum_id, field_path, source_url, authority, recorded_at) VALUES (${[
        id, p.field_path, p.source_url, p.authority, now,
      ].map(sql).join(", ")}) ON CONFLICT DO NOTHING;`)
  }
}

await $`mkdir -p .tmp`
await Bun.write(SQL_OUT, lines.join("\n") + "\n")
console.log(`[import] ${lines.length} statements → ${SQL_OUT} (target=${TARGET})`)

if (!CONFIRM) {
  console.log("[import] dry run. Re-run with --confirm to execute.")
  process.exit(0)
}
await $`bunx wrangler d1 execute museum-map-db ${TARGET === "remote" ? "--remote" : "--local"} --file=${SQL_OUT} --yes`
console.log("[import] done.")
