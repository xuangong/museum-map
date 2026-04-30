# Museum Map Modernization · Plan 02 · Repo + API Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer (`repo/museums.ts`, `repo/dynasties.ts`) that aggregates parent + child rows, and expose `/api/museums`, `/api/museums/:id`, `/api/dynasties`, `/api/dynasties/:id` via Elysia routes. Output JSON shapes match spec §5 contract verbatim.

**Architecture:** Repos take a `D1Database` and return camelCase JS objects (legacy-compatible). Each `get*` query enables `PRAGMA foreign_keys = ON` once per Worker invocation (cheap, idempotent). Routes are thin — pull `env.DB` from Elysia ctx (injected by `src/index.ts`), call repo, return JSON. List endpoints aggregate via batched D1 reads (one parent query + one query per child table, joined in memory). Single-item endpoints same shape.

**Tech Stack:** Elysia, D1, TypeScript strict.

**Spec reference:** `docs/superpowers/specs/2026-04-30-museum-map-modernization-design.md` §5.

**Depends on:** Plan 01 complete (D1 seeded).

---

## File Structure

| File | Purpose |
|---|---|
| `src/index.ts` | Replace stub: mount routes, derive `env.DB` into ctx |
| `src/repo/museums.ts` | `list()` returns list payload (with corePeriod + dynastyCoverage); `get(id)` returns full object with all child arrays |
| `src/repo/dynasties.ts` | `listFull()` returns all 20 dynasties with events/culture/recommendedMuseums; `get(id)` same shape |
| `src/routes/museums.ts` | GET `/api/museums`, GET `/api/museums/:id` |
| `src/routes/dynasties.ts` | GET `/api/dynasties`, GET `/api/dynasties/:id` |
| `tests/repo.test.ts` | Field-by-field comparison vs `legacy/data.json` for 1 known museum + 1 known dynasty |
| `tests/routes.test.ts` | Response-shape contract via in-process Elysia handle |

---

## Task 1: Repo types

**Files:**
- Create: `src/repo/types.ts`

- [ ] **Step 1: Write `src/repo/types.ts`**

```typescript
export interface MuseumListItem {
  id: string
  name: string
  lat: number
  lng: number
  level: string | null
  corePeriod: string | null
  dynastyCoverage: string | null
}

export interface MuseumArtifact {
  name: string
  period: string | null
  description: string | null
}

export interface MuseumDynastyConnection {
  dynasty: string
  description: string | null
}

export interface MuseumFull extends MuseumListItem {
  location: string | null
  specialty: string | null
  timeline: string | null
  treasures: string[]
  halls: string[]
  artifacts: MuseumArtifact[]
  dynastyConnections: MuseumDynastyConnection[]
  sources: string[]
}

export interface DynastyEvent {
  date: string
  event: string
  lat: number | null
  lng: number | null
}

export interface DynastyCulture {
  category: string
  description: string | null
}

export interface DynastyRecommendedMuseum {
  museumId: string | null
  name: string
  location: string | null
  reason: string | null
}

export interface DynastyFull {
  id: string
  name: string
  period: string | null
  center: { lat: number | null; lng: number | null }
  overview: string | null
  events: DynastyEvent[]
  culture: DynastyCulture[]
  recommendedMuseums: DynastyRecommendedMuseum[]
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/repo/types.ts
git commit -m "feat(repo): type definitions for museum + dynasty payloads"
```

---

## Task 2: Museums repo — `list()`

**Files:**
- Create: `src/repo/museums.ts`

- [ ] **Step 1: Write the failing test**

Append to (or create) `tests/repo.test.ts`:

```typescript
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { MuseumsRepo } from "~/repo/museums"
import legacyData from "../legacy/data.json"

// Shared Miniflare instance pulling from the wrangler local D1 file
async function getDb() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "museum-map-db" },
    d1Persist: ".wrangler/state/v3/d1",
  })
  return mf.getD1Database("DB")
}

describe("MuseumsRepo.list", () => {
  it("returns 64 museums with list-payload fields", async () => {
    const db = await getDb()
    const repo = new MuseumsRepo(db)
    const list = await repo.list()
    expect(list).toHaveLength(64)
    const first = list[0]!
    expect(first).toHaveProperty("id")
    expect(first).toHaveProperty("name")
    expect(first).toHaveProperty("lat")
    expect(first).toHaveProperty("lng")
    expect(first).toHaveProperty("corePeriod")
    expect(first).toHaveProperty("dynastyCoverage")
  })
})
```

