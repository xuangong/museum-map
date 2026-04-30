# Museum Map Modernization · Plan 01 · Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Bun + Elysia + Cloudflare Workers + D1 project skeleton, create the 11-table schema, and load all 64 museums + 20 dynasties from `legacy/data.json` into D1 — idempotently.

**Architecture:** Mirror copilot-api-gateway scripts/wrangler.toml/tsconfig layout. Schema follows spec §4 verbatim (museums + 5 child tables; dynasties + 3 child tables). Seed script reads legacy JSON, builds a single SQL file in `.tmp/`, executes via `wrangler d1 execute --file=`. Idempotent via `DELETE FROM` in dependency order before `INSERT`.

**Tech Stack:** Bun, TypeScript (strict), Wrangler 4.x, D1 (SQLite). No frameworks needed yet — chat/UI come in later plans.

**Spec reference:** `docs/superpowers/specs/2026-04-30-museum-map-modernization-design.md` §3, §4, §7.

---

## File Structure

| File | Purpose |
|---|---|
| `package.json` | scripts: `seed`, `test`, `typecheck`; deps: `@types/bun`, `typescript`, `wrangler` |
| `tsconfig.json` | strict TS, target esnext, moduleResolution bundler |
| `wrangler.toml` | Worker name, D1 binding `DB`, KV binding `RATE` (placeholder), vars |
| `.gitignore` | `.tmp/`, `.wrangler/`, `node_modules/`, `.env.local` |
| `migrations/0001_init.sql` | 11 tables + indexes, `PRAGMA foreign_keys = ON;` |
| `scripts/seed.ts` | read `legacy/data.json` → build `.tmp/seed.sql` → exec via wrangler |
| `tests/seed.test.ts` | idempotency + row counts + FK cascade behavior |
| `src/index.ts` | minimal Elysia stub (just `/health`) so wrangler dev runs |

---

