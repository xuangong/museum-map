# Museum Map Modernization · Plan 05 · Local Dev (`bun run local`) + Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the second local-dev mode `bun --hot run src/local.ts` that talks to **remote** D1 + KV via Cloudflare REST APIs, with explicit `.env.local` credential loading. Wire deploy. Document the dual-mode contract in README.

**Architecture:** `src/local.ts` reads `.env.local`, validates required vars (D1/KV), constructs adapter objects that implement the `D1Database` + `KVNamespace` shapes the rest of the code uses (only the methods we actually call: `prepare().bind().all/first/run`, `get/put`). Hands them to `createApp(env)` from Plan 02. Chat is auto-503 if `COPILOT_GATEWAY_*` missing.

**Tech Stack:** Bun, fetch (Cloudflare REST), Elysia (re-using createApp).

**Spec reference:** §8 (deploy + dual-mode), §8.1.1 (credential contract), §8.2 (mode contract).

**Depends on:** Plans 01-04 complete.

---

## File Structure

| File | Purpose |
|---|---|
| `src/local/d1Adapter.ts` | D1Database-shaped adapter calling Cloudflare D1 REST API |
| `src/local/kvAdapter.ts` | KVNamespace-shaped adapter calling Cloudflare KV REST API |
| `src/local/env.ts` | `.env.local` reader + required-var validation + structured error |
| `src/local.ts` | Wires adapters → createApp → bun listen + colored request log |
| `.env.local.example` | Documented template (committed) |
| `.gitignore` | Add `.env.local` (was added in Plan 01 already; verify) |
| `README.md` | Dual-mode quick-start + cheat sheet |
| `tests/local-env.test.ts` | env loader: required-var error, optional vars, DISABLE_CHAT flag |

---

## Task 1: env loader

**Files:**
- Create: `src/local/env.ts`
- Create: `tests/local-env.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "bun:test"
import { loadLocalEnv } from "~/local/env"

describe("loadLocalEnv", () => {
  it("throws if D1/KV credentials missing", () => {
    expect(() =>
      loadLocalEnv({}, {
        CLOUDFLARE_ACCOUNT_ID: undefined,
        CLOUDFLARE_API_TOKEN: undefined,
        D1_DATABASE_ID: undefined,
        KV_RATE_NAMESPACE_ID: undefined,
      } as any),
    ).toThrow(/missing env/i)
  })

  it("returns parsed env when all required vars present", () => {
    const env = loadLocalEnv({}, {
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_API_TOKEN: "tok",
      D1_DATABASE_ID: "db",
      KV_RATE_NAMESPACE_ID: "kv",
    } as any)
    expect(env.cf.accountId).toBe("acc")
    expect(env.cf.token).toBe("tok")
    expect(env.cf.d1Id).toBe("db")
    expect(env.cf.kvId).toBe("kv")
    expect(env.disableChat).toBe(false)
    expect(env.gatewayUrl).toBeUndefined()
  })

  it("DISABLE_CHAT=1 marks chat disabled", () => {
    const env = loadLocalEnv({}, {
      CLOUDFLARE_ACCOUNT_ID: "a",
      CLOUDFLARE_API_TOKEN: "t",
      D1_DATABASE_ID: "d",
      KV_RATE_NAMESPACE_ID: "k",
      DISABLE_CHAT: "1",
    } as any)
    expect(env.disableChat).toBe(true)
  })

  it("PORT defaults to 4242 if missing", () => {
    const env = loadLocalEnv({}, {
      CLOUDFLARE_ACCOUNT_ID: "a", CLOUDFLARE_API_TOKEN: "t",
      D1_DATABASE_ID: "d", KV_RATE_NAMESPACE_ID: "k",
    } as any)
    expect(env.port).toBe(4242)
  })
})
```

- [ ] **Step 2: Implement `src/local/env.ts`**