- [ ] **Step 2: Install miniflare**

Run: `bun add -d miniflare`
Expected: dependency added.

- [ ] **Step 3: Run test → FAIL (no repo yet)**

Run: `bun test tests/repo.test.ts`
Expected: FAIL with "MuseumsRepo not found" or import error.

- [ ] **Step 4: Implement `MuseumsRepo.list()`**

Write `src/repo/museums.ts`:

```typescript
import type { MuseumFull, MuseumListItem } from "./types"

export class MuseumsRepo {
  constructor(private db: D1Database) {}

  async list(): Promise<MuseumListItem[]> {
    await this.db.prepare("PRAGMA foreign_keys = ON").run()
    const { results } = await this.db
      .prepare(
        "SELECT id, name, lat, lng, level, core_period AS corePeriod, dynasty_coverage AS dynastyCoverage FROM museums ORDER BY id",
      )
      .all<MuseumListItem>()
    return results
  }

  async get(id: string): Promise<MuseumFull | null> {
    throw new Error("not implemented yet (Task 3)")
  }
}
```

- [ ] **Step 5: Run test → PASS**

Run: `bun test tests/repo.test.ts`
Expected: PASS for the list test.

- [ ] **Step 6: Commit**

```bash
git add src/repo/museums.ts tests/repo.test.ts package.json bun.lockb
git commit -m "feat(repo): MuseumsRepo.list with list-payload fields"
```

---

## Task 3: Museums repo — `get(id)` aggregation

**Files:**
- Modify: `src/repo/museums.ts`
- Modify: `tests/repo.test.ts`

- [ ] **Step 1: Add failing test (field-by-field vs legacy)**

Append to `tests/repo.test.ts`:

```typescript
describe("MuseumsRepo.get", () => {
  it("returns full anhui museum matching legacy/data.json", async () => {
    const db = await getDb()
    const repo = new MuseumsRepo(db)
    const m = await repo.get("anhui")
    expect(m).not.toBeNull()
    const legacy = (legacyData as any).museums.find((x: any) => x.id === "anhui")
    expect(m!.name).toBe(legacy.name)
    expect(m!.lat).toBe(legacy.lat)
    expect(m!.lng).toBe(legacy.lng)
    expect(m!.location).toBe(legacy.location)
    expect(m!.level).toBe(legacy.level)
    expect(m!.corePeriod).toBe(legacy.corePeriod)
    expect(m!.specialty).toBe(legacy.specialty)
    expect(m!.dynastyCoverage).toBe(legacy.dynastyCoverage)
    expect(m!.timeline).toBe(legacy.timeline)
    expect(m!.treasures).toEqual(legacy.treasures)
    expect(m!.halls).toEqual(legacy.halls)
    // artifacts: order + period + description preserved
    expect(m!.artifacts.length).toBe(legacy.artifacts.length)
    legacy.artifacts.forEach((a: any, i: number) => {
      expect(m!.artifacts[i]!.name).toBe(a.name)
      expect(m!.artifacts[i]!.period ?? null).toBe(a.period ?? null)
      expect(m!.artifacts[i]!.description ?? null).toBe(a.description ?? null)
    })
    expect(m!.sources).toEqual(legacy.sources ?? [])
  })

  it("returns null for unknown id", async () => {
    const db = await getDb()
    const repo = new MuseumsRepo(db)
    expect(await repo.get("does-not-exist")).toBeNull()
  })
})
```

- [ ] **Step 2: Run → FAIL ("not implemented yet")**

