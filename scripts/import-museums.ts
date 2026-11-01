#!/usr/bin/env bun
// Additive import for newly added museums in data/museums/<id>.yaml.
// Emits INSERT-only SQL (no DELETE) so remote user data — visits in particular — is untouched.
// Dynasty recommendations pointing at the given ids are discovered from data/dynasties/*.yaml
// and appended after the dynasty's current last row (order_index is part of the PK, so reusing
// the yaml index could collide with rows added since the last snapshot).
// Usage: bun run scripts/import-museums.ts --ids=a,b [--target=local] [--confirm]
import { $ } from "bun"
import { readdir } from "node:fs/promises"
import YAML from "yaml"

const TARGET = process.argv.includes("--target=local") ? "local" : "remote"
const CONFIRM = process.argv.includes("--confirm")
const MUSEUM_IDS = (process.argv.find((a) => a.startsWith("--ids="))?.slice(6) ?? "").split(",").filter(Boolean)
if (MUSEUM_IDS.length === 0) {
  console.error("usage: bun run scripts/import-museums.ts --ids=a,b [--target=local] [--confirm]")
  process.exit(1)
}
const SQL_OUT = ".tmp/import-museums.sql"

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
  if (m.id !== id) throw new Error(`data/museums/${id}.yaml has id=${m.id}`)
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

const dynastyFiles = (await readdir("data/dynasties")).filter((f) => f.endsWith(".yaml")).sort()
for (const f of dynastyFiles) {
  const d = await readYaml<any>(`data/dynasties/${f}`)
  d.recommended_museums?.forEach((r: any) => {
    if (!MUSEUM_IDS.includes(r.museum_id)) return
    lines.push(
      `INSERT INTO dynasty_recommended_museums (dynasty_id, order_index, museum_id, name, location, reason) SELECT ${sql(d.id)}, (SELECT COALESCE(MAX(order_index), -1) + 1 FROM dynasty_recommended_museums WHERE dynasty_id = ${sql(d.id)}), ${[
        r.museum_id, r.name, r.location, r.reason,
      ].map(sql).join(", ")} WHERE NOT EXISTS (SELECT 1 FROM dynasty_recommended_museums WHERE dynasty_id = ${sql(d.id)} AND museum_id = ${sql(r.museum_id)});`)
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
