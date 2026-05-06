#!/usr/bin/env bun
// Snapshot D1 → data/*.yaml. Usage: bun run snapshot [--target=local|remote]
//
// Output is deterministic (sorted by id, fixed key order) so git diffs are clean.
// Tables snapshotted: museums (+ children), dynasties (+ children),
//   dynasty_museum_reasons, field_provenance.
// PROTECTED — NEVER snapshot (privacy; data goes to git):
//   users, sessions, invites, visits, review_cache, dynasty_review_cache,
//   museums_pending (user state / regenerable / secrets).
import { mkdir, rm } from "node:fs/promises"
import { $ } from "bun"
import YAML from "yaml"

const TARGET = process.argv.includes("--target=local") ? "local" : "remote"
const DATA_DIR = "data"

type Row = Record<string, unknown>

async function query(sql: string): Promise<Row[]> {
  const flag = TARGET === "remote" ? "--remote" : "--local"
  const out = await $`bunx wrangler d1 execute museum-map-db ${flag} --command=${sql} --json`
    .quiet()
    .text()
  // wrangler may prefix with logs; find the JSON array start.
  const start = out.indexOf("[")
  if (start < 0) throw new Error(`no JSON in output:\n${out}`)
  const parsed = JSON.parse(out.slice(start))
  return (parsed[0]?.results ?? []) as Row[]
}

function clean<T extends Row>(r: T): T {
  const o: Row = {}
  for (const k of Object.keys(r)) {
    const v = r[k]
    if (v === null || v === "" || v === undefined) continue
    o[k] = v
  }
  return o as T
}

function dumpYaml(obj: unknown): string {
  return YAML.stringify(obj, {
    lineWidth: 0, // no auto-wrap (we want predictable line breaks)
    indent: 2,
    sortMapEntries: false, // we control ordering
  })
}

async function writeYaml(path: string, obj: unknown) {
  await Bun.write(path, dumpYaml(obj))
}

async function snapshotMuseums() {
  console.log("[snapshot] museums…")
  const museums = await query("SELECT * FROM museums ORDER BY id")
  const treasures = await query("SELECT * FROM museum_treasures ORDER BY museum_id, order_index")
  const halls = await query("SELECT * FROM museum_halls ORDER BY museum_id, order_index")
  const artifacts = await query("SELECT * FROM museum_artifacts ORDER BY museum_id, order_index")
  const conns = await query(
    "SELECT * FROM museum_dynasty_connections ORDER BY museum_id, order_index",
  )
  const sources = await query("SELECT * FROM museum_sources ORDER BY museum_id, order_index")

  const byMuseum = <T extends { museum_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>()
    for (const r of rows) {
      const arr = m.get(r.museum_id) ?? []
      arr.push(r)
      m.set(r.museum_id, arr)
    }
    return m
  }
  const tByM = byMuseum(treasures as { museum_id: string }[])
  const hByM = byMuseum(halls as { museum_id: string }[])
  const aByM = byMuseum(artifacts as { museum_id: string }[])
  const cByM = byMuseum(conns as { museum_id: string }[])
  const sByM = byMuseum(sources as { museum_id: string }[])

  await rm(`${DATA_DIR}/museums`, { recursive: true, force: true })
  await mkdir(`${DATA_DIR}/museums`, { recursive: true })

  for (const m of museums) {
    const id = m.id as string
    const out: Row = clean({
      id: m.id,
      name: m.name,
      lat: m.lat,
      lng: m.lng,
      location: m.location,
      level: m.level,
      core_period: m.core_period,
      specialty: m.specialty,
      dynasty_coverage: m.dynasty_coverage,
      timeline: m.timeline,
    })
    const t = tByM.get(id) ?? []
    if (t.length) out.treasures = t.map((x: Row) => clean({ name: x.name }))
    const h = hByM.get(id) ?? []
    if (h.length) out.halls = h.map((x: Row) => clean({ name: x.name }))
    const a = aByM.get(id) ?? []
    if (a.length)
      out.artifacts = a.map((x: Row) =>
        clean({
          name: x.name,
          period: x.period,
          description: x.description,
          image_url: x.image_url,
          image_license: x.image_license,
          image_attribution: x.image_attribution,
        }),
      )
    const c = cByM.get(id) ?? []
    if (c.length)
      out.dynasty_connections = c.map((x: Row) =>
        clean({ dynasty: x.dynasty, description: x.description }),
      )
    const s = sByM.get(id) ?? []
    if (s.length) out.sources = s.map((x: Row) => clean({ source: x.source }))
    await writeYaml(`${DATA_DIR}/museums/${id}.yaml`, out)
  }
  console.log(`[snapshot]   wrote ${museums.length} museum files`)
}