Run: `bun test tests/repo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `get(id)`**

Replace the `get` method in `src/repo/museums.ts`:

```typescript
async get(id: string): Promise<MuseumFull | null> {
  await this.db.prepare("PRAGMA foreign_keys = ON").run()
  const head = await this.db
    .prepare(
      "SELECT id, name, lat, lng, location, level, core_period AS corePeriod, specialty, dynasty_coverage AS dynastyCoverage, timeline FROM museums WHERE id = ?",
    )
    .bind(id)
    .first<Omit<MuseumFull, "treasures" | "halls" | "artifacts" | "dynastyConnections" | "sources">>()
  if (!head) return null

  const [treasures, halls, artifacts, conns, sources] = await Promise.all([
    this.db.prepare("SELECT name FROM museum_treasures WHERE museum_id = ? ORDER BY order_index").bind(id).all<{ name: string }>(),
    this.db.prepare("SELECT name FROM museum_halls WHERE museum_id = ? ORDER BY order_index").bind(id).all<{ name: string }>(),
    this.db
      .prepare("SELECT name, period, description FROM museum_artifacts WHERE museum_id = ? ORDER BY order_index")
      .bind(id)
      .all<{ name: string; period: string | null; description: string | null }>(),
    this.db
      .prepare("SELECT dynasty, description FROM museum_dynasty_connections WHERE museum_id = ? ORDER BY order_index")
      .bind(id)
      .all<{ dynasty: string; description: string | null }>(),
    this.db.prepare("SELECT source FROM museum_sources WHERE museum_id = ? ORDER BY order_index").bind(id).all<{ source: string }>(),
  ])

  return {
    ...head,
    treasures: treasures.results.map((r) => r.name),
    halls: halls.results.map((r) => r.name),
    artifacts: artifacts.results,
    dynastyConnections: conns.results,
    sources: sources.results.map((r) => r.source),
  }
}
```

- [ ] **Step 4: Run → PASS**

Run: `bun test tests/repo.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repo/museums.ts tests/repo.test.ts
git commit -m "feat(repo): MuseumsRepo.get aggregates all child tables"
```

---

## Task 4: Dynasties repo — `listFull()` + `get(id)`

**Files:**
- Create: `src/repo/dynasties.ts`
- Modify: `tests/repo.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/repo.test.ts`:

```typescript
import { DynastiesRepo } from "~/repo/dynasties"

describe("DynastiesRepo", () => {
  it("listFull returns 20 dynasties in order_index order", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const list = await repo.listFull()
    expect(list).toHaveLength(20)
    const ids = list.map((d) => d.id)
    const expected = (legacyData as any).dynasties.map((d: any) => d.id)
    expect(ids).toEqual(expected)
  })

  it("listFull dynasty.culture is a [{category,description}] array, not a string", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const list = await repo.listFull()
    for (const d of list) {
      expect(Array.isArray(d.culture)).toBe(true)
      expect(d.culture.length).toBeGreaterThan(0)
      expect(typeof d.culture[0]!.category).toBe("string")
    }
  })

  it("listFull each dynasty has events array (preserves order)", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const list = await repo.listFull()
    const tang = list.find((d) => d.id === "tang")
    expect(tang).toBeDefined()
    const legacyTang = (legacyData as any).dynasties.find((d: any) => d.id === "tang")
    expect(tang!.events.length).toBe(legacyTang.events.length)
    expect(tang!.events[0]!.date).toBe(legacyTang.events[0].date)
    expect(tang!.events[0]!.event).toBe(legacyTang.events[0].event)
  })

  it("get(id) returns same shape as a list item", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const single = await repo.get("tang")
    const list = await repo.listFull()
    const fromList = list.find((d) => d.id === "tang")
    expect(single).toEqual(fromList!)
  })

  it("get(id) returns null for unknown id", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    expect(await repo.get("nope")).toBeNull()
  })
})
```

- [ ] **Step 2: Run → FAIL**

Run: `bun test tests/repo.test.ts`
Expected: FAIL (DynastiesRepo missing).

- [ ] **Step 3: Implement `src/repo/dynasties.ts`**

```typescript
import type { DynastyCulture, DynastyEvent, DynastyFull, DynastyRecommendedMuseum } from "./types"

interface DynastyHeadRow {
  id: string
  name: string
  period: string | null
  centerLat: number | null
  centerLng: number | null
  overview: string | null
  orderIndex: number
}

export class DynastiesRepo {
  constructor(private db: D1Database) {}

