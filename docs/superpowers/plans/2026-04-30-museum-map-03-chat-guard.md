# Museum Map Modernization · Plan 03 · Chat Guard + Rate Limit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-side chat proxy that forwards browser requests to the upstream copilot-api-gateway `/v1/messages` endpoint with strict guardrails — field whitelist, payload caps, KV-backed best-effort rate limiting, error sanitization. Eliminates the legacy hardcoded API key in the frontend.

**Architecture:** Three layers:
1. `lib/getClientIp.ts` — environment-agnostic IP extraction (Worker `cf.connectingIp` → Bun `x-forwarded-for` → `127.0.0.1`)
2. `lib/rateLimit.ts` — KV time-bucket counter (key format `rate:ip:<ip>:min:<YYYYMMDDHHmm>` etc.); `get → +1 → put({expirationTtl})`. Best-effort, accepts ±1~2 race error.
3. `services/chat.ts` — strip non-whitelisted fields, force-set `model`/`max_tokens`/`stream`, validate payload sizes/lengths, run rate limit, fetch upstream, sanitize errors.

Route is wired only when `COPILOT_GATEWAY_URL` + `COPILOT_GATEWAY_KEY` are set; otherwise returns `503 {error: "chat unavailable: gateway not configured"}`.

**Tech Stack:** Elysia, KV, fetch.

**Spec reference:** §5.1 (chat 转发实现), §10.1 (chat-guard.test.ts + rate-limit.test.ts).

**Depends on:** Plan 01 (KV binding `RATE`), Plan 02 (`src/index.ts` createApp).

---

## File Structure

| File | Purpose |
|---|---|
| `src/lib/getClientIp.ts` | `(ctx) => string` env-agnostic IP extraction |
| `src/lib/rateLimit.ts` | `checkAndIncrement(kv, key, limit, ttlSec)` returns `{ok, count}` |
| `src/services/chat.ts` | Validate request → run rate limits → forward upstream → sanitize errors |
| `src/routes/chat.ts` | POST `/api/chat` |
| `tests/chat-guard.test.ts` | Whitelist + size/length caps + error sanitization |
| `tests/rate-limit.test.ts` | Per-IP/min, per-IP/day, global/day, TTL bucket key format |

---

## Task 1: getClientIp helper

**Files:**
- Create: `src/lib/getClientIp.ts`
- Create: `tests/getClientIp.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "bun:test"
import { getClientIp } from "~/lib/getClientIp"

describe("getClientIp", () => {
  it("prefers cf.connectingIp when present (Worker mode)", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "9.9.9.9" } })
    ;(req as any).cf = { connectingIp: "1.2.3.4" }
    expect(getClientIp(req)).toBe("1.2.3.4")
  })

  it("falls back to x-forwarded-for when cf missing (Bun mode)", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "5.6.7.8" } })
    expect(getClientIp(req)).toBe("5.6.7.8")
  })

  it("uses first IP in x-forwarded-for chain", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } })
    expect(getClientIp(req)).toBe("1.1.1.1")
  })

  it("returns 127.0.0.1 when nothing available", () => {
    const req = new Request("http://x/")
    expect(getClientIp(req)).toBe("127.0.0.1")
  })
})
```

- [ ] **Step 2: Run → FAIL**

Run: `bun test tests/getClientIp.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```typescript
// src/lib/getClientIp.ts
export function getClientIp(req: Request): string {
  const cf = (req as any).cf
  if (cf?.connectingIp && typeof cf.connectingIp === "string") return cf.connectingIp
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return "127.0.0.1"
}
```

- [ ] **Step 4: Run → PASS**

Run: `bun test tests/getClientIp.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/getClientIp.ts tests/getClientIp.test.ts
git commit -m "feat(lib): getClientIp helper (worker cf.connectingIp + bun xff fallback)"
```

---

## Task 2: Rate limit helper

**Files:**
- Create: `src/lib/rateLimit.ts`
- Create: `tests/rate-limit.test.ts`

- [ ] **Step 1: Write failing tests (in-memory KV mock)**

```typescript
import { describe, it, expect, beforeEach } from "bun:test"
import { checkAndIncrement, bucketKey } from "~/lib/rateLimit"

class MemKV {
  store = new Map<string, { v: string; exp: number | null }>()
  async get(key: string): Promise<string | null> {
    const e = this.store.get(key)
    if (!e) return null
    if (e.exp && Date.now() / 1000 > e.exp) {
      this.store.delete(key)
      return null
    }
    return e.v
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const exp = opts?.expirationTtl ? Date.now() / 1000 + opts.expirationTtl : null
    this.store.set(key, { v: String(value), exp })
  }
}

