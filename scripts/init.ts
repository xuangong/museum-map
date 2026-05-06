#!/usr/bin/env bun
// One-shot site bootstrap: apply migrations + restore museum/dynasty data.
// Usage:
//   bun run init                    # local D1 (safe default)
//   bun run init -- --target=remote --confirm   # remote D1
//
// SAFETY: refuses to restore if museums or dynasties tables already contain rows.
//   Use scripts/restore.ts directly if you really want to overwrite existing data.
//
// What it does:
//   1. wrangler d1 migrations apply  → schema up to date
//   2. SELECT COUNT(*) FROM museums / dynasties → abort if non-empty
//   3. scripts/restore.ts --confirm  → inserts data/*.yaml (only on empty DB)
//
// What it does NOT touch (privacy / state):
//   users, sessions, invites, visits, review_cache, dynasty_review_cache, museums_pending.
//   First registered user automatically becomes admin (see AuthService.register).
import { $ } from "bun"

const TARGET = process.argv.includes("--target=remote") ? "remote" : "local"
const CONFIRM = process.argv.includes("--confirm")

async function tableCount(table: string): Promise<number> {
  const flag = TARGET === "remote" ? "--remote" : "--local"
  try {
    const out = await $`bunx wrangler d1 execute museum-map-db ${flag} --command=${`SELECT COUNT(*) AS n FROM ${table};`} --json`
      .quiet()
      .text()
    const start = out.indexOf("[")
    if (start < 0) return 0
    const parsed = JSON.parse(out.slice(start))
    const n = parsed[0]?.results?.[0]?.n
    return typeof n === "number" ? n : Number(n) || 0
  } catch {
    // table doesn't exist yet (fresh DB before migrations) — treat as empty
    return 0
  }
}

async function main() {
  console.log(`[init] target=${TARGET}`)
  if (TARGET === "remote" && !CONFIRM) {
    console.log("[init] remote target requires --confirm.")
    console.log("[init] dry-run: would check emptiness, apply migrations, and (if empty) restore data/.")
    return
  }

  const flag = TARGET === "remote" ? "--remote" : "--local"

  console.log("[init] step 1/3 — checking museum/dynasty tables are empty…")
  const [mCount, dCount] = await Promise.all([tableCount("museums"), tableCount("dynasties")])
  if (mCount > 0 || dCount > 0) {
    console.log(`[init] ABORT: museums=${mCount} dynasties=${dCount} — DB already has data.`)
    console.log("[init] init is for fresh sites only. To overwrite, run:")
    console.log(`[init]   bun run restore -- --target=${TARGET} --confirm`)
    process.exit(1)
  }

  console.log("[init] step 2/3 — applying migrations…")
  await $`bunx wrangler d1 migrations apply museum-map-db ${flag}`

  console.log("[init] step 3/3 — restoring museum/dynasty data from data/…")
  const restoreArgs = ["bun", "run", "scripts/restore.ts", `--target=${TARGET}`, "--confirm"]
  await $`${restoreArgs}`

  console.log("[init] done.")
  console.log("[init] next: register the first user via the UI — they become admin automatically.")
}

main().catch((err) => {
  console.error("[init] failed:", err)
  process.exit(1)
})