  async listFull(): Promise<DynastyFull[]> {
    await this.db.prepare("PRAGMA foreign_keys = ON").run()
    const heads = await this.db
      .prepare(
        "SELECT id, name, period, center_lat AS centerLat, center_lng AS centerLng, overview, order_index AS orderIndex FROM dynasties ORDER BY order_index",
      )
      .all<DynastyHeadRow>()

    const [culture, events, recos] = await Promise.all([
      this.db
        .prepare("SELECT dynasty_id AS dynastyId, category, description FROM dynasty_culture ORDER BY dynasty_id, order_index")
        .all<{ dynastyId: string } & DynastyCulture>(),
      this.db
        .prepare("SELECT dynasty_id AS dynastyId, date, event, lat, lng FROM dynasty_events ORDER BY dynasty_id, order_index")
        .all<{ dynastyId: string } & DynastyEvent>(),
      this.db
        .prepare(
          "SELECT dynasty_id AS dynastyId, museum_id AS museumId, name, location, reason FROM dynasty_recommended_museums ORDER BY dynasty_id, order_index",
        )
        .all<{ dynastyId: string } & DynastyRecommendedMuseum>(),
    ])

    const cultureBy = groupBy(culture.results, "dynastyId")
    const eventsBy = groupBy(events.results, "dynastyId")
    const recosBy = groupBy(recos.results, "dynastyId")

    return heads.results.map((h) => ({
      id: h.id,
      name: h.name,
      period: h.period,
      center: { lat: h.centerLat, lng: h.centerLng },
      overview: h.overview,
      culture: (cultureBy.get(h.id) ?? []).map(({ dynastyId, ...rest }) => rest),
      events: (eventsBy.get(h.id) ?? []).map(({ dynastyId, ...rest }) => rest),
      recommendedMuseums: (recosBy.get(h.id) ?? []).map(({ dynastyId, ...rest }) => rest),
    }))
  }

  async get(id: string): Promise<DynastyFull | null> {
    const list = await this.listFull()
    return list.find((d) => d.id === id) ?? null
  }
}

function groupBy<T extends Record<K, string>, K extends string>(rows: T[], key: K): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const row of rows) {
    const k = row[key]
    const arr = m.get(k)
    if (arr) arr.push(row)
    else m.set(k, [row])
  }
  return m
}
```

- [ ] **Step 4: Run → PASS**

Run: `bun test tests/repo.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repo/dynasties.ts tests/repo.test.ts
git commit -m "feat(repo): DynastiesRepo.listFull + get with culture/events/recommended"
```

---

## Task 5: Wire Elysia ctx → routes/museums.ts

**Files:**
- Modify: `src/index.ts`
- Create: `src/routes/museums.ts`

- [ ] **Step 1: Replace `src/index.ts` with bindings derive + route mount**

```typescript
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { museumsRoute } from "~/routes/museums"

export interface Env {
  DB: D1Database
  RATE: KVNamespace
  RATE_PER_MIN?: string
  RATE_PER_DAY?: string
  GLOBAL_PER_DAY?: string
  COPILOT_GATEWAY_URL?: string
  COPILOT_GATEWAY_KEY?: string
}

export function createApp(env: Env) {
  return new Elysia({ aot: false })
    .use(cors())
    .decorate("env", env)
    .get("/health", () => ({ status: "ok" }))
    .use(museumsRoute)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createApp(env).handle(request)
  },
}
```

- [ ] **Step 2: Write the failing route test**

Create `tests/routes.test.ts`:

```typescript
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "museum-map-db" },
    d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"],
  })
  const DB = await mf.getD1Database("DB")
  const RATE = await mf.getKVNamespace("RATE")
  return { DB, RATE } as any
}

describe("GET /api/museums", () => {
  it("returns 64 list items each with corePeriod and dynastyCoverage", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/museums"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as any[]
    expect(body).toHaveLength(64)
    expect(body[0]).toHaveProperty("corePeriod")
    expect(body[0]).toHaveProperty("dynastyCoverage")
    expect(body[0]).toHaveProperty("lat")
    expect(body[0]).toHaveProperty("lng")
  })
})

