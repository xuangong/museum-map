/**
 * Backfill dynasty_recommended_museums.museum_id by fuzzy-matching against museums.name
 *
 * Usage:
 *   bun run scripts/backfill-dynasty-recs.ts                # dry run (default)
 *   bun run scripts/backfill-dynasty-recs.ts -- --apply     # write SQL via wrangler
 *   bun run scripts/backfill-dynasty-recs.ts -- --apply --target=local  # local D1
 */

import { execSync } from "node:child_process"

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const TARGET = args.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "remote"

function d1(sql: string): any[] {
  const flag = TARGET === "local" ? "--local" : "--remote"
  const out = execSync(
    `bunx wrangler d1 execute museum-map-db ${flag} --json --command=${JSON.stringify(sql)}`,
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
  const parsed = JSON.parse(out)
  return parsed[0]?.results ?? []
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")
    .replace(/\/.*$/g, "")
    .replace(/[\s（）()「」『』""''《》、，,。·\-]/g, "")
    .replace(/博物院|博物馆|遗址博物馆|纪念馆|陈列馆|陈列室|艺术馆/g, "馆")
}

interface Museum {
  id: string
  name: string
}

interface Rec {
  dynasty_id: string
  order_index: number
  name: string
  museum_id: string | null
}

console.log(`Target: ${TARGET}, Apply: ${APPLY}`)
const museums = d1("SELECT id, name FROM museums") as Museum[]
const recs = d1(
  "SELECT dynasty_id, order_index, name, museum_id FROM dynasty_recommended_museums WHERE museum_id IS NULL ORDER BY dynasty_id, order_index",
) as Rec[]
console.log(`Museums: ${museums.length}, NULL recs: ${recs.length}`)

// Build lookup: normalized name → id; also index parenthetical aliases.
const lookup = new Map<string, string>()
function indexName(rawName: string, id: string) {
  const main = normalize(rawName)
  if (main && !lookup.has(main)) lookup.set(main, id)
  // Also pull out any parenthetical aliases as their own keys
  const parenMatches = rawName.matchAll(/[（(]([^)）]+)[)）]/g)
  for (const m of parenMatches) {
    const aliasNorm = normalize(m[1])
    if (aliasNorm && !lookup.has(aliasNorm)) lookup.set(aliasNorm, id)
  }
}
for (const m of museums) indexName(m.name, m.id)

interface Resolution {
  rec: Rec
  museumId: string | null
  match: "exact" | "contains" | null
}

// Manual overrides for cases the heuristic can't catch (verified by hand against the museum list).
const MANUAL: Record<string, string> = {
  "中国大运河博物馆": "yangzhou",        // yangzhou's full name = "扬州博物馆 / 中国大运河博物馆"
  "敦煌研究院/莫高窟": "mogao",
}

function resolve(name: string): { id: string | null; match: Resolution["match"] } {
  if (MANUAL[name]) return { id: MANUAL[name]!, match: "exact" }
  // Try main name + each parenthetical alias
  const candidates: string[] = [name]
  for (const m of name.matchAll(/[（(]([^)）]+)[)）]/g)) candidates.push(m[1])

  for (const cand of candidates) {
    const n = normalize(cand)
    if (!n) continue
    if (lookup.has(n)) return { id: lookup.get(n)!, match: "exact" }
  }
  for (const cand of candidates) {
    const n = normalize(cand)
    if (!n || n.length < 3) continue
    for (const [key, id] of lookup) {
      if (key.includes(n) || n.includes(key)) {
        const overlap = key.length < n.length ? key.length : n.length
        if (overlap >= 3) return { id, match: "contains" }
      }
    }
  }
  return { id: null, match: null }
}

const resolutions: Resolution[] = recs.map((r) => {
  const { id, match } = resolve(r.name)
  return { rec: r, museumId: id, match }
})

const matched = resolutions.filter((r) => r.museumId)
const unmatched = resolutions.filter((r) => !r.museumId)
console.log(`\nMatched: ${matched.length}/${recs.length}`)
console.log(`Unmatched: ${unmatched.length}`)
console.log()

console.log("=== Matched (sample) ===")
for (const r of matched.slice(0, 20)) {
  console.log(`  [${r.match}] ${r.rec.dynasty_id}#${r.rec.order_index} "${r.rec.name}" → ${r.museumId}`)
}
if (matched.length > 20) console.log(`  ... +${matched.length - 20} more`)

console.log("\n=== Unmatched ===")
for (const r of unmatched) {
  console.log(`  ${r.rec.dynasty_id}#${r.rec.order_index} "${r.rec.name}"`)
}

if (!APPLY) {
  console.log("\n(Dry run. Re-run with --apply to write.)")
  process.exit(0)
}

if (matched.length === 0) {
  console.log("\nNothing to apply.")
  process.exit(0)
}

console.log("\nApplying...")
// Batch as multi-statement command
const stmts = matched.map((r) => {
  const id = r.museumId!.replace(/'/g, "''")
  return `UPDATE dynasty_recommended_museums SET museum_id='${id}' WHERE dynasty_id='${r.rec.dynasty_id.replace(/'/g, "''")}' AND order_index=${r.rec.order_index};`
})
// Chunk to avoid command-line length limits
const CHUNK = 30
for (let i = 0; i < stmts.length; i += CHUNK) {
  const chunk = stmts.slice(i, i + CHUNK).join(" ")
  const flag = TARGET === "local" ? "--local" : "--remote"
  execSync(`bunx wrangler d1 execute museum-map-db ${flag} --command=${JSON.stringify(chunk)}`, {
    stdio: "inherit",
  })
  console.log(`  applied ${Math.min(i + CHUNK, stmts.length)}/${stmts.length}`)
}
console.log("Done.")