```typescript
export interface LocalEnv {
  cf: { accountId: string; token: string; d1Id: string; kvId: string }
  gatewayUrl?: string
  gatewayKey?: string
  disableChat: boolean
  port: number
}

const REQUIRED = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "D1_DATABASE_ID", "KV_RATE_NAMESPACE_ID"] as const

/** dotenv: keys override file; file overrides nothing — caller passes whichever they want as authority. */
export function loadLocalEnv(fileEnv: Record<string, string>, processEnv: Record<string, string | undefined>): LocalEnv {
  const merged: Record<string, string | undefined> = { ...fileEnv, ...processEnv }
  const missing = REQUIRED.filter((k) => !merged[k] || merged[k] === "")
  if (missing.length > 0) {
    throw new Error(`[local] missing env: ${missing.join(", ")}`)
  }
  return {
    cf: {
      accountId: merged.CLOUDFLARE_ACCOUNT_ID!,
      token: merged.CLOUDFLARE_API_TOKEN!,
      d1Id: merged.D1_DATABASE_ID!,
      kvId: merged.KV_RATE_NAMESPACE_ID!,
    },
    gatewayUrl: merged.COPILOT_GATEWAY_URL,
    gatewayKey: merged.COPILOT_GATEWAY_KEY,
    disableChat: merged.DISABLE_CHAT === "1",
    port: Number(merged.PORT ?? "4242"),
  }
}

export async function readEnvFile(path = ".env.local"): Promise<Record<string, string>> {
  const file = Bun.file(path)
  if (!(await file.exists())) return {}
  const text = await file.text()
  const out: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}
```

- [ ] **Step 3: Run → PASS**

Run: `bun test tests/local-env.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/local/env.ts tests/local-env.test.ts
git commit -m "feat(local): env loader (.env.local + required-var validation)"
```

---

## Task 2: D1 REST adapter

**Files:**
- Create: `src/local/d1Adapter.ts`

> No automated test in this plan — D1 REST hits real network. We rely on the read-loop smoke (Task 5) and existing route tests (which use Miniflare locally, unrelated). The adapter only implements the D1 surface methods the codebase actually calls: `prepare(sql).bind(...).all<T>() / .first<T>() / .run()`, plus the `PRAGMA foreign_keys = ON` no-op (D1 always has it on for prepared statements once the connection is opened — but for explicit pragma-style `prepare("PRAGMA ...").run()`, the adapter just resolves successfully).

- [ ] **Step 1: Write `src/local/d1Adapter.ts`**

```typescript
interface RawResp {
  result: Array<{ results?: any[]; meta?: any; success?: boolean }>
  success: boolean
  errors?: any[]
}

export interface D1Adapter {
  prepare(sql: string): D1AdapterStatement
}

export interface D1AdapterStatement {
  bind(...params: any[]): D1AdapterStatement
  all<T = any>(): Promise<{ results: T[] }>
  first<T = any>(): Promise<T | null>
  run(): Promise<{ success: boolean }>
}

class Statement implements D1AdapterStatement {
  private params: any[] = []
  constructor(private endpoint: string, private token: string, private sql: string) {}

  bind(...params: any[]): D1AdapterStatement {
    this.params = params
    return this
  }

  private async exec(): Promise<any[]> {
    // Skip real call for PRAGMA — D1 REST rejects multi-stmt; pragma is no-op here.
    if (/^\s*PRAGMA\b/i.test(this.sql)) return []
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ sql: this.sql, params: this.params }),
    })
    if (!res.ok) throw new Error(`[d1Adapter] HTTP ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as RawResp
    if (!json.success) throw new Error(`[d1Adapter] D1 error: ${JSON.stringify(json.errors)}`)
    return json.result?.[0]?.results ?? []
  }

  async all<T = any>(): Promise<{ results: T[] }> {
    return { results: (await this.exec()) as T[] }
  }
  async first<T = any>(): Promise<T | null> {
    const rows = await this.exec()
    return (rows[0] as T) ?? null
  }
  async run(): Promise<{ success: boolean }> {
    await this.exec()
    return { success: true }
  }
}

