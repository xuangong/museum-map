#!/usr/bin/env bun
// Restore data/*.yaml → D1. Usage: bun run restore [--target=local|remote] [--confirm]
//
// SAFETY: without --confirm, prints SQL preview and aborts. Restore is destructive
// (DELETE-then-INSERT for each table covered in the snapshot). Atomic per wrangler run.
import { mkdir, readdir } from "node:fs/promises"
import { $ } from "bun"
import YAML from "yaml"

const TARGET = process.argv.includes("--target=local") ? "local" : "remote"
const CONFIRM = process.argv.includes("--confirm")
const DATA_DIR = "data"
const SQL_OUT = ".tmp/restore.sql"

function sql(value: unknown): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL"
    return String(value)
  }
  if (typeof value === "boolean") return value ? "1" : "0"
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function row(values: unknown[]): string {
  return "(" + values.map(sql).join(", ") + ")"
}

async function readYaml<T>(path: string): Promise<T> {
  const text = await Bun.file(path).text()
  return YAML.parse(text) as T
}

type MuseumYaml = {
  id: string
  name: string
  lat?: number
  lng?: number
  location?: string
  level?: string
  core_period?: string
  specialty?: string
  dynasty_coverage?: string
  timeline?: string
  treasures?: { name: string }[]
  halls?: { name: string }[]
  artifacts?: {
    name: string
    period?: string
    description?: string
    image_url?: string
    image_license?: string
    image_attribution?: string
  }[]
  dynasty_connections?: { dynasty: string; description?: string }[]
  sources?: { source: string }[]
}

type DynastyYaml = {
  id: string
  name: string
  period?: string
  center_lat?: number
  center_lng?: number
  order_index?: number
  overview?: string
  culture?: { category: string; description?: string }[]
  events?: { date: string; event: string; lat?: number; lng?: number }[]
  recommended_museums?: {
    museum_id?: string
    name: string
    location?: string
    reason?: string
  }[]
}

async function loadAll() {
  const museums: MuseumYaml[] = []
  const dynasties: DynastyYaml[] = []
  const museumDir = `${DATA_DIR}/museums`
  const dynastyDir = `${DATA_DIR}/dynasties`
  for (const f of (await readdir(museumDir)).sort()) {
    if (!f.endsWith(".yaml")) continue
    museums.push(await readYaml<MuseumYaml>(`${museumDir}/${f}`))
  }
  for (const f of (await readdir(dynastyDir)).sort()) {
    if (!f.endsWith(".yaml")) continue
    dynasties.push(await readYaml<DynastyYaml>(`${dynastyDir}/${f}`))
  }
  const reasons = (await readYaml<Record<string, { museum_id: string; reason: string; evidence_json?: string }[]>>(
    `${DATA_DIR}/dynasty-museum-reasons.yaml`,
  )) ?? {}
  const provenance = (await readYaml<Record<string, { field_path: string; source_url?: string; authority?: string }[]>>(
    `${DATA_DIR}/field-provenance.yaml`,
  )) ?? {}
  return { museums, dynasties, reasons, provenance }
}

