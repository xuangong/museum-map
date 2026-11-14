/**
 * Add hand-curated museum ↔ era links (dynasty_museum_reasons rows). INSERT-only:
 * existing (dynasty, museum) pairs are left untouched, nothing is deleted.
 *
 * Usage:
 *   bun run scripts/add-era-links.ts                          # dry run, remote
 *   bun run scripts/add-era-links.ts -- --target=local --confirm
 *   bun run scripts/add-era-links.ts -- --confirm             # remote D1
 *   --file=scripts/era-links-2026-11.yaml (default)
 *
 * Afterwards run `bun run snapshot` so data/dynasty-museum-reasons.yaml matches.
 */
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { parse } from "yaml"

const args = process.argv.slice(2)
const CONFIRM = args.includes("--confirm")
const TARGET = args.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "remote"
const FILE = args.find((a) => a.startsWith("--file="))?.split("=")[1] ?? "scripts/era-links-2026-11.yaml"

const links = parse(readFileSync(FILE, "utf8")) as Record<string, Record<string, string>>
const museumIds = new Set(readdirSync("data/museums").map((f) => f.replace(/\.yaml$/, "")))
const dynastyIds = new Set(readdirSync("data/dynasties").map((f) => f.replace(/\.yaml$/, "")))

const q = (s: string) => "'" + s.replace(/'/g, "''") + "'"
const now = Date.now()
const rows: string[] = []
const errors: string[] = []
for (const [museumId, eras] of Object.entries(links)) {
  if (!museumIds.has(museumId)) errors.push(`unknown museum ${museumId}`)
  for (const [dynastyId, reason] of Object.entries(eras ?? {})) {
    if (!dynastyIds.has(dynastyId)) errors.push(`unknown dynasty ${dynastyId} (museum ${museumId})`)
    if (!reason || !reason.trim()) errors.push(`empty reason ${museumId}/${dynastyId}`)
    rows.push(
      `INSERT INTO dynasty_museum_reasons (dynasty_id, museum_id, reason, evidence_json, generated_at) VALUES (${q(dynastyId)}, ${q(museumId)}, ${q(reason.trim())}, NULL, ${now}) ON CONFLICT(dynasty_id, museum_id) DO NOTHING;`,
    )
  }
}
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(`[era-links] ${Object.keys(links).length} museums, ${rows.length} pairs → ${TARGET}${CONFIRM ? "" : " (dry run)"}`)
if (!CONFIRM) process.exit(0)

mkdirSync(".wrangler/tmp", { recursive: true })
const sqlFile = ".wrangler/tmp/era-links.sql"
writeFileSync(sqlFile, rows.join("\n") + "\n")
const flag = TARGET === "local" ? "--local" : "--remote"
execSync(`bunx wrangler d1 execute museum-map-db ${flag} --file=${sqlFile}`, { stdio: "inherit" })
if (existsSync(sqlFile)) writeFileSync(sqlFile, "")
console.log("[era-links] done")