describe("rateLimit", () => {
  let kv: MemKV
  beforeEach(() => {
    kv = new MemKV()
  })

  it("allows under limit and increments count", async () => {
    const r1 = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r1.ok).toBe(true)
    expect(r1.count).toBe(1)
    const r2 = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r2.ok).toBe(true)
    expect(r2.count).toBe(2)
    const r3 = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r3.ok).toBe(true)
    expect(r3.count).toBe(3)
  })

  it("denies when over limit", async () => {
    for (let i = 0; i < 3; i++) await checkAndIncrement(kv as any, "k", 3, 60)
    const r = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r.ok).toBe(false)
  })

  it("bucketKey format includes ip and time bucket", () => {
    const d = new Date(Date.UTC(2026, 3, 30, 12, 34))
    expect(bucketKey("min", "1.2.3.4", d)).toBe("rate:ip:1.2.3.4:min:202604301234")
    expect(bucketKey("day", "1.2.3.4", d)).toBe("rate:ip:1.2.3.4:day:20260430")
    expect(bucketKey("global-day", null, d)).toBe("rate:global:day:20260430")
  })
})
```

- [ ] **Step 2: Run → FAIL**

Run: `bun test tests/rate-limit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/rateLimit.ts`**

```typescript
export interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

export type Bucket = "min" | "day" | "global-day"

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0")
}

export function bucketKey(bucket: Bucket, ip: string | null, when: Date = new Date()): string {
  const y = when.getUTCFullYear()
  const m = pad(when.getUTCMonth() + 1)
  const d = pad(when.getUTCDate())
  const h = pad(when.getUTCHours())
  const min = pad(when.getUTCMinutes())
  if (bucket === "min") return `rate:ip:${ip}:min:${y}${m}${d}${h}${min}`
  if (bucket === "day") return `rate:ip:${ip}:day:${y}${m}${d}`
  return `rate:global:day:${y}${m}${d}`
}

export interface RateResult {
  ok: boolean
  count: number
}

/**
 * Best-effort rate limiter. Race conditions can under-count by 1-2;
 * accepted per spec §5.1 (configured via vars, not for billing).
 */
export async function checkAndIncrement(
  kv: KVLike,
  key: string,
  limit: number,
  ttlSec: number,
): Promise<RateResult> {
  const cur = Number((await kv.get(key)) ?? "0")
  if (cur >= limit) return { ok: false, count: cur }
  const next = cur + 1
  await kv.put(key, String(next), { expirationTtl: ttlSec })
  return { ok: true, count: next }
}
```

- [ ] **Step 4: Run → PASS**

Run: `bun test tests/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Add integration-style limit tests (per spec §10.1)**

Append to `tests/rate-limit.test.ts`:

```typescript
import { runRateLimits } from "~/services/chat"

describe("runRateLimits (per-IP min/day + global day)", () => {
  it("12 serial calls in same minute: at least one denied (best-effort)", async () => {
    const kv = new MemKV()
    let denied = 0
    let earlyOk = 0
    for (let i = 0; i < 12; i++) {
      const r = await runRateLimits(kv as any, "1.1.1.1", { perMin: 10, perDay: 100, globalPerDay: 5000 })
      if (!r.ok) denied++
      else if (i < 9) earlyOk++
    }
    expect(denied).toBeGreaterThanOrEqual(1)
    expect(earlyOk).toBe(9) // first 9 must succeed
  })

  it("110 serial calls in one day: last 5 contain at least one 429", async () => {
    const kv = new MemKV()
    for (let i = 0; i < 105; i++) await runRateLimits(kv as any, "2.2.2.2", { perMin: 10000, perDay: 100, globalPerDay: 5000 })
    let denied = 0
    for (let i = 0; i < 5; i++) {
      const r = await runRateLimits(kv as any, "2.2.2.2", { perMin: 10000, perDay: 100, globalPerDay: 5000 })
      if (!r.ok && r.reason === "ip_day") denied++
    }
    expect(denied).toBeGreaterThanOrEqual(1)
  })

  it("global day limit triggers after 5000 distinct-IP serial calls", async () => {
    const kv = new MemKV()
    for (let i = 0; i < 4990; i++) await runRateLimits(kv as any, `ip-${i}`, { perMin: 10000, perDay: 10000, globalPerDay: 5000 })
    let glob = 0
    for (let i = 4990; i < 5020; i++) {
      const r = await runRateLimits(kv as any, `ip-${i}`, { perMin: 10000, perDay: 10000, globalPerDay: 5000 })
      if (!r.ok && r.reason === "global_day") glob++
    }
    expect(glob).toBeGreaterThanOrEqual(1)
  })
})
```

