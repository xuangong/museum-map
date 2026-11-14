/**
 * Append artifacts to museums. INSERT-only: an artifact whose name already exists on that
 * museum is skipped; new ones go after the museum's last order_index. Nothing is deleted.
 *
 * Usage:
 *   bun run scripts/add-artifacts.ts                           # dry run
 *   bun run scripts/add-artifacts.ts -- --target=local --confirm
 *   bun run scripts/add-artifacts.ts -- --confirm              # remote D1
 *   --file=scripts/artifacts-instruments-2026-11.yaml (default)
 *
 * Afterwards run `bun run snapshot` so data/museums/*.yaml matches.
 */
import { execSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { parse } from "yaml"

const args = process.argv.slice(2)
const CONFIRM = args.includes("--confirm")
const TARGET = args.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "remote"
const FILE = args.find((a) => a.startsWith("--file="))?.split("=")[1] ?? "scripts/artifacts-instruments-2026-11.yaml"

type Art = { name: string; period?: string; description?: string }
const input = parse(readFileSync(FILE, "utf8")) as Record<string, Art[]>
const museumIds = new Set(readdirSync("data/museums").map((f) => f.replace(/\.yaml$/, "")))

const q = (s: string | undefined) => (s == null ? "NULL" : "'" + s.replace(/'/g, "''") + "'")
const rows: string[] = []
const errors: string[] = []
for (const [museumId, arts] of Object.entries(input)) {
  if (!museumIds.has(museumId)) errors.push(`unknown museum ${museumId}`)
  for (const a of arts) {
    if (!a.name?.trim()) errors.push(`empty name on ${museumId}`)
    rows.push(
      `INSERT INTO museum_artifacts (museum_id, order_index, name, period, description) ` +
        `SELECT ${q(museumId)}, COALESCE((SELECT MAX(order_index) FROM museum_artifacts WHERE museum_id = ${q(museumId)}), -1) + 1, ${q(a.name.trim())}, ${q(a.period)}, ${q(a.description?.trim())} ` +
        `WHERE NOT EXISTS (SELECT 1 FROM museum_artifacts WHERE museum_id = ${q(museumId)} AND name = ${q(a.name.trim())});`,
    )
  }
}
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
console.log(`[artifacts] ${rows.length} artifacts on ${Object.keys(input).length} museums → ${TARGET}${CONFIRM ? "" : " (dry run)"}`)
if (!CONFIRM) process.exit(0)

mkdirSync(".wrangler/tmp", { recursive: true })
const sqlFile = ".wrangler/tmp/add-artifacts.sql"
writeFileSync(sqlFile, rows.join("\n") + "\n")
execSync(`bunx wrangler d1 execute museum-map-db ${TARGET === "local" ? "--local" : "--remote"} --file=${sqlFile}`, { stdio: "inherit" })
writeFileSync(sqlFile, "")
console.log("[artifacts] done")