export function makeD1Adapter(opts: { accountId: string; token: string; d1Id: string }): D1Adapter {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/d1/database/${opts.d1Id}/query`
  return {
    prepare(sql: string): D1AdapterStatement {
      return new Statement(endpoint, opts.token, sql)
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/local/d1Adapter.ts
git commit -m "feat(local): D1 REST adapter (prepare/bind/all/first/run + PRAGMA no-op)"
```

---

## Task 3: KV REST adapter

**Files:**
- Create: `src/local/kvAdapter.ts`

- [ ] **Step 1: Write `src/local/kvAdapter.ts`**

```typescript
export interface KVAdapter {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

export function makeKVAdapter(opts: { accountId: string; token: string; kvId: string }): KVAdapter {
  const base = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/storage/kv/namespaces/${opts.kvId}`
  return {
    async get(key: string): Promise<string | null> {
      const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, {
        headers: { authorization: `Bearer ${opts.token}` },
      })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`[kvAdapter] GET ${res.status}: ${await res.text()}`)
      return await res.text()
    },
    async put(key: string, value: string, putOpts?: { expirationTtl?: number }): Promise<void> {
      const url = new URL(`${base}/values/${encodeURIComponent(key)}`)
      if (putOpts?.expirationTtl) url.searchParams.set("expiration_ttl", String(putOpts.expirationTtl))
      const res = await fetch(url, {
        method: "PUT",
        headers: { authorization: `Bearer ${opts.token}`, "content-type": "text/plain" },
        body: value,
      })
      if (!res.ok) throw new Error(`[kvAdapter] PUT ${res.status}: ${await res.text()}`)
    },
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/local/kvAdapter.ts
git commit -m "feat(local): KV REST adapter (get/put with expiration_ttl)"
```

---

## Task 4: Local entrypoint

**Files:**
- Create: `src/local.ts`
- Modify: `package.json` (add `local` script)
- Modify: `src/routes/chat.ts` (honor `DISABLE_CHAT`)

- [ ] **Step 1: Update `package.json` scripts**

Add to scripts:

```json
"local": "bun --hot run src/local.ts"
```

- [ ] **Step 2: Modify `src/routes/chat.ts` to honor `DISABLE_CHAT` flag from env**

Add at the top of the route handler, before the gateway check:

```typescript
if ((env as any).DISABLE_CHAT === "1") {
  set.status = 503
  return { error: "chat disabled in this mode, use `bun run dev` instead" }
}
```

- [ ] **Step 3: Write `src/local.ts`**

```typescript
import { loadLocalEnv, readEnvFile } from "~/local/env"
import { makeD1Adapter } from "~/local/d1Adapter"
import { makeKVAdapter } from "~/local/kvAdapter"
import { createApp, type Env } from "~/index"

const colors = {
  reset: "\x1b[0m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m",
}

function statusColor(s: number): string {
  if (s >= 500) return colors.red
  if (s >= 400) return colors.yellow
  if (s >= 300) return colors.cyan
  return colors.green
}