(`runRateLimits` will be implemented in Task 4; tests stay red until then.)

- [ ] **Step 6: Commit (helper only; integration tests still red)**

```bash
git add src/lib/rateLimit.ts tests/rate-limit.test.ts
git commit -m "feat(lib): KV best-effort rate limiter with bucket key format"
```

---

## Task 3: Chat service — validation + payload guards

**Files:**
- Create: `src/services/chat.ts`
- Create: `tests/chat-guard.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "bun:test"
import { sanitizeChatRequest, ChatGuardError, MAX_MESSAGES_BYTES, MAX_SYSTEM_BYTES, MAX_MESSAGES_LEN } from "~/services/chat"

describe("sanitizeChatRequest", () => {
  it("forces model to claude-haiku-4.5 regardless of input", () => {
    const out = sanitizeChatRequest({ model: "claude-opus-4", messages: [{ role: "user", content: "hi" }] })
    expect(out.model).toBe("claude-haiku-4.5")
  })

  it("forces max_tokens to 1024", () => {
    const out = sanitizeChatRequest({ max_tokens: 99999, messages: [{ role: "user", content: "hi" }] })
    expect(out.max_tokens).toBe(1024)
  })

  it("forces stream to false", () => {
    const out = sanitizeChatRequest({ stream: true, messages: [{ role: "user", content: "hi" }] })
    expect(out.stream).toBe(false)
  })

  it("strips non-whitelisted fields (tools, metadata, top_p, etc.)", () => {
    const out = sanitizeChatRequest({
      messages: [{ role: "user", content: "hi" }],
      system: "you are helpful",
      tools: [{}],
      metadata: { user: "x" },
      top_p: 0.9,
      temperature: 0.7,
    } as any)
    expect(out).not.toHaveProperty("tools")
    expect(out).not.toHaveProperty("metadata")
    expect(out).not.toHaveProperty("top_p")
    expect(out).not.toHaveProperty("temperature")
    expect(out.system).toBe("you are helpful")
  })

  it("rejects messages JSON > 32KB with 413", () => {
    const big = "x".repeat(MAX_MESSAGES_BYTES + 100)
    expect(() => sanitizeChatRequest({ messages: [{ role: "user", content: big }] })).toThrow(ChatGuardError)
    try {
      sanitizeChatRequest({ messages: [{ role: "user", content: big }] })
    } catch (e) {
      expect((e as ChatGuardError).status).toBe(413)
    }
  })

  it("rejects system > 8KB with 413", () => {
    const big = "y".repeat(MAX_SYSTEM_BYTES + 100)
    try {
      sanitizeChatRequest({ system: big, messages: [{ role: "user", content: "hi" }] })
      expect.unreachable()
    } catch (e) {
      expect((e as ChatGuardError).status).toBe(413)
    }
  })

  it("rejects messages.length > 12 with 400", () => {
    const msgs = Array.from({ length: MAX_MESSAGES_LEN + 1 }, (_, i) => ({ role: "user", content: `m${i}` }))
    try {
      sanitizeChatRequest({ messages: msgs })
      expect.unreachable()
    } catch (e) {
      expect((e as ChatGuardError).status).toBe(400)
    }
  })
})
```

- [ ] **Step 2: Run → FAIL**

Run: `bun test tests/chat-guard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/services/chat.ts` (sanitize + types only; rate limits + forward come next)**