async function snapshotDynasties() {
  console.log("[snapshot] dynasties…")
  const dynasties = await query("SELECT * FROM dynasties ORDER BY order_index, id")
  const culture = await query("SELECT * FROM dynasty_culture ORDER BY dynasty_id, order_index")
  const events = await query("SELECT * FROM dynasty_events ORDER BY dynasty_id, order_index")
  const recs = await query(
    "SELECT * FROM dynasty_recommended_museums ORDER BY dynasty_id, order_index",
  )

  const byDyn = <T extends { dynasty_id: string }>(rows: T[]) => {
    const m = new Map<string, T[]>()
    for (const r of rows) {
      const arr = m.get(r.dynasty_id) ?? []
      arr.push(r)
      m.set(r.dynasty_id, arr)
    }
    return m
  }
  const cByD = byDyn(culture as { dynasty_id: string }[])
  const eByD = byDyn(events as { dynasty_id: string }[])
  const rByD = byDyn(recs as { dynasty_id: string }[])

  await rm(`${DATA_DIR}/dynasties`, { recursive: true, force: true })
  await mkdir(`${DATA_DIR}/dynasties`, { recursive: true })

  for (const d of dynasties) {
    const id = d.id as string
    const out: Row = clean({
      id: d.id,
      name: d.name,
      period: d.period,
      center_lat: d.center_lat,
      center_lng: d.center_lng,
      order_index: d.order_index,
      overview: d.overview,
    })
    const c = cByD.get(id) ?? []
    if (c.length)
      out.culture = c.map((x: Row) => clean({ category: x.category, description: x.description }))
    const e = eByD.get(id) ?? []
    if (e.length)
      out.events = e.map((x: Row) =>
        clean({ date: x.date, event: x.event, lat: x.lat, lng: x.lng }),
      )
    const r = rByD.get(id) ?? []
    if (r.length)
      out.recommended_museums = r.map((x: Row) =>
        clean({
          museum_id: x.museum_id,
          name: x.name,
          location: x.location,
          reason: x.reason,
        }),
      )
    await writeYaml(`${DATA_DIR}/dynasties/${id}.yaml`, out)
  }
  console.log(`[snapshot]   wrote ${dynasties.length} dynasty files`)
}

async function snapshotReasons() {
  console.log("[snapshot] dynasty_museum_reasons…")
  const rows = await query(
    "SELECT dynasty_id, museum_id, reason, evidence_json FROM dynasty_museum_reasons ORDER BY dynasty_id, museum_id",
  )
  // generated_at intentionally excluded — it's metadata noise that would dirty diffs on every regen.
  const grouped = new Map<string, Row[]>()
  for (const r of rows) {
    const arr = grouped.get(r.dynasty_id as string) ?? []
    arr.push(
      clean({
        museum_id: r.museum_id,
        reason: r.reason,
        evidence_json: r.evidence_json,
      }),
    )
    grouped.set(r.dynasty_id as string, arr)
  }
  const out: Row = {}
  for (const k of [...grouped.keys()].sort()) out[k] = grouped.get(k)
  await writeYaml(`${DATA_DIR}/dynasty-museum-reasons.yaml`, out)
  console.log(`[snapshot]   wrote ${rows.length} reasons across ${grouped.size} dynasties`)
}

async function snapshotProvenance() {
  console.log("[snapshot] field_provenance…")
  const rows = await query(
    "SELECT museum_id, field_path, source_url, authority FROM field_provenance ORDER BY museum_id, field_path",
  )
  // recorded_at excluded for the same reason as above.
  const grouped = new Map<string, Row[]>()
  for (const r of rows) {
    const arr = grouped.get(r.museum_id as string) ?? []
    arr.push(
      clean({
        field_path: r.field_path,
        source_url: r.source_url,
        authority: r.authority,
      }),
    )
    grouped.set(r.museum_id as string, arr)
  }
  const out: Row = {}
  for (const k of [...grouped.keys()].sort()) out[k] = grouped.get(k)
  await writeYaml(`${DATA_DIR}/field-provenance.yaml`, out)
  console.log(`[snapshot]   wrote ${rows.length} rows across ${grouped.size} museums`)
}

async function main() {
  console.log(`[snapshot] target=${TARGET}`)
  await mkdir(DATA_DIR, { recursive: true })
  await snapshotMuseums()
  await snapshotDynasties()
  await snapshotReasons()
  await snapshotProvenance()
  console.log("[snapshot] done")
}

main().catch((err) => {
  console.error("[snapshot] failed:", err)
  process.exit(1)
})
