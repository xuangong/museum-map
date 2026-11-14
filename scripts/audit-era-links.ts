/**
 * Audit museum ↔ era links: which museums have no era at all, and which eras the
 * matcher (src/services/dynasty-museum-match.ts) would give them from their own
 * core_period / dynasty_coverage / artifact descriptions.
 *
 * Usage: bun run scripts/audit-era-links.ts [--all] [--verbose]
 *   --all      also list matcher pairs missing for museums that already have some eras
 */
import { readdirSync, readFileSync } from "node:fs"
import { parse } from "yaml"
import { buildEvidence, type ArtifactSignal, type MuseumSignal } from "../src/services/dynasty-museum-match"

const ALL = process.argv.includes("--all")
const VERBOSE = process.argv.includes("--verbose")
const dir = "data"
const museums = readdirSync(`${dir}/museums`).filter((f) => f.endsWith(".yaml")).map((f) => parse(readFileSync(`${dir}/museums/${f}`, "utf8")))
const dynasties = readdirSync(`${dir}/dynasties`).filter((f) => f.endsWith(".yaml")).map((f) => parse(readFileSync(`${dir}/dynasties/${f}`, "utf8")))
const reasons = parse(readFileSync(`${dir}/dynasty-museum-reasons.yaml`, "utf8")) as Record<string, { museum_id: string }[]>

// Existing links: curated recommendations + reasons rows (what the site shows today).
const linked = new Map<string, Set<string>>()
const add = (m: string, d: string) => { if (!linked.has(m)) linked.set(m, new Set()); linked.get(m)!.add(d) }
for (const d of dynasties) for (const r of d.recommended_museums ?? []) if (r.museum_id) add(r.museum_id, d.id)
for (const [d, rows] of Object.entries(reasons)) for (const r of rows) add(r.museum_id, d)

const signals: MuseumSignal[] = museums.map((m) => ({ id: m.id, name: m.name, corePeriod: m.core_period ?? null, dynastyCoverage: m.dynasty_coverage ?? null }))
const artifacts: ArtifactSignal[] = museums.flatMap((m) => (m.artifacts ?? []).map((a: any) => ({ museum_id: m.id, name: a.name, period: a.period ?? (a.description ? String(a.description).split(/[。，,]/)[0] : null) })))
const order = dynasties.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
const found = new Map<string, string[]>()
for (const d of order) for (const ev of buildEvidence({ id: d.id, name: d.name }, signals, artifacts)) {
  if (!found.has(ev.museumId)) found.set(ev.museumId, [])
  found.get(ev.museumId)!.push(d.id)
}
const short = (id: string) => (order.find((d) => d.id === id)?.name ?? id).replace(/[（(].*$/, "").slice(0, 4)

const unlinked = museums.filter((m) => !linked.get(m.id)?.size)
let gain = 0, still = 0
console.log(`museums ${museums.length}, linked ${museums.length - unlinked.length}, unlinked ${unlinked.length}\n`)
for (const m of unlinked) {
  const eras = found.get(m.id) ?? []
  gain += eras.length; if (!eras.length) still++
  console.log(`${eras.length ? "  " : "✗ "}${m.name}  →  ${eras.map(short).join(" ") || "(none)"}`)
  if (VERBOSE) console.log(`      coverage: ${m.dynasty_coverage ?? "∅"}\n      core:     ${m.core_period ?? "∅"}`)
}
console.log(`\nunlinked: ${unlinked.length}, would gain ${gain} pairs, still empty ${still}`)
if (ALL) {
  let extra = 0
  for (const m of museums) {
    if (!linked.get(m.id)?.size) continue
    const miss = (found.get(m.id) ?? []).filter((d) => !linked.get(m.id)!.has(d))
    extra += miss.length
    if (VERBOSE && miss.length) console.log(`+ ${m.name}: ${miss.map(short).join(" ")}`)
  }
  console.log(`already-linked museums: ${extra} more matcher pairs not on the site`)
}