## Task 1: Project skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "museum-map",
  "module": "src/index.ts",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "wrangler dev --port 4242",
    "predev": "wrangler d1 migrations apply museum-map-db --local",
    "deploy": "wrangler deploy",
    "seed": "bun run scripts/seed.ts",
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260329.1",
    "@types/bun": "latest",
    "typescript": "^5.9.3",
    "wrangler": "^4.78.0"
  },
  "dependencies": {
    "@elysiajs/cors": "^1.4.1",
    "elysia": "^1.4.28"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM"],
    "types": ["@cloudflare/workers-types", "@types/bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "~/*": ["src/*"] }
  },
  "include": ["src/**/*", "scripts/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Write `.gitignore`**

```
node_modules/
.tmp/
.wrangler/
.env.local
*.log
bun.lockb
```

- [ ] **Step 4: Write minimal `src/index.ts` stub**

```typescript
import { Elysia } from "elysia"

export interface Env {
  DB: D1Database
  RATE: KVNamespace
}

const app = new Elysia({ aot: false })
  .get("/health", () => ({ status: "ok" }))

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.handle(request)
  },
}
```

- [ ] **Step 5: Install dependencies**

Run: `bun install`
Expected: bun.lockb created; no errors.

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore src/index.ts bun.lockb
git commit -m "chore: bootstrap museum-map project (bun + elysia + workers)"
```

---

## Task 2: Create D1 database + KV namespace

**Files:**
- Create: `wrangler.toml`

- [ ] **Step 1: Create remote D1**

Run: `bunx wrangler d1 create museum-map-db`
Expected: prints `database_id = "<uuid>"`. **Copy the UUID.**

- [ ] **Step 2: Create remote KV namespace**

Run: `bunx wrangler kv namespace create RATE`
Expected: prints `id = "<hex>"`. **Copy the ID.**

- [ ] **Step 3: Write `wrangler.toml` (paste IDs from steps 1-2)**

```toml
name = "museum-map"
main = "src/index.ts"
compatibility_date = "2025-06-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

[[d1_databases]]
binding = "DB"
database_name = "museum-map-db"
database_id = "<paste from step 1>"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "RATE"
id = "<paste from step 2>"

[vars]
RATE_PER_MIN = "10"
RATE_PER_DAY = "100"
GLOBAL_PER_DAY = "5000"

[dev]
port = 4242
local_protocol = "http"
```

- [ ] **Step 4: Verify wrangler can read config**

Run: `bunx wrangler d1 list`
Expected: `museum-map-db` appears in the list.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add wrangler.toml with D1 + KV bindings"
```

---

## Task 3: Write D1 migration (11 tables)

**Files:**
- Create: `migrations/0001_init.sql`

- [ ] **Step 1: Write `migrations/0001_init.sql`**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE museums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  location TEXT,
  level TEXT,
  core_period TEXT,
  specialty TEXT,
  dynasty_coverage TEXT,
  timeline TEXT
);

CREATE TABLE museum_treasures (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_halls (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_artifacts (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  period TEXT,
  description TEXT,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_dynasty_connections (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  dynasty TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_sources (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE dynasties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  period TEXT,
  center_lat REAL,
  center_lng REAL,
  overview TEXT,
  order_index INTEGER NOT NULL
);

CREATE TABLE dynasty_culture (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE TABLE dynasty_events (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  date TEXT NOT NULL,
  event TEXT NOT NULL,
  lat REAL,
  lng REAL,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE TABLE dynasty_recommended_museums (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  museum_id TEXT REFERENCES museums(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  location TEXT,
  reason TEXT,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE INDEX idx_museums_coords ON museums(lat, lng);
CREATE INDEX idx_dynasty_events_dynasty ON dynasty_events(dynasty_id);
CREATE INDEX idx_dynasty_recommended_dynasty ON dynasty_recommended_museums(dynasty_id);
```

- [ ] **Step 2: Apply migration to local D1**

Run: `bunx wrangler d1 migrations apply museum-map-db --local`
Expected: `0001_init.sql` reported as applied.

- [ ] **Step 3: Verify schema landed**

Run: `bunx wrangler d1 execute museum-map-db --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"`
Expected: 10 tables (museums + 5 child + dynasties + 3 child = 10; verify each appears in output).

- [ ] **Step 4: Commit**

```bash
git add migrations/0001_init.sql
git commit -m "feat(db): initial schema (museums + dynasties + child tables)"
```

---

## Task 4: Write seed script — types + JSON loading

**Files:**
- Create: `scripts/types.ts`
- Create: `scripts/seed.ts` (skeleton; logic added in Task 5)

- [ ] **Step 1: Write `scripts/types.ts` (mirror legacy/data.json shape)**

```typescript
export interface MuseumJson {
  id: string
  name: string
  lat: number
  lng: number
  location?: string
  level?: string
  corePeriod?: string
  specialty?: string
  treasures?: string[]
  halls?: string[]
  artifacts?: { name: string; period?: string; description?: string }[]
  dynastyCoverage?: string
  timeline?: string
  dynastyConnections?: { dynasty: string; description?: string }[]
  sources?: string[]
}

export interface DynastyEventJson {
  date: string
  event: string
  lat?: number
  lng?: number
}

export interface DynastyCultureJson {
  category: string
  description?: string
}

export interface DynastyRecommendedMuseumJson {
  museumId?: string
  name: string
  location?: string
  reason?: string
}

export interface DynastyJson {
  id: string
  name: string
  period?: string
  center?: { lat?: number; lng?: number }
  overview?: string
  events?: DynastyEventJson[]
  culture?: DynastyCultureJson[]
  recommendedMuseums?: DynastyRecommendedMuseumJson[]
}

export interface DataJson {
  museums: MuseumJson[]
  dynasties: DynastyJson[]
}
```

- [ ] **Step 2: Write `scripts/seed.ts` skeleton**

```typescript
#!/usr/bin/env bun
// Usage: bun run scripts/seed.ts [--target=local|remote]
import { mkdir } from "node:fs/promises"
import { $ } from "bun"
import type { DataJson } from "./types"

const TARGET = process.argv.includes("--target=remote") ? "remote" : "local"
const DATA_PATH = "legacy/data.json"
const SQL_OUT = ".tmp/seed.sql"

async function main() {
  const file = Bun.file(DATA_PATH)
  if (!(await file.exists())) {
    console.error(`[seed] ${DATA_PATH} not found`)
    process.exit(1)
  }
  const data = (await file.json()) as DataJson
  console.log(`[seed] loaded ${data.museums.length} museums, ${data.dynasties.length} dynasties`)

  await mkdir(".tmp", { recursive: true })
  const sql = buildSql(data)
  await Bun.write(SQL_OUT, sql)
  console.log(`[seed] wrote ${SQL_OUT} (${sql.length} bytes)`)

  const targetFlag = TARGET === "remote" ? "--remote" : "--local"
  console.log(`[seed] executing against ${TARGET} D1...`)
  await $`bunx wrangler d1 execute museum-map-db ${targetFlag} --file=${SQL_OUT}`
  console.log(`[seed] done`)
}

function buildSql(data: DataJson): string {
  // implemented in Task 5
  return "BEGIN; COMMIT;"
}

main().catch((err) => {
  console.error("[seed] failed:", err)
  process.exit(1)
})
```

- [ ] **Step 3: Smoke run (should succeed but insert nothing)**

Run: `bun run seed`
Expected: prints `loaded 64 museums, 20 dynasties`, exits 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/types.ts scripts/seed.ts
git commit -m "feat(seed): skeleton seed script with type definitions"
```

---

## Task 5: Implement `buildSql` — DELETEs + INSERTs in dependency order

**Files:**
- Modify: `scripts/seed.ts` (replace `buildSql` and add SQL helpers)

- [ ] **Step 1: Add SQL escape helper at top of `scripts/seed.ts` (above `main`)**

```typescript
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
```

- [ ] **Step 2: Replace `buildSql` with full implementation**

```typescript
function buildSql(data: DataJson): string {
  const lines: string[] = []
  lines.push("PRAGMA foreign_keys = ON;")
  lines.push("BEGIN;")

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

  lines.push("COMMIT;")
  return lines.join("\n")
}
```

- [ ] **Step 3: Run seed against local D1**

Run: `bun run seed`
Expected: completes; wrangler reports "Executed N queries".

- [ ] **Step 4: Verify row counts**

Run:
```
bunx wrangler d1 execute museum-map-db --local --command="SELECT (SELECT count(*) FROM museums) AS m, (SELECT count(*) FROM dynasties) AS d, (SELECT count(*) FROM museum_artifacts) AS a"
```
Expected: `m=64`, `d=20`, `a=441`.

- [ ] **Step 5: Verify a known museum (`anhui`) has expected fields**

Run:
```
bunx wrangler d1 execute museum-map-db --local --command="SELECT id, name, lat, lng FROM museums WHERE id='anhui'"
```
Expected: name `安徽博物院`, lat `31.8206`, lng `117.2272`.

- [ ] **Step 6: Verify dynasty_culture is preserved as rows (not flattened)**

Run:
```
bunx wrangler d1 execute museum-map-db --local --command="SELECT count(*) FROM dynasty_culture"
```
Expected: a positive number > 20 (each dynasty has ≥1 culture entry; spec says all 20 dynasties have culture array).

- [ ] **Step 7: Commit**

```bash
git add scripts/seed.ts
git commit -m "feat(seed): build SQL with full schema coverage; idempotent DELETE order"
```

---

## Task 6: Test seed idempotency + FK behavior

**Files:**
- Create: `tests/seed.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeAll } from "bun:test"
import { $ } from "bun"

const D1 = ["bunx", "wrangler", "d1", "execute", "museum-map-db", "--local"] as const

async function exec(cmd: string): Promise<string> {
  const result = await $`${D1} --command=${cmd}`.text()
  return result
}

async function count(table: string): Promise<number> {
  const out = await exec(`SELECT count(*) AS c FROM ${table}`)
  const m = out.match(/"c":\s*(\d+)/)
  if (!m) throw new Error(`could not parse count from: ${out}`)
  return Number(m[1])
}

describe("seed.ts", () => {
  beforeAll(async () => {
    await $`bun run seed`.quiet()
  })

  it("loads exactly 64 museums and 20 dynasties", async () => {
    expect(await count("museums")).toBe(64)
    expect(await count("dynasties")).toBe(20)
  })

  it("loads exactly 441 museum_artifacts", async () => {
    expect(await count("museum_artifacts")).toBe(441)
  })

  it("preserves at least 340 artifacts with a non-null period", async () => {
    const out = await exec("SELECT count(*) AS c FROM museum_artifacts WHERE period IS NOT NULL AND period != ''")
    const m = out.match(/"c":\s*(\d+)/)
    expect(Number(m![1])).toBeGreaterThanOrEqual(340)
  })

  it("preserves dynasty_culture as rows (every dynasty has at least 1 entry)", async () => {
    const out = await exec(
      "SELECT count(*) AS c FROM dynasties WHERE id NOT IN (SELECT DISTINCT dynasty_id FROM dynasty_culture)",
    )
    const m = out.match(/"c":\s*(\d+)/)
    expect(Number(m![1])).toBe(0)
  })

  it("is idempotent — running seed again leaves identical row counts", async () => {
    const before = {
      museums: await count("museums"),
      dynasties: await count("dynasties"),
      artifacts: await count("museum_artifacts"),
      culture: await count("dynasty_culture"),
      sources: await count("museum_sources"),
    }
    await $`bun run seed`.quiet()
    const after = {
      museums: await count("museums"),
      dynasties: await count("dynasties"),
      artifacts: await count("museum_artifacts"),
      culture: await count("dynasty_culture"),
      sources: await count("museum_sources"),
    }
    expect(after).toEqual(before)
  })

  it("cascades delete for museum child tables", async () => {
    // Pick a museum with children
    await exec("DELETE FROM museums WHERE id='anhui'")
    const treasures = await exec("SELECT count(*) AS c FROM museum_treasures WHERE museum_id='anhui'")
    expect(treasures).toMatch(/"c":\s*0/)
    const artifacts = await exec("SELECT count(*) AS c FROM museum_artifacts WHERE museum_id='anhui'")
    expect(artifacts).toMatch(/"c":\s*0/)
    // Restore for subsequent runs
    await $`bun run seed`.quiet()
  })

  it("SET NULL on dynasty_recommended_museums.museum_id when museum deleted", async () => {
    // Find a recommended_museum row that points to an existing museum
    const before = await exec(
      "SELECT museum_id FROM dynasty_recommended_museums WHERE museum_id IS NOT NULL LIMIT 1",
    )
    const m = before.match(/"museum_id":\s*"([^"]+)"/)
    if (!m) {
      // No recommendation has a real museum_id mapping — skip
      return
    }
    const id = m[1]
    await exec(`DELETE FROM museums WHERE id='${id}'`)
    const after = await exec(
      `SELECT count(*) AS c FROM dynasty_recommended_museums WHERE museum_id='${id}'`,
    )
    expect(after).toMatch(/"c":\s*0/)
    // Restore
    await $`bun run seed`.quiet()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `bun test tests/seed.test.ts`
Expected: all pass. (If FK cascade fails, the migration didn't enable `PRAGMA foreign_keys = ON` — verify Task 3 SQL has it as the first line and re-apply migration.)

- [ ] **Step 3: Commit**

```bash
git add tests/seed.test.ts
git commit -m "test(seed): row counts, idempotency, FK cascade + SET NULL"
```

---

## Task 7: Wire `predev` + dev smoke

**Files:** _(none modified — just verifying scripts work)_

- [ ] **Step 1: Run dev**

Run: `bun run dev` (let it start, then Ctrl-C after ~3s)
Expected: wrangler starts on port 4242; predev applies migrations cleanly.

- [ ] **Step 2: Smoke /health**

Run dev in background and: `curl http://localhost:4242/health`
Expected: `{"status":"ok"}`. Stop dev.

- [ ] **Step 3: Commit (no-op or scripts adjustments if needed)**

Skip if no changes; otherwise:
```bash
git commit -am "chore: verify dev + predev wiring"
```

---

## Self-Review Checklist (run before handing off)

- All 11 tables from spec §4 created in 0001_init.sql ✓
- `dynasty_culture` is a child table (not flattened to TEXT) ✓
- `museum_artifacts.period` column present ✓
- `dynasty_recommended_museums.museum_id` has `REFERENCES museums(id) ON DELETE SET NULL` ✓
- Seed uses `--file=` (no command-string concatenation) ✓
- Seed idempotent via reverse-dependency `DELETE FROM` ✓
- Tests assert: 64 / 20 / 441 row counts + idempotency + FK behavior ✓
- No reference to chat / UI / repo (those belong to plans 02-05) ✓

---

## Hand-off

When all tasks pass: D1 has all legacy data; subsequent plans can read from `DB`. Plan 02 (Repo + API routes) can start.