function buildSql(d: Awaited<ReturnType<typeof loadAll>>): string {
  const lines: string[] = []
  lines.push("PRAGMA foreign_keys = OFF;")

  // Reverse-dependency DELETE order
  lines.push("DELETE FROM field_provenance;")
  lines.push("DELETE FROM dynasty_museum_reasons;")
  lines.push("DELETE FROM dynasty_recommended_museums;")
  lines.push("DELETE FROM dynasty_events;")
  lines.push("DELETE FROM dynasty_culture;")
  lines.push("DELETE FROM dynasties;")
  lines.push("DELETE FROM museum_sources;")
  lines.push("DELETE FROM museum_dynasty_connections;")
  lines.push("DELETE FROM museum_artifacts;")
  lines.push("DELETE FROM museum_halls;")
  lines.push("DELETE FROM museum_treasures;")
  lines.push("DELETE FROM museums;")

  // Museums
  for (const m of d.museums) {
    lines.push(
      `INSERT INTO museums (id, name, lat, lng, location, level, core_period, specialty, dynasty_coverage, timeline) VALUES ` +
        row([m.id, m.name, m.lat, m.lng, m.location, m.level, m.core_period, m.specialty, m.dynasty_coverage, m.timeline]) +
        ";",
    )
    ;(m.treasures ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO museum_treasures (museum_id, order_index, name) VALUES ${row([m.id, i, x.name])};`,
      )
    })
    ;(m.halls ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO museum_halls (museum_id, order_index, name) VALUES ${row([m.id, i, x.name])};`,
      )
    })
    ;(m.artifacts ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO museum_artifacts (museum_id, order_index, name, period, description, image_url, image_license, image_attribution) VALUES ${row(
          [m.id, i, x.name, x.period, x.description, x.image_url, x.image_license, x.image_attribution],
        )};`,
      )
    })
    ;(m.dynasty_connections ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO museum_dynasty_connections (museum_id, order_index, dynasty, description) VALUES ${row(
          [m.id, i, x.dynasty, x.description],
        )};`,
      )
    })
    ;(m.sources ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO museum_sources (museum_id, order_index, source) VALUES ${row([m.id, i, x.source])};`,
      )
    })
  }

  // Dynasties
  for (const dy of d.dynasties) {
    lines.push(
      `INSERT INTO dynasties (id, name, period, center_lat, center_lng, overview, order_index) VALUES ${row(
        [dy.id, dy.name, dy.period, dy.center_lat, dy.center_lng, dy.overview, dy.order_index],
      )};`,
    )
    ;(dy.culture ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO dynasty_culture (dynasty_id, order_index, category, description) VALUES ${row(
          [dy.id, i, x.category, x.description],
        )};`,
      )
    })
    ;(dy.events ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO dynasty_events (dynasty_id, order_index, date, event, lat, lng) VALUES ${row(
          [dy.id, i, x.date, x.event, x.lat, x.lng],
        )};`,
      )
    })
    ;(dy.recommended_museums ?? []).forEach((x, i) => {
      lines.push(
        `INSERT INTO dynasty_recommended_museums (dynasty_id, order_index, museum_id, name, location, reason) VALUES ${row(
          [dy.id, i, x.museum_id, x.name, x.location, x.reason],
        )};`,
      )
    })
  }

  // Reasons
  for (const dynId of Object.keys(d.reasons).sort()) {
    for (const r of d.reasons[dynId]!) {
      lines.push(
        `INSERT INTO dynasty_museum_reasons (dynasty_id, museum_id, reason, evidence_json, generated_at) VALUES ${row(
          [dynId, r.museum_id, r.reason, r.evidence_json, new Date().toISOString()],
        )};`,
      )
    }
  }

  // Provenance
  for (const musId of Object.keys(d.provenance).sort()) {
    for (const p of d.provenance[musId]!) {
      lines.push(
        `INSERT INTO field_provenance (museum_id, field_path, source_url, authority, recorded_at) VALUES ${row(
          [musId, p.field_path, p.source_url, p.authority, new Date().toISOString()],
        )};`,
      )
    }
  }

  lines.push("PRAGMA foreign_keys = ON;")
  return lines.join("\n")
}

async function main() {
  console.log(`[restore] target=${TARGET} confirm=${CONFIRM}`)
  const data = await loadAll()
  console.log(
    `[restore] loaded ${data.museums.length} museums, ${data.dynasties.length} dynasties, ` +
      `${Object.values(data.reasons).flat().length} reasons, ${Object.values(data.provenance).flat().length} provenance rows`,
  )
  const sqlText = buildSql(data)
  await mkdir(".tmp", { recursive: true })
  await Bun.write(SQL_OUT, sqlText)
  console.log(`[restore] wrote ${SQL_OUT} (${sqlText.length} bytes, ${sqlText.split("\n").length} stmts)`)

  if (!CONFIRM) {
    console.log("[restore] DRY RUN — pass --confirm to execute against D1.")
    return
  }
  const flag = TARGET === "remote" ? "--remote" : "--local"
  console.log(`[restore] executing against ${TARGET} D1…`)
  await $`bunx wrangler d1 execute museum-map-db ${flag} --file=${SQL_OUT}`
  console.log("[restore] done")
}

main().catch((err) => {
  console.error("[restore] failed:", err)
  process.exit(1)
})