async function main() {
  let env
  try {
    const fileEnv = await readEnvFile(".env.local")
    env = loadLocalEnv(fileEnv, process.env as any)
  } catch (e: any) {
    console.error(e?.message ?? String(e))
    process.exit(1)
  }

  console.log(`${colors.dim}[local]${colors.reset} D1 ${env.cf.d1Id.slice(0, 8)}…  KV ${env.cf.kvId.slice(0, 8)}…  chat ${
    env.disableChat ? colors.yellow + "disabled" : env.gatewayUrl ? colors.green + "enabled" : colors.yellow + "no-gateway"
  }${colors.reset}`)

  const DB = makeD1Adapter(env.cf) as any as D1Database
  const RATE = makeKVAdapter(env.cf) as any as KVNamespace

  const appEnv: Env = {
    DB, RATE,
    RATE_PER_MIN: "10", RATE_PER_DAY: "100", GLOBAL_PER_DAY: "5000",
    COPILOT_GATEWAY_URL: env.gatewayUrl,
    COPILOT_GATEWAY_KEY: env.gatewayKey,
    ...(env.disableChat ? { DISABLE_CHAT: "1" } as any : {}),
  } as any

  // Smoke check: SELECT count(*) so the user gets an early error if the DB is empty
  try {
    const result = await DB.prepare("SELECT count(*) AS c FROM museums").first<{ c: number }>()
    if (!result || result.c === 0) {
      console.warn(`${colors.yellow}[local] museums table is empty — run \`bun run seed --target=remote\`${colors.reset}`)
    } else {
      console.log(`${colors.dim}[local] museums: ${result.c}${colors.reset}`)
    }
  } catch (e: any) {
    console.error(`${colors.red}[local] DB check failed: ${e?.message ?? e}${colors.reset}`)
  }

  const app = createApp(appEnv)

  // simple per-request log
  const wrapped = {
    async fetch(req: Request): Promise<Response> {
      const t0 = performance.now()
      const path = new URL(req.url).pathname
      const res = await app.handle(req)
      const dt = (performance.now() - t0).toFixed(1)
      console.log(
        `${colors.dim}${new Date().toISOString().slice(11, 19)}${colors.reset} ${req.method.padEnd(6)} ${statusColor(res.status)}${res.status}${colors.reset} ${dt}ms ${path}`,
      )
      return res
    },
  }

  Bun.serve({ port: env.port, fetch: wrapped.fetch })
  console.log(`${colors.green}🍵 museum-map (local) at http://localhost:${env.port}${colors.reset}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: no errors. (If `DISABLE_CHAT` field complains on Env, broaden the type in `src/index.ts` to include `DISABLE_CHAT?: string`.)

- [ ] **Step 5: Commit**

```bash
git add src/local.ts src/routes/chat.ts package.json
git commit -m "feat(local): bun --hot entrypoint with D1+KV REST adapters"
```

---

## Task 5: `.env.local.example` + `.gitignore`

**Files:**
- Create: `.env.local.example`
- Verify: `.gitignore` includes `.env.local`

- [ ] **Step 1: Write `.env.local.example`**

```
# museum-map · local mode credentials
# Required (cannot start `bun run local` without these)
CLOUDFLARE_ACCOUNT_ID=
# Token must have: D1:Edit + Workers KV Storage:Edit
CLOUDFLARE_API_TOKEN=
D1_DATABASE_ID=
KV_RATE_NAMESPACE_ID=

# Optional — chat will return 503 if missing
COPILOT_GATEWAY_URL=https://token.xianliao.de5.net
COPILOT_GATEWAY_KEY=

# Optional — force-disable chat in this mode (use `bun run dev` for full chat)
# DISABLE_CHAT=1

# Optional — defaults to 4242
# PORT=4242
```

- [ ] **Step 2: Verify `.gitignore`**

Run: `grep -F .env.local .gitignore` (or use Read tool); expected: `.env.local` listed. If not, add it.

- [ ] **Step 3: Commit**

```bash
git add .env.local.example .gitignore
git commit -m "chore: .env.local.example with permission notes"
```

---

## Task 6: Remote seed + deploy + secrets

**Files:** _(none — operational steps; record outcomes in commits)_

- [ ] **Step 1: Apply migrations to remote D1**

Run: `bunx wrangler d1 migrations apply museum-map-db --remote`
Expected: 0001_init.sql reported applied.

- [ ] **Step 2: Seed remote**

Run: `bun run seed -- --target=remote`
Expected: completes without error; reports row counts.

- [ ] **Step 3: Set Worker secrets**

Run (interactive — paste values when prompted):
```
bunx wrangler secret put COPILOT_GATEWAY_URL
bunx wrangler secret put COPILOT_GATEWAY_KEY
```

- [ ] **Step 4: Deploy**

Run: `bunx wrangler deploy`
Expected: deployment URL printed (e.g. `https://museum-map.<sub>.workers.dev`).

- [ ] **Step 5: Smoke deployed app**

Run:
```
curl -s https://museum-map.<sub>.workers.dev/api/museums | head -c 200
curl -s -X POST https://museum-map.<sub>.workers.dev/api/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"用一句话介绍西安"}]}' | head -c 400
```
Expected: museums returns JSON list; chat returns Anthropic-shaped response (or 503 if gateway secrets weren't set).

- [ ] **Step 6: Test rate limit on production**

Run a quick burst (12 requests):
```
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://museum-map.<sub>.workers.dev/api/chat \
    -H 'content-type: application/json' \
    -d '{"messages":[{"role":"user","content":"hi"}]}'
done
```
Expected: at least one 429 in the last 3 responses (best-effort; verifies KV limit live).

---

## Task 7: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# museum-map

中国历史博物馆地图（Bun + Elysia + Cloudflare Workers + D1）。

## 快速开始（推荐：wrangler dev 模式，全功能）

```bash
bun install
bunx wrangler d1 create museum-map-db        # 把返回的 database_id 填进 wrangler.toml
bunx wrangler kv namespace create RATE       # 同上，填 id 进 [[kv_namespaces]]
bunx wrangler secret put COPILOT_GATEWAY_URL
bunx wrangler secret put COPILOT_GATEWAY_KEY
bun run seed                                 # 灌 64 馆 + 20 朝代到本地 D1
bun run dev                                  # http://localhost:4242
```

## 第二种：bun --hot 直跑（连远程 D1，热重载，仅适合改 UI）

```bash
cp .env.local.example .env.local             # 填 CLOUDFLARE_*、D1_DATABASE_ID、KV_RATE_NAMESPACE_ID
bun run local                                # http://localhost:4242
```

| 模式 | 命令 | DB | KV | chat |
|---|---|---|---|---|
| dev（推荐） | `bun run dev` | 本地 SQLite | 本地 | ✅ 全功能 |
| local | `bun run local` | 远程 D1（REST） | 远程 KV（REST） | ⚠️ 受限（缺 gateway 时 503） |

两套数据库**完全分离**：本地 seed 不影响远程，反之亦然。

## 部署

```bash
bun run seed -- --target=remote              # 仅首次/数据更新时
bunx wrangler deploy
```

## 测试

```bash
bun test                                     # repo / routes / coords / chat-guard / rate-limit / seed
bun run typecheck
```

## 项目结构

```
src/
├── index.ts            createApp + Workers fetch handler
├── local.ts            bun --hot 入口（D1/KV REST 适配器）
├── lib/                cdn 代理、html 模板、getClientIp、rateLimit
├── repo/               museums + dynasties 聚合
├── services/chat.ts    chat 字段白名单 + 转发 + 错误脱敏
├── routes/             home + museums + dynasties + chat
└── ui/                 layout + theme + components + client/{coords,map,app,chat}
```

设计文档：`docs/superpowers/specs/2026-04-30-museum-map-modernization-design.md`
实施计划：`docs/superpowers/plans/2026-04-30-museum-map-0[1-5]-*.md`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README quick-start with dual-mode contract"
```

---

## Self-Review Checklist

- `.env.local` cannot start without 4 required vars (clear error message) ✓
- `bun --hot run src/local.ts` is the actual command behind `bun run local` ✓
- `getClientIp` works in Bun mode (xff fallback, unchanged from Plan 03) ✓
- DISABLE_CHAT=1 short-circuits chat with explicit message ✓
- Empty-DB warning at startup tells user to run `seed --target=remote` ✓
- `.env.local` in `.gitignore`; `.env.local.example` committed ✓
- README documents both modes + completely-separated DB warning ✓
- Production smoke includes rate-limit verification ✓

---

## Hand-off

When tasks pass: museum-map runs locally in two modes, deploys to Workers, seeds either local or remote D1. The full migration is complete.

## Final Acceptance (matches spec §10)

- [x] 64 museums on map + sidebar
- [x] 20 dynasties on timeline (drag/click)
- [x] Drawer shows full museum fields (artifacts/period, dynastyConnections, sources)
- [x] Chat round-trip works (non-streaming, matches legacy contract)
- [x] Visual: 宣纸 vs legacy cyber-blue is unmistakable
- [x] `wrangler dev` and `wrangler deploy` both run
- [x] `bun test` covers all 18+ test points from spec §10.1
