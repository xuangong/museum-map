/**
 * Push the `events:` of data/dynasties/*.yaml into dynasty_events. Only that table is
 * rewritten (per dynasty: DELETE then INSERT) — nothing references it, so no user data
 * is touched.
 *
 * Usage:
 *   bun run scripts/apply-dynasty-events.ts                       # dry run: counts + writes SQL
 *   bun run scripts/apply-dynasty-events.ts -- --target=local --confirm
 *   --out=path.sql   where to write the SQL (default .wrangler/tmp/dynasty-events.sql);
 *                    copy it to the VM and run it there for production.
 */
import { execSync } from "node:child_process"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { parse } from "yaml"

const args = process.argv.slice(2)
const CONFIRM = args.includes("--confirm")
const TARGET = args.find((a) => a.startsWith("--target="))?.split("=")[1] ?? "local"
const OUT = args.find((a) => a.startsWith("--out="))?.split("=")[1] ?? ".wrangler/tmp/dynasty-events.sql"

type Ev = { date: string; event: string; lat?: number; lng?: number }
const q = (s: string) => "'" + s.replace(/'/g, "''") + "'"
const n = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) ? String(v) : "NULL")

const lines: string[] = []
const errors: string[] = []
let total = 0
for (const f of readdirSync("data/dynasties").sort()) {
  const d = parse(readFileSync(`data/dynasties/${f}`, "utf8")) as { id: string; events?: Ev[] }
  const events = d.events ?? []
  events.forEach((e, i) => {
    if (!e.date || !e.event) errors.push(`${d.id}#${i}: missing date/event`)
    if (e.lat != null && (e.lat < 0 || e.lat > 60 || e.lng == null || e.lng < 40 || e.lng > 150)) errors.push(`${d.id}#${i}: odd coord ${e.lat},${e.lng}`)
  })
  lines.push(`DELETE FROM dynasty_events WHERE dynasty_id = ${q(d.id)};`)
  events.forEach((e, i) =>
    lines.push(
      `INSERT INTO dynasty_events (dynasty_id, order_index, date, event, lat, lng) VALUES (${q(d.id)}, ${i}, ${q(e.date)}, ${q(e.event)}, ${n(e.lat)}, ${n(e.lng)});`,
    ),
  )
  total += events.length
}
if (errors.length) {
  console.error(errors.join("\n"))
  process.exit(1)
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, lines.join("\n") + "\n")
console.log(`[events] ${total} events → ${OUT}${CONFIRM ? ` → ${TARGET}` : " (dry run)"}`)
if (!CONFIRM) process.exit(0)
execSync(`bunx wrangler d1 execute museum-map-db ${TARGET === "local" ? "--local" : "--remote"} --file=${OUT}`, { stdio: "inherit" })
console.log("[events] done")
