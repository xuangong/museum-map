#!/usr/bin/env bun
// Usage: bun run scripts/seed.ts [--target=local|remote]
import { mkdir } from "node:fs/promises"
import { $ } from "bun"
import type { DataJson } from "./types"

const TARGET = process.argv.includes("--target=remote") ? "remote" : "local"
const DATA_PATH = "legacy/data.json"
const SQL_OUT = ".tmp/seed.sql"

function sql(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "NULL"
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL"
    return String(value)
  }
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function row(values: Array<string | number | null | undefined>): string {
  return "(" + values.map(sql).join(", ") + ")"
}

function buildSql(data: DataJson, useTransactions: boolean): string {
  const lines: string[] = []
  lines.push("PRAGMA foreign_keys = ON;")
  if (useTransactions) lines.push("BEGIN;")

  // Reverse-dependency DELETE order for idempotency
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

  // Museums (parent)
  for (const m of data.museums) {
    lines.push(
      `INSERT INTO museums (id, name, lat, lng, location, level, core_period, specialty, dynasty_coverage, timeline) VALUES ` +
        row([m.id, m.name, m.lat, m.lng, m.location, m.level, m.corePeriod, m.specialty, m.dynastyCoverage, m.timeline]) +
        ";",
    )
    ;(m.treasures ?? []).forEach((name, i) => {
      lines.push(`INSERT INTO museum_treasures (museum_id, order_index, name) VALUES ${row([m.id, i, name])};`)
    })
    ;(m.halls ?? []).forEach((name, i) => {
      lines.push(`INSERT INTO museum_halls (museum_id, order_index, name) VALUES ${row([m.id, i, name])};`)
    })
    ;(m.artifacts ?? []).forEach((a, i) => {
      lines.push(
        `INSERT INTO museum_artifacts (museum_id, order_index, name, period, description) VALUES ` +
          row([m.id, i, a.name, a.period, a.description]) +
          ";",
      )
    })
    ;(m.dynastyConnections ?? []).forEach((c, i) => {
      lines.push(
        `INSERT INTO museum_dynasty_connections (museum_id, order_index, dynasty, description) VALUES ` +
          row([m.id, i, c.dynasty, c.description]) +
          ";",
      )
    })
    ;(m.sources ?? []).forEach((s, i) => {
      lines.push(`INSERT INTO museum_sources (museum_id, order_index, source) VALUES ${row([m.id, i, s])};`)
    })
  }

  // Dynasties (parent) — order_index from array position
  data.dynasties.forEach((d, idx) => {
    lines.push(
      `INSERT INTO dynasties (id, name, period, center_lat, center_lng, overview, order_index) VALUES ` +
        row([d.id, d.name, d.period, d.center?.lat ?? null, d.center?.lng ?? null, d.overview, idx]) +
        ";",
    )
    ;(d.culture ?? []).forEach((c, i) => {
      lines.push(
        `INSERT INTO dynasty_culture (dynasty_id, order_index, category, description) VALUES ` +
          row([d.id, i, c.category, c.description]) +
          ";",
      )
    })
    ;(d.events ?? []).forEach((e, i) => {
      lines.push(
        `INSERT INTO dynasty_events (dynasty_id, order_index, date, event, lat, lng) VALUES ` +
          row([d.id, i, e.date, e.event, e.lat ?? null, e.lng ?? null]) +
          ";",
      )
    })
    ;(d.recommendedMuseums ?? []).forEach((r, i) => {
      lines.push(
        `INSERT INTO dynasty_recommended_museums (dynasty_id, order_index, museum_id, name, location, reason) VALUES ` +
          row([d.id, i, r.museumId ?? null, r.name, r.location, r.reason]) +
          ";",
      )
    })
  })

  if (useTransactions) lines.push("COMMIT;")
  return lines.join("\n")
}

async function main() {
  const file = Bun.file(DATA_PATH)
  if (!(await file.exists())) {
    console.error(`[seed] ${DATA_PATH} not found`)
    process.exit(1)
  }
  const data = (await file.json()) as DataJson
  console.log(`[seed] loaded ${data.museums.length} museums, ${data.dynasties.length} dynasties`)

  await mkdir(".tmp", { recursive: true })
  const sql = buildSql(data, TARGET === "remote")
  await Bun.write(SQL_OUT, sql)
  console.log(`[seed] wrote ${SQL_OUT} (${sql.length} bytes)`)

  const targetFlag = TARGET === "remote" ? "--remote" : "--local"
  console.log(`[seed] executing against ${TARGET} D1...`)
  await $`bunx wrangler d1 execute museum-map-db ${targetFlag} --file=${SQL_OUT}`
  console.log(`[seed] done`)
}

main().catch((err) => {
  console.error("[seed] failed:", err)
  process.exit(1)
})