```typescript
import { bucketKey, checkAndIncrement, type KVLike } from "~/lib/rateLimit"

export const MODEL = "claude-haiku-4.5"
export const MAX_TOKENS = 1024
export const MAX_MESSAGES_BYTES = 32 * 1024
export const MAX_SYSTEM_BYTES = 8 * 1024
export const MAX_MESSAGES_LEN = 12

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatRequestIn {
  system?: string
  messages: ChatMessage[]
  // anything else is ignored
}

export interface ChatRequestOut {
  model: string
  max_tokens: number
  stream: false
  system?: string
  messages: ChatMessage[]
}

export class ChatGuardError extends Error {
  constructor(message: string, public status: 400 | 413) {
    super(message)
  }
}

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length
}

export function sanitizeChatRequest(input: any): ChatRequestOut {
  if (!input || !Array.isArray(input.messages)) {
    throw new ChatGuardError("messages required", 400)
  }
  if (input.messages.length > MAX_MESSAGES_LEN) {
    throw new ChatGuardError(`too many messages (max ${MAX_MESSAGES_LEN})`, 400)
  }
  const messages: ChatMessage[] = input.messages.map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? ""),
  }))
  if (byteLen(JSON.stringify(messages)) > MAX_MESSAGES_BYTES) {
    throw new ChatGuardError("messages too large", 413)
  }
  const system = typeof input.system === "string" ? input.system : undefined
  if (system && byteLen(system) > MAX_SYSTEM_BYTES) {
    throw new ChatGuardError("system too large", 413)
  }
  const out: ChatRequestOut = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    stream: false,
    messages,
  }
  if (system !== undefined) out.system = system
  return out
}

export interface RateLimits {
  perMin: number
  perDay: number
  globalPerDay: number
}

export type RateDeny =
  | { ok: false; reason: "ip_min" | "ip_day" | "global_day" }
  | { ok: true }

export async function runRateLimits(kv: KVLike, ip: string, limits: RateLimits, when: Date = new Date()): Promise<RateDeny> {
  const minR = await checkAndIncrement(kv, bucketKey("min", ip, when), limits.perMin, 90)
  if (!minR.ok) return { ok: false, reason: "ip_min" }
  const dayR = await checkAndIncrement(kv, bucketKey("day", ip, when), limits.perDay, 86_400 + 60)
  if (!dayR.ok) return { ok: false, reason: "ip_day" }
  const globalR = await checkAndIncrement(kv, bucketKey("global-day", null, when), limits.globalPerDay, 86_400 + 60)
  if (!globalR.ok) return { ok: false, reason: "global_day" }
  return { ok: true }
}
```

- [ ] **Step 4: Run → guard tests PASS, rate-limit integration tests now PASS**

Run: `bun test tests/chat-guard.test.ts tests/rate-limit.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/chat.ts tests/chat-guard.test.ts
git commit -m "feat(chat): sanitizeChatRequest (whitelist + caps) and runRateLimits"
```

---

## Task 4: Chat forwarder + error sanitization

**Files:**
- Modify: `src/services/chat.ts`
- Modify: `tests/chat-guard.test.ts`

- [ ] **Step 1: Add failing test for upstream error sanitization**

Append to `tests/chat-guard.test.ts`:

```typescript
import { forwardChat } from "~/services/chat"

describe("forwardChat — error sanitization", () => {
  const SECRET = "super-secret-key-xyz"
  const URL = "https://upstream.example/v1/messages"

  function fakeFetch(status: number, body: any): typeof fetch {
    return async (input: any) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
  }

  it("returns upstream JSON on 200", async () => {
    const reply = { content: [{ type: "text", text: "hello" }] }
    const out = await forwardChat({ messages: [{ role: "user", content: "hi" }] }, {
      gatewayUrl: URL,
      gatewayKey: SECRET,
      fetcher: fakeFetch(200, reply),
    })
    expect(out.status).toBe(200)
    expect(await out.json()).toEqual(reply)
  })

  it("on upstream 401: returns {error:'upstream_error'} only — no key, no upstream URL", async () => {
    const out = await forwardChat({ messages: [{ role: "user", content: "hi" }] }, {
      gatewayUrl: URL,
      gatewayKey: SECRET,
      fetcher: fakeFetch(401, { error: { message: `bad key: ${SECRET}` } }),
    })
    expect(out.status).toBe(502)
    const body = (await out.json()) as any
    expect(body).toEqual({ error: "upstream_error" })
    const text = JSON.stringify(body)
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain("upstream.example")
  })

  it("on upstream 500: returns {error:'upstream_error'} only", async () => {
    const out = await forwardChat({ messages: [{ role: "user", content: "hi" }] }, {
      gatewayUrl: URL,
      gatewayKey: SECRET,
      fetcher: fakeFetch(500, { detail: "internal stack trace with " + URL }),
    })
    expect(out.status).toBe(502)
    expect(await out.json()).toEqual({ error: "upstream_error" })
  })
})
```

- [ ] **Step 2: Implement `forwardChat` in `src/services/chat.ts`**

Append to `src/services/chat.ts`:

```typescript
export interface ForwardOpts {
  gatewayUrl: string
  gatewayKey: string
  fetcher?: typeof fetch
}

export async function forwardChat(input: any, opts: ForwardOpts): Promise<Response> {
  const sanitized = sanitizeChatRequest(input)
  const f = opts.fetcher ?? fetch
  let upstream: Response
  try {
    upstream = await f(opts.gatewayUrl.replace(/\/$/, "") + "/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.gatewayKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(sanitized),
    })
  } catch {
    return new Response(JSON.stringify({ error: "upstream_error" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })
  }
  if (upstream.status >= 400) {
    return new Response(JSON.stringify({ error: "upstream_error" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })
  }
  // Pass through body + content-type only; strip any upstream-leaked headers
  const body = await upstream.text()
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
```

- [ ] **Step 3: Run → PASS**

Run: `bun test tests/chat-guard.test.ts`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/chat.ts tests/chat-guard.test.ts
git commit -m "feat(chat): forwardChat with error sanitization (no key/URL leaks)"
```

---

## Task 5: Chat route

**Files:**
- Create: `src/routes/chat.ts`
- Modify: `src/index.ts`
- Modify: `tests/routes.test.ts`

- [ ] **Step 1: Write failing route test**

Append to `tests/routes.test.ts`:

```typescript
describe("POST /api/chat", () => {
  it("returns 503 when COPILOT_GATEWAY_URL/KEY missing", async () => {
    const env = await makeEnv()
    const app = createApp(env) // env has no chat creds
    const res = await app.handle(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as any
    expect(body.error).toContain("not configured")
  })

  it("returns 400 for empty body", async () => {
    const env = await makeEnv()
    const envWithChat = { ...env, COPILOT_GATEWAY_URL: "https://up.example", COPILOT_GATEWAY_KEY: "k" }
    const app = createApp(envWithChat)
    const res = await app.handle(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    )
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Implement `src/routes/chat.ts`**

```typescript
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { ChatGuardError, forwardChat, runRateLimits } from "~/services/chat"
import { getClientIp } from "~/lib/getClientIp"

export const chatRoute = new Elysia().post(
  "/api/chat",
  async ({ env, request, body, set }: { env: Env; request: Request; body: any; set: any }) => {
    if (env.COPILOT_GATEWAY_URL == null || env.COPILOT_GATEWAY_KEY == null) {
      set.status = 503
      return { error: "chat unavailable: gateway not configured" }
    }
    const ip = getClientIp(request)
    const limits = {
      perMin: Number(env.RATE_PER_MIN ?? "10"),
      perDay: Number(env.RATE_PER_DAY ?? "100"),
      globalPerDay: Number(env.GLOBAL_PER_DAY ?? "5000"),
    }
    const rl = await runRateLimits(env.RATE, ip, limits)
    if (!rl.ok) {
      set.status = rl.reason === "global_day" ? 503 : 429
      return { error: rl.reason }
    }
    try {
      const upstream = await forwardChat(body, {
        gatewayUrl: env.COPILOT_GATEWAY_URL,
        gatewayKey: env.COPILOT_GATEWAY_KEY,
      })
      set.status = upstream.status
      return await upstream.json()
    } catch (e) {
      if (e instanceof ChatGuardError) {
        set.status = e.status
        return { error: e.message }
      }
      set.status = 500
      return { error: "internal_error" }
    }
  },
)
```

- [ ] **Step 3: Mount in `src/index.ts`**

Edit `src/index.ts` to import and `.use(chatRoute)`:

```typescript
import { chatRoute } from "~/routes/chat"
// ...
    .use(museumsRoute)
    .use(dynastiesRoute)
    .use(chatRoute)
```

- [ ] **Step 4: Run all tests → PASS**

Run: `bun test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/chat.ts src/index.ts tests/routes.test.ts
git commit -m "feat(routes): POST /api/chat with rate limit + 503 when not configured"
```

---

## Self-Review Checklist

- `model`/`max_tokens`/`stream` are server-fixed (not from client) ✓
- Field whitelist: only `system` + `messages` pass through ✓
- 32KB messages / 8KB system / 12 messages caps ✓
- Upstream errors → `{error:"upstream_error"}` only, no leaked key/URL ✓
- Rate limits: per-IP/min, per-IP/day, global/day ✓
- Best-effort acknowledged in tests (≥1 denied, not exact count) ✓
- KV key format `rate:ip:<ip>:min:<YYYYMMDDHHmm>` etc. asserted ✓
- `getClientIp` works for both Worker (cf.connectingIp) and Bun (xff) ✓
- 503 when COPILOT_GATEWAY_URL/KEY not configured ✓
- No UI logic introduced (Plan 04) ✓

---

## Hand-off

When all tasks pass: chat is live behind guards. Plans 04 (UI) and 05 (local.ts adapters) consume this directly.