describe("GET /api/museums/:id", () => {
  it("returns full museum with all child arrays", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/museums/anhui"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.id).toBe("anhui")
    expect(Array.isArray(body.treasures)).toBe(true)
    expect(Array.isArray(body.artifacts)).toBe(true)
    expect(Array.isArray(body.dynastyConnections)).toBe(true)
    expect(Array.isArray(body.sources)).toBe(true)
    expect(body.artifacts[0]).toHaveProperty("period")
  })

  it("returns 404 for unknown id", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/museums/nope"))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 3: Run → FAIL (no museumsRoute)**

Run: `bun test tests/routes.test.ts`
Expected: FAIL (import error or 404 on the list endpoint).

- [ ] **Step 4: Implement `src/routes/museums.ts`**

```typescript
import { Elysia } from "elysia"
import { MuseumsRepo } from "~/repo/museums"
import type { Env } from "~/index"

export const museumsRoute = new Elysia()
  .get("/api/museums", async ({ env }: { env: Env }) => {
    const repo = new MuseumsRepo(env.DB)
    return await repo.list()
  })
  .get("/api/museums/:id", async ({ env, params, set }: { env: Env; params: { id: string }; set: any }) => {
    const repo = new MuseumsRepo(env.DB)
    const m = await repo.get(params.id)
    if (!m) {
      set.status = 404
      return { error: "not_found" }
    }
    return m
  })
```

- [ ] **Step 5: Run → PASS**

Run: `bun test tests/routes.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/routes/museums.ts tests/routes.test.ts
git commit -m "feat(routes): GET /api/museums and /api/museums/:id"
```

---

## Task 6: routes/dynasties.ts

**Files:**
- Create: `src/routes/dynasties.ts`
- Modify: `src/index.ts`
- Modify: `tests/routes.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/routes.test.ts`:

```typescript
describe("GET /api/dynasties", () => {
  it("returns 20 dynasties with culture as array of {category,description}", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/dynasties"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as any[]
    expect(body).toHaveLength(20)
    for (const d of body) {
      expect(Array.isArray(d.culture)).toBe(true)
      expect(d.culture.length).toBeGreaterThan(0)
      expect(typeof d.culture[0].category).toBe("string")
    }
  })

  it("each dynasty has events and recommendedMuseums arrays", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/dynasties"))
    const body = (await res.json()) as any[]
    for (const d of body) {
      expect(Array.isArray(d.events)).toBe(true)
      expect(Array.isArray(d.recommendedMuseums)).toBe(true)
    }
  })
})

describe("GET /api/dynasties/:id", () => {
  it("returns same shape as list item", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const listRes = await app.handle(new Request("http://localhost/api/dynasties"))
    const list = (await listRes.json()) as any[]
    const fromList = list.find((d) => d.id === "tang")

    const oneRes = await app.handle(new Request("http://localhost/api/dynasties/tang"))
    expect(oneRes.status).toBe(200)
    const one = await oneRes.json()
    expect(one).toEqual(fromList)
  })

  it("returns 404 for unknown id", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/dynasties/nope"))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run → FAIL**

Run: `bun test tests/routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `src/routes/dynasties.ts`**

```typescript
import { Elysia } from "elysia"
import { DynastiesRepo } from "~/repo/dynasties"
import type { Env } from "~/index"

export const dynastiesRoute = new Elysia()
  .get("/api/dynasties", async ({ env }: { env: Env }) => {
    const repo = new DynastiesRepo(env.DB)
    return await repo.listFull()
  })
  .get("/api/dynasties/:id", async ({ env, params, set }: { env: Env; params: { id: string }; set: any }) => {
    const repo = new DynastiesRepo(env.DB)
    const d = await repo.get(params.id)
    if (!d) {
      set.status = 404
      return { error: "not_found" }
    }
    return d
  })
```

- [ ] **Step 4: Mount in `src/index.ts`**

Edit `src/index.ts` — add import and `.use()`:

```typescript
import { dynastiesRoute } from "~/routes/dynasties"
// ... in createApp:
    .use(museumsRoute)
    .use(dynastiesRoute)
```

- [ ] **Step 5: Run → PASS**

Run: `bun test tests/routes.test.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/dynasties.ts src/index.ts tests/routes.test.ts
git commit -m "feat(routes): GET /api/dynasties and /api/dynasties/:id"
```

---

## Task 7: End-to-end smoke via wrangler dev

**Files:** _(none)_

- [ ] **Step 1: Run dev**

Run: `bun run dev` (background)
Then in another terminal:
```
curl -s http://localhost:4242/api/museums | head -c 200
curl -s http://localhost:4242/api/museums/anhui | head -c 200
curl -s http://localhost:4242/api/dynasties | head -c 200
```
Expected: each returns valid JSON, no 500. Stop dev.

- [ ] **Step 2: Final typecheck**

Run: `bun run typecheck`
Expected: no errors.

---

## Self-Review Checklist

- `MuseumsRepo.list()` returns `corePeriod` + `dynastyCoverage` (sidebar contract from spec §5) ✓
- `MuseumsRepo.get()` returns `artifacts[].period` ✓
- `DynastiesRepo.listFull()` returns `culture` as `[{category, description}]` array, not flattened ✓
- `/api/dynasties/:id` returns identical shape to a list item ✓
- All 4 endpoints have route tests ✓
- 404 paths covered ✓
- No chat/UI logic introduced (those are plans 03/04) ✓

---

## Hand-off

When all tasks pass: API layer is complete. Plan 03 (Chat guard + rate limit) and Plan 04 (UI) can both depend on this.
