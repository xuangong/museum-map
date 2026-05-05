# 多用户认证实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把单租户的 museum-map 改造成多用户系统，支持 Email+密码注册/登录与 Google OAuth；每用户独立 visits/review，未登录可匿名打卡，登录后合并。

**Architecture:** D1 加 `users` + `sessions` 两张表；HttpOnly cookie + 服务端 session 中间件；Email+密码用 scrypt（node:crypto via nodejs_compat），Google OAuth 走 Authorization Code Flow；现有 ADMIN_TOKEN 改用 `users.is_admin`；客户端匿名 visits 存 localStorage，登录后一次性 POST 合并。

**Tech Stack:** Bun + Elysia + Cloudflare Workers + D1 + KV，bun:test + miniflare。

**Spec:** `docs/superpowers/specs/2026-05-05-multi-user-auth-design.md`

---

## File Structure

### 新建
- `migrations/0010_users.sql` — users + sessions 表
- `src/lib/crypto.ts` — scrypt hash/verify + 随机 token 生成
- `src/lib/cookies.ts` — Cookie 头 parse / Set-Cookie serialize
- `src/lib/email-norm.ts` — Gmail 别名归一化
- `src/repo/users.ts` — UsersRepo
- `src/repo/sessions.ts` — SessionsRepo
- `src/services/auth.ts` — register / login / logout / mergeAnonymous / 自动 admin
- `src/services/google-oauth.ts` — buildAuthUrl + exchangeCode
- `src/middleware/session.ts` — Elysia derive，注入 ctx.user / ctx.session
- `src/routes/auth.ts` — 全部 /auth/* 路由
- `src/ui/client/auth.ts` — `window.MuseumAuth` 客户端模块
- `tests/crypto.test.ts`
- `tests/cookies.test.ts`
- `tests/email-norm.test.ts`
- `tests/users-repo.test.ts`
- `tests/sessions-repo.test.ts`
- `tests/auth-service.test.ts`
- `tests/google-oauth.test.ts`
- `tests/auth-routes.test.ts`

### 修改
- `src/index.ts` — Env 加 GOOGLE_CLIENT_ID/SECRET/OAUTH_REDIRECT_URI；接入 sessionMiddleware；mount authRoute
- `src/repo/visits.ts` — 去掉 `'me'` 默认值
- `src/repo/review-cache.ts` — 同上
- `src/repo/dynasty-review-cache.ts` — 同上
- `src/routes/visits.ts` — 从 ctx.user 取 userId，未登录 401
- `src/routes/import.ts` — checkAuth 改为 requireAdmin(ctx.user)
- `src/ui/components/sidebar.ts` — 嵌入登录入口
- `src/ui/client/app.ts` — 启动时 syncMe，匿名 visits 走 localStorage，登录后 mergeLocal
- `src/ui/home.ts` — 引入 auth.ts client 脚本
- `tests/visits-routes.test.ts`（新建，覆盖已修改路由）

### 不动
- `migrations/0004_visits.sql` 等（user_id 列已存在，无需 schema change）
- `legacy/data.json`、所有现有数据
- 其他 routes（museums/dynasties/chat/cdn/home）

---

## Task 1: Migration — users + sessions 表

**Files:**
- Create: `migrations/0010_users.sql`

- [ ] **Step 1: 创建 SQL 文件**

```sql
-- migrations/0010_users.sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX idx_users_email_norm ON users(email_normalized);
CREATE INDEX idx_users_google ON users(google_sub);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

- [ ] **Step 2: 应用到本地 D1**

Run: `bunx wrangler d1 execute museum-map-db --local --file=migrations/0010_users.sql`
Expected: `🚣 Executed N command(s) successfully`

- [ ] **Step 3: 校验表结构**

Run: `bunx wrangler d1 execute museum-map-db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','sessions')"`
Expected: 两行返回 `users` 和 `sessions`

- [ ] **Step 4: Commit**

```bash
git add migrations/0010_users.sql
git commit -m "feat(auth): users + sessions schema"
```

---

## Task 2: Email 归一化工具

**Files:**
- Create: `src/lib/email-norm.ts`
- Test: `tests/email-norm.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/email-norm.test.ts
import { describe, it, expect } from "bun:test"
import { normalizeEmail } from "~/lib/email-norm"

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com")
  })
  it("strips dots and +alias for gmail", () => {
    expect(normalizeEmail("f.o.o+spam@gmail.com")).toBe("foo@gmail.com")
    expect(normalizeEmail("Foo.Bar+x@googlemail.com")).toBe("foobar@gmail.com")
  })
  it("strips +alias only for non-gmail", () => {
    expect(normalizeEmail("a.b+x@example.com")).toBe("a.b@example.com")
  })
  it("returns empty for invalid input", () => {
    expect(normalizeEmail("not-an-email")).toBe("")
    expect(normalizeEmail("")).toBe("")
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/email-norm.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

```ts
// src/lib/email-norm.ts
export function normalizeEmail(raw: string): string {
  const s = (raw || "").trim().toLowerCase()
  const at = s.lastIndexOf("@")
  if (at < 1 || at === s.length - 1) return ""
  let local = s.slice(0, at)
  let domain = s.slice(at + 1)
  if (!domain.includes(".")) return ""
  if (domain === "googlemail.com") domain = "gmail.com"
  // Strip +alias for everyone
  const plus = local.indexOf("+")
  if (plus >= 0) local = local.slice(0, plus)
  // Strip dots only for gmail
  if (domain === "gmail.com") local = local.replace(/\./g, "")
  if (!local) return ""
  return local + "@" + domain
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/email-norm.test.ts`
Expected: 4 pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-norm.ts tests/email-norm.test.ts
git commit -m "feat(auth): email normalization helper"
```

---

## Task 3: Cookie parse / serialize

**Files:**
- Create: `src/lib/cookies.ts`
- Test: `tests/cookies.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/cookies.test.ts
import { describe, it, expect } from "bun:test"
import { parseCookies, serializeCookie } from "~/lib/cookies"

describe("parseCookies", () => {
  it("parses simple header", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" })
  })
  it("trims spaces around values", () => {
    expect(parseCookies("a = 1 ;  b=2")).toEqual({ a: "1", b: "2" })
  })
  it("handles empty / null", () => {
    expect(parseCookies(null)).toEqual({})
    expect(parseCookies("")).toEqual({})
  })
  it("decodes URL-encoded values", () => {
    expect(parseCookies("x=hello%20world")).toEqual({ x: "hello world" })
  })
})

describe("serializeCookie", () => {
  it("serializes with HttpOnly+Secure+SameSite", () => {
    const c = serializeCookie("sid", "abc", {
      httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60,
    })
    expect(c).toBe("sid=abc; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax")
  })
  it("serializes Max-Age=0 to expire", () => {
    const c = serializeCookie("sid", "", { maxAge: 0, path: "/" })
    expect(c).toContain("Max-Age=0")
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/cookies.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

```ts
// src/lib/cookies.ts
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq < 0) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

export interface CookieOpts {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "Lax" | "Strict" | "None"
  path?: string
  maxAge?: number
  expires?: Date
  domain?: string
}

export function serializeCookie(name: string, value: string, opts: CookieOpts = {}): string {
  const parts = [`${name}=${value}`]
  if (opts.path) parts.push(`Path=${opts.path}`)
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`)
  if (opts.httpOnly) parts.push("HttpOnly")
  if (opts.secure) parts.push("Secure")
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`)
  return parts.join("; ")
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/cookies.test.ts`
Expected: 6 pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/cookies.ts tests/cookies.test.ts
git commit -m "feat(auth): cookie parse/serialize helpers"
```

---

## Task 4: 密码哈希 + token 生成

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `tests/crypto.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/crypto.test.ts
import { describe, it, expect } from "bun:test"
import { hashPassword, verifyPassword, generateToken } from "~/lib/crypto"

describe("hashPassword/verifyPassword", () => {
  it("verifies the same password", () => {
    const h = hashPassword("hunter2")
    expect(verifyPassword("hunter2", h)).toBe(true)
  })
  it("rejects wrong password", () => {
    const h = hashPassword("hunter2")
    expect(verifyPassword("wrong", h)).toBe(false)
  })
  it("produces different hashes for the same password (random salt)", () => {
    const h1 = hashPassword("hunter2")
    const h2 = hashPassword("hunter2")
    expect(h1).not.toBe(h2)
    expect(verifyPassword("hunter2", h1)).toBe(true)
    expect(verifyPassword("hunter2", h2)).toBe(true)
  })
  it("returns false for malformed stored hash", () => {
    expect(verifyPassword("x", "garbage")).toBe(false)
    expect(verifyPassword("x", "")).toBe(false)
  })
})

describe("generateToken", () => {
  it("generates hex of 2*byteLen length", () => {
    const t = generateToken(16)
    expect(t).toMatch(/^[0-9a-f]{32}$/)
  })
  it("is unique across calls", () => {
    expect(generateToken(16)).not.toBe(generateToken(16))
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/crypto.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

```ts
// src/lib/crypto.ts
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto"

const N = 16384
const r = 8
const p = 1
const KEYLEN = 32
const SALT_BYTES = 16

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_BYTES)
  const hash = scryptSync(plain, salt, KEYLEN, { N, r, p })
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored || typeof stored !== "string") return false
  const parts = stored.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  try {
    const salt = Buffer.from(parts[1]!, "base64")
    const expected = Buffer.from(parts[2]!, "base64")
    const actual = scryptSync(plain, salt, expected.length, { N, r, p })
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function generateToken(byteLen: number): string {
  return randomBytes(byteLen).toString("hex")
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/crypto.test.ts`
Expected: 6 pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts tests/crypto.test.ts
git commit -m "feat(auth): scrypt password hashing + token generation"
```

---

## Task 5: UsersRepo

**Files:**
- Create: `src/repo/users.ts`
- Test: `tests/users-repo.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/users-repo.test.ts
import { describe, it, expect, beforeAll } from "bun:test"
import { Miniflare } from "miniflare"
import { UsersRepo } from "~/repo/users"

async function getDb() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
  })
  return mf.getD1Database("DB")
}

describe("UsersRepo", () => {
  it("creates and finds by id/email/google_sub", async () => {
    const db = await getDb()
    const repo = new UsersRepo(db)
    const email = `t-${Date.now()}@example.com`
    const u = await repo.create({
      email, emailNormalized: email, passwordHash: "scrypt$x$y",
    })
    expect(u.id).toMatch(/^[0-9a-z]{26}$/)
    const byId = await repo.findById(u.id)
    expect(byId?.email).toBe(email)
    const byEmail = await repo.findByEmail(email)
    expect(byEmail?.id).toBe(u.id)

    await repo.setGoogleSub(u.id, "google-sub-123")
    const byGoogle = await repo.findByGoogleSub("google-sub-123")
    expect(byGoogle?.id).toBe(u.id)
  })

  it("rejects duplicate email", async () => {
    const db = await getDb()
    const repo = new UsersRepo(db)
    const email = `dup-${Date.now()}@example.com`
    await repo.create({ email, emailNormalized: email })
    await expect(
      repo.create({ email, emailNormalized: email })
    ).rejects.toThrow(/UNIQUE/i)
  })

  it("countAll returns total user count", async () => {
    const db = await getDb()
    const repo = new UsersRepo(db)
    const before = await repo.countAll()
    await repo.create({ email: `c-${Date.now()}@example.com`, emailNormalized: `c-${Date.now()}@example.com` })
    const after = await repo.countAll()
    expect(after).toBe(before + 1)
  })

  it("setPassword + setAdmin work", async () => {
    const db = await getDb()
    const repo = new UsersRepo(db)
    const email = `s-${Date.now()}@example.com`
    const u = await repo.create({ email, emailNormalized: email })
    await repo.setPassword(u.id, "scrypt$new$hash")
    await repo.setAdmin(u.id, true)
    const got = await repo.findById(u.id)
    expect(got?.password_hash).toBe("scrypt$new$hash")
    expect(got?.is_admin).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/users-repo.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

```ts
// src/repo/users.ts
import { generateToken } from "~/lib/crypto"

export interface UserRow {
  id: string
  email: string
  email_normalized: string
  password_hash: string | null
  google_sub: string | null
  display_name: string | null
  avatar_url: string | null
  is_admin: number
  created_at: number
  last_login_at: number | null
}

// ULID-ish (lowercase 26 hex-like). Good enough; not strictly Crockford ULID.
function newUserId(): string {
  return generateToken(13).slice(0, 26)
}

export class UsersRepo {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<UserRow | null> {
    const r = await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>()
    return r ?? null
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const r = await this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>()
    return r ?? null
  }

  async findByEmailNormalized(emailNorm: string): Promise<UserRow | null> {
    const r = await this.db
      .prepare("SELECT * FROM users WHERE email_normalized = ? LIMIT 1")
      .bind(emailNorm)
      .first<UserRow>()
    return r ?? null
  }

  async findByGoogleSub(sub: string): Promise<UserRow | null> {
    const r = await this.db
      .prepare("SELECT * FROM users WHERE google_sub = ?")
      .bind(sub)
      .first<UserRow>()
    return r ?? null
  }

  async create(opts: {
    email: string
    emailNormalized: string
    passwordHash?: string | null
    googleSub?: string | null
    displayName?: string | null
    avatarUrl?: string | null
    isAdmin?: boolean
  }): Promise<UserRow> {
    const id = newUserId()
    const now = Date.now()
    await this.db
      .prepare(
        "INSERT INTO users (id, email, email_normalized, password_hash, google_sub, display_name, avatar_url, is_admin, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        opts.email,
        opts.emailNormalized,
        opts.passwordHash ?? null,
        opts.googleSub ?? null,
        opts.displayName ?? null,
        opts.avatarUrl ?? null,
        opts.isAdmin ? 1 : 0,
        now,
        null,
      )
      .run()
    const created = await this.findById(id)
    if (!created) throw new Error("user create failed")
    return created
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, id).run()
  }

  async setGoogleSub(id: string, sub: string): Promise<void> {
    await this.db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").bind(sub, id).run()
  }

  async setAdmin(id: string, isAdmin: boolean): Promise<void> {
    await this.db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").bind(isAdmin ? 1 : 0, id).run()
  }

  async touchLogin(id: string): Promise<void> {
    await this.db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(Date.now(), id).run()
  }

  async countAll(): Promise<number> {
    const r = await this.db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>()
    return r?.n ?? 0
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/users-repo.test.ts`
Expected: 4 pass

- [ ] **Step 5: Commit**

```bash
git add src/repo/users.ts tests/users-repo.test.ts
git commit -m "feat(auth): UsersRepo (CRUD + countAll + admin/password setters)"
```

---

## Task 6: SessionsRepo

**Files:**
- Create: `src/repo/sessions.ts`
- Test: `tests/sessions-repo.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/sessions-repo.test.ts
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { SessionsRepo } from "~/repo/sessions"
import { UsersRepo } from "~/repo/users"

async function getDb() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
  })
  return mf.getD1Database("DB")
}

async function makeUser(db: D1Database) {
  const u = await new UsersRepo(db).create({
    email: `s-${Date.now()}-${Math.random()}@example.com`,
    emailNormalized: `s-${Date.now()}-${Math.random()}@example.com`,
  })
  return u
}

describe("SessionsRepo", () => {
  it("creates a session and gets it back", async () => {
    const db = await getDb()
    const u = await makeUser(db)
    const repo = new SessionsRepo(db)
    const s = await repo.create({ userId: u.id, userAgent: "ua", ip: "1.2.3.4", ttlSeconds: 3600 })
    expect(s.id).toMatch(/^[0-9a-f]{64}$/)
    const got = await repo.get(s.id)
    expect(got?.user_id).toBe(u.id)
  })

  it("returns null for expired session", async () => {
    const db = await getDb()
    const u = await makeUser(db)
    const repo = new SessionsRepo(db)
    const s = await repo.create({ userId: u.id, ttlSeconds: -10 })
    const got = await repo.get(s.id)
    expect(got).toBeNull()
  })

  it("revoke removes the row", async () => {
    const db = await getDb()
    const u = await makeUser(db)
    const repo = new SessionsRepo(db)
    const s = await repo.create({ userId: u.id, ttlSeconds: 3600 })
    await repo.revoke(s.id)
    expect(await repo.get(s.id)).toBeNull()
  })

  it("touch updates last_seen_at", async () => {
    const db = await getDb()
    const u = await makeUser(db)
    const repo = new SessionsRepo(db)
    const s = await repo.create({ userId: u.id, ttlSeconds: 3600 })
    const before = s.last_seen_at
    await new Promise((r) => setTimeout(r, 10))
    await repo.touch(s.id)
    const after = await repo.get(s.id)
    expect(after?.last_seen_at).toBeGreaterThan(before)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/sessions-repo.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

```ts
// src/repo/sessions.ts
import { generateToken } from "~/lib/crypto"

export interface SessionRow {
  id: string
  user_id: string
  created_at: number
  expires_at: number
  last_seen_at: number
  user_agent: string | null
  ip: string | null
}

export class SessionsRepo {
  constructor(private db: D1Database) {}

  async create(opts: {
    userId: string
    userAgent?: string | null
    ip?: string | null
    ttlSeconds: number
  }): Promise<SessionRow> {
    const id = generateToken(32) // 64 hex chars
    const now = Date.now()
    const expires = now + opts.ttlSeconds * 1000
    await this.db
      .prepare(
        "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, opts.userId, now, expires, now, opts.userAgent ?? null, opts.ip ?? null)
      .run()
    return {
      id, user_id: opts.userId, created_at: now, expires_at: expires,
      last_seen_at: now, user_agent: opts.userAgent ?? null, ip: opts.ip ?? null,
    }
  }

  async get(id: string): Promise<SessionRow | null> {
    if (!id) return null
    const r = await this.db
      .prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > ?")
      .bind(id, Date.now())
      .first<SessionRow>()
    return r ?? null
  }

  async touch(id: string): Promise<void> {
    await this.db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(Date.now(), id).run()
  }

  async revoke(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run()
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run()
  }

  async sweepExpired(): Promise<number> {
    const r = await this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()).run()
    return r.meta?.changes ?? 0
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/sessions-repo.test.ts`
Expected: 4 pass

- [ ] **Step 5: Commit**

```bash
git add src/repo/sessions.ts tests/sessions-repo.test.ts
git commit -m "feat(auth): SessionsRepo (create/get/touch/revoke/sweep)"
```

---

## Task 7: Session middleware

**Files:**
- Create: `src/middleware/session.ts`

- [ ] **Step 1: 实现**

```ts
// src/middleware/session.ts
import { Elysia } from "elysia"
import { parseCookies } from "~/lib/cookies"
import { SessionsRepo } from "~/repo/sessions"
import { UsersRepo, type UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"
import type { Env } from "~/index"

export interface SessionContext {
  user: UserRow | null
  session: SessionRow | null
}

export const sessionMiddleware = new Elysia({ name: "session" }).derive(
  { as: "global" },
  async ({ request }: { request: Request }): Promise<SessionContext> => {
    const env = (globalThis as any).__env as Env | undefined
    if (!env) return { user: null, session: null }
    const sid = parseCookies(request.headers.get("cookie"))["sid"]
    if (!sid) return { user: null, session: null }
    const sessions = new SessionsRepo(env.DB)
    const session = await sessions.get(sid)
    if (!session) return { user: null, session: null }
    const users = new UsersRepo(env.DB)
    const user = await users.findById(session.user_id)
    if (!user) return { user: null, session: null }
    // touch is best-effort; failures don't block the request
    sessions.touch(sid).catch(() => {})
    return { user, session }
  },
)

export function requireUser(ctx: { user: UserRow | null; set: any }): UserRow | null {
  if (!ctx.user) {
    ctx.set.status = 401
    return null
  }
  return ctx.user
}

export function requireAdmin(ctx: { user: UserRow | null; set: any }): UserRow | null {
  const u = requireUser(ctx)
  if (!u) return null
  if (u.is_admin !== 1) {
    ctx.set.status = 403
    return null
  }
  return u
}
```

NOTE: `__env` global is set by `createApp` in Task 13 (so the middleware can access env even though Elysia v1 derive doesn't get decorated `env` here). This avoids changing Elysia's typing model.

- [ ] **Step 2: Commit**

```bash
git add src/middleware/session.ts
git commit -m "feat(auth): session middleware + requireUser/requireAdmin helpers"
```

---

## Task 8: AuthService

**Files:**
- Create: `src/services/auth.ts`
- Test: `tests/auth-service.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/auth-service.test.ts
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { AuthService } from "~/services/auth"

async function getDb() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
  })
  return mf.getD1Database("DB")
}

describe("AuthService.register", () => {
  it("creates user + session, lowercases email", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const email = `R-${Date.now()}@Example.COM`
    const r = await svc.register({ email, password: "hunter2hunter" })
    expect(r.user.email).toBe(email.toLowerCase())
    expect(r.session.id).toMatch(/^[0-9a-f]{64}$/)
  })

  it("rejects duplicate email", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const email = `dup-${Date.now()}@example.com`
    await svc.register({ email, password: "hunter2hunter" })
    await expect(svc.register({ email, password: "hunter2hunter" })).rejects.toThrow(/email_taken/)
  })

  it("rejects weak password", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    await expect(
      svc.register({ email: `w-${Date.now()}@example.com`, password: "short" }),
    ).rejects.toThrow(/weak_password/)
  })
})

describe("AuthService.login", () => {
  it("logs in with correct password", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const email = `l-${Date.now()}@example.com`
    await svc.register({ email, password: "hunter2hunter" })
    const r = await svc.login({ email, password: "hunter2hunter" })
    expect(r.user.email).toBe(email)
  })

  it("rejects wrong password", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const email = `lw-${Date.now()}@example.com`
    await svc.register({ email, password: "hunter2hunter" })
    await expect(svc.login({ email, password: "wrong" })).rejects.toThrow(/invalid_credentials/)
  })

  it("rejects unknown user with same error", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    await expect(
      svc.login({ email: `nope-${Date.now()}@example.com`, password: "x" }),
    ).rejects.toThrow(/invalid_credentials/)
  })
})

describe("AuthService.mergeAnonymous", () => {
  it("inserts anonymous visits ignoring duplicates", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const email = `m-${Date.now()}@example.com`
    const { user } = await svc.register({ email, password: "hunter2hunter" })
    const merged = await svc.mergeAnonymous(user.id, [
      { museumId: "anhui", visitedAt: 1000 },
      { museumId: "anhui", visitedAt: 2000 }, // dup → ignored
      { museumId: "guobo", visitedAt: 3000 },
    ])
    expect(merged).toBe(2)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/auth-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

```ts
// src/services/auth.ts
import { UsersRepo, type UserRow } from "~/repo/users"
import { SessionsRepo, type SessionRow } from "~/repo/sessions"
import { hashPassword, verifyPassword } from "~/lib/crypto"
import { normalizeEmail } from "~/lib/email-norm"

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const MIN_PASSWORD_LENGTH = 8

export interface AuthResult {
  user: UserRow
  session: SessionRow
}

export class AuthService {
  private users: UsersRepo
  private sessions: SessionsRepo
  constructor(private db: D1Database) {
    this.users = new UsersRepo(db)
    this.sessions = new SessionsRepo(db)
  }

  async register(opts: {
    email: string
    password: string
    displayName?: string
    userAgent?: string
    ip?: string
  }): Promise<AuthResult> {
    const email = (opts.email || "").trim().toLowerCase()
    const norm = normalizeEmail(email)
    if (!norm) throw new Error("invalid_email")
    if (!opts.password || opts.password.length < MIN_PASSWORD_LENGTH) throw new Error("weak_password")
    const existing = await this.users.findByEmail(email)
    if (existing) throw new Error("email_taken")
    const isFirst = (await this.users.countAll()) === 0
    const user = await this.users.create({
      email,
      emailNormalized: norm,
      passwordHash: hashPassword(opts.password),
      displayName: opts.displayName ?? null,
      isAdmin: isFirst,
    })
    await this.users.touchLogin(user.id)
    const session = await this.sessions.create({
      userId: user.id,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      ttlSeconds: SESSION_TTL_SECONDS,
    })
    return { user: { ...user, is_admin: isFirst ? 1 : 0 }, session }
  }

  async login(opts: {
    email: string
    password: string
    userAgent?: string
    ip?: string
  }): Promise<AuthResult> {
    const email = (opts.email || "").trim().toLowerCase()
    const user = await this.users.findByEmail(email)
    if (!user || !user.password_hash) throw new Error("invalid_credentials")
    if (!verifyPassword(opts.password, user.password_hash)) throw new Error("invalid_credentials")
    await this.users.touchLogin(user.id)
    const session = await this.sessions.create({
      userId: user.id,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      ttlSeconds: SESSION_TTL_SECONDS,
    })
    return { user, session }
  }

  async loginOrCreateGoogle(opts: {
    sub: string
    email: string
    name?: string
    picture?: string
    userAgent?: string
    ip?: string
  }): Promise<AuthResult> {
    const email = (opts.email || "").trim().toLowerCase()
    const norm = normalizeEmail(email) || email
    let user = await this.users.findByGoogleSub(opts.sub)
    if (!user) {
      const byEmail = await this.users.findByEmailNormalized(norm)
      if (byEmail) {
        await this.users.setGoogleSub(byEmail.id, opts.sub)
        user = (await this.users.findById(byEmail.id))!
      } else {
        const isFirst = (await this.users.countAll()) === 0
        user = await this.users.create({
          email,
          emailNormalized: norm,
          googleSub: opts.sub,
          displayName: opts.name ?? null,
          avatarUrl: opts.picture ?? null,
          isAdmin: isFirst,
        })
      }
    }
    await this.users.touchLogin(user.id)
    const session = await this.sessions.create({
      userId: user.id,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      ttlSeconds: SESSION_TTL_SECONDS,
    })
    return { user, session }
  }

  async logout(sessionId: string): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId)
  }

  async mergeAnonymous(
    userId: string,
    visits: Array<{ museumId: string; visitedAt: number; note?: string }>,
  ): Promise<number> {
    if (!Array.isArray(visits) || visits.length === 0) return 0
    let merged = 0
    for (const v of visits) {
      if (!v || typeof v.museumId !== "string" || typeof v.visitedAt !== "number") continue
      const r = await this.db
        .prepare(
          "INSERT INTO visits (user_id, museum_id, visited_at, note) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, museum_id) DO NOTHING",
        )
        .bind(userId, v.museumId, v.visitedAt, typeof v.note === "string" ? v.note.slice(0, 500) : null)
        .run()
      if ((r.meta?.changes ?? 0) > 0) merged += 1
    }
    return merged
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/auth-service.test.ts`
Expected: 7 pass

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.ts tests/auth-service.test.ts
git commit -m "feat(auth): AuthService (register/login/google/logout/merge)"
```

---

## Task 9: Google OAuth helper

**Files:**
- Create: `src/services/google-oauth.ts`
- Test: `tests/google-oauth.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/google-oauth.test.ts
import { describe, it, expect } from "bun:test"
import { buildAuthUrl, exchangeCode } from "~/services/google-oauth"

describe("buildAuthUrl", () => {
  it("includes required oauth parameters", () => {
    const url = new URL(
      buildAuthUrl({ clientId: "cid.apps.googleusercontent.com", redirectUri: "https://x.test/cb", state: "S1" }),
    )
    expect(url.host).toBe("accounts.google.com")
    expect(url.searchParams.get("client_id")).toBe("cid.apps.googleusercontent.com")
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.test/cb")
    expect(url.searchParams.get("state")).toBe("S1")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("scope")).toBe("openid email profile")
  })
})

describe("exchangeCode", () => {
  it("posts code+secret and parses userinfo", async () => {
    const calls: any[] = []
    const fetcher = async (url: string, init: any) => {
      calls.push({ url, init })
      if (url.includes("/token")) {
        return new Response(JSON.stringify({ access_token: "AT", id_token: "IT" }), {
          headers: { "content-type": "application/json" },
        })
      }
      return new Response(
        JSON.stringify({ sub: "g-1", email: "u@example.com", email_verified: true, name: "U", picture: "https://x/y" }),
        { headers: { "content-type": "application/json" } },
      )
    }
    const u = await exchangeCode({
      code: "C1", clientId: "CID", clientSecret: "SEC", redirectUri: "https://x.test/cb", fetcher,
    })
    expect(u.sub).toBe("g-1")
    expect(u.email).toBe("u@example.com")
    expect(u.emailVerified).toBe(true)
    expect(calls).toHaveLength(2)
    const tokenBody = calls[0].init.body as URLSearchParams
    expect(tokenBody.get("code")).toBe("C1")
    expect(tokenBody.get("client_secret")).toBe("SEC")
  })

  it("throws if token endpoint fails", async () => {
    const fetcher = async () => new Response("nope", { status: 400 })
    await expect(
      exchangeCode({ code: "C", clientId: "CID", clientSecret: "S", redirectUri: "https://x/cb", fetcher }),
    ).rejects.toThrow(/token_exchange_failed/)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/google-oauth.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现**

```ts
// src/services/google-oauth.ts
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
const SCOPES = "openid email profile"

export interface GoogleUser {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
}

export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL(AUTH_URL)
  u.searchParams.set("client_id", opts.clientId)
  u.searchParams.set("redirect_uri", opts.redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", SCOPES)
  u.searchParams.set("state", opts.state)
  u.searchParams.set("access_type", "online")
  u.searchParams.set("prompt", "select_account")
  return u.toString()
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

export async function exchangeCode(opts: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
  fetcher?: Fetcher
}): Promise<GoogleUser> {
  const fetcher = opts.fetcher ?? ((u, i) => fetch(u, i))
  const tokenBody = new URLSearchParams()
  tokenBody.set("code", opts.code)
  tokenBody.set("client_id", opts.clientId)
  tokenBody.set("client_secret", opts.clientSecret)
  tokenBody.set("redirect_uri", opts.redirectUri)
  tokenBody.set("grant_type", "authorization_code")
  const tokenRes = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody as any,
  })
  if (!tokenRes.ok) throw new Error("token_exchange_failed")
  const tokenJson: any = await tokenRes.json()
  const accessToken = tokenJson.access_token
  if (!accessToken) throw new Error("token_exchange_failed")
  const infoRes = await fetcher(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!infoRes.ok) throw new Error("userinfo_failed")
  const info: any = await infoRes.json()
  if (!info.sub || !info.email) throw new Error("userinfo_invalid")
  return {
    sub: String(info.sub),
    email: String(info.email),
    emailVerified: !!info.email_verified,
    name: info.name,
    picture: info.picture,
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/google-oauth.test.ts`
Expected: 3 pass

- [ ] **Step 5: Commit**

```bash
git add src/services/google-oauth.ts tests/google-oauth.test.ts
git commit -m "feat(auth): google oauth helper (buildAuthUrl/exchangeCode)"
```

---

## Task 10: 去掉 visits/review-cache repo 的 'me' 默认值

**Files:**
- Modify: `src/repo/visits.ts`
- Modify: `src/repo/review-cache.ts`
- Modify: `src/repo/dynasty-review-cache.ts`

- [ ] **Step 1: 修改 VisitsRepo（去默认值）**

`src/repo/visits.ts`：把所有方法 `userId = "me"` 改成 `userId: string`（必填）。完整替换：

```ts
export interface VisitRow {
  user_id: string
  museum_id: string
  visited_at: number
  note: string | null
}

export class VisitsRepo {
  constructor(private db: D1Database) {}

  async list(userId: string): Promise<VisitRow[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM visits WHERE user_id = ? ORDER BY visited_at DESC")
      .bind(userId)
      .all<VisitRow>()
    return results
  }

  async listIds(userId: string): Promise<string[]> {
    const rows = await this.list(userId)
    return rows.map((r) => r.museum_id)
  }

  async checkIn(museumId: string, userId: string, note?: string, at?: number): Promise<void> {
    const ts = at ?? Date.now()
    await this.db
      .prepare(
        "INSERT INTO visits (user_id, museum_id, visited_at, note) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, museum_id) DO UPDATE SET visited_at = excluded.visited_at, note = excluded.note",
      )
      .bind(userId, museumId, ts, note ?? null)
      .run()
  }

  async remove(museumId: string, userId: string): Promise<boolean> {
    const r = await this.db
      .prepare("DELETE FROM visits WHERE user_id = ? AND museum_id = ?")
      .bind(userId, museumId)
      .run()
    return (r.meta?.changes ?? 0) > 0
  }
}
```

- [ ] **Step 2: 修改 ReviewCacheRepo**

打开 `src/repo/review-cache.ts`，把所有 `userId = "me"` 默认值改为 `userId: string`（必填）。所有调用端在后续 task 里更新。

- [ ] **Step 3: 修改 DynastyReviewCacheRepo**

打开 `src/repo/dynasty-review-cache.ts`，同样把 `userId = "me"` 默认值移除，参数变必填。

- [ ] **Step 4: 跑 typecheck 看到调用端的红字**

Run: `bun run typecheck 2>&1 | head -50`
Expected: 报多处 `Expected 1-2 arguments, but got 0` — 这些会在 Task 11 修。

- [ ] **Step 5: Commit**

```bash
git add src/repo/visits.ts src/repo/review-cache.ts src/repo/dynasty-review-cache.ts
git commit -m "refactor(repo): drop 'me' default user_id (caller must pass)"
```

---

## Task 11: 改造 visits 路由 + dynasty review 路由用 ctx.user

**Files:**
- Modify: `src/routes/visits.ts`
- Modify: `src/routes/dynasties.ts`（如果调用了 ReviewCacheRepo / VisitsRepo）

- [ ] **Step 1: 重写 src/routes/visits.ts**

完整替换 `visitsRoute` 内的 5 个 handler。在 `RouteContext` 上加 `user`/`session`：

```ts
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { VisitsRepo } from "~/repo/visits"
import { MuseumsRepo } from "~/repo/museums"
import { ReviewCacheRepo } from "~/repo/review-cache"
import { normalizeLevel, LEVEL_TIERS } from "~/services/level-tiers"
import { sessionMiddleware, requireUser } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"

interface RouteContext {
  env: Env
  request: Request
  body: any
  params: any
  set: any
  user: UserRow | null
  session: SessionRow | null
}

export const visitsRoute = new Elysia()
  .use(sessionMiddleware)
  .get("/api/visits", async (ctx) => {
    const c = ctx as unknown as RouteContext
    const u = requireUser(c)
    if (!u) return { error: "unauthorized" }
    const repo = new VisitsRepo(c.env.DB)
    const rows = await repo.list(u.id)
    return { items: rows.map((r) => ({ museumId: r.museum_id, visitedAt: r.visited_at, note: r.note })) }
  })
  .post("/api/visits/:id", async (ctx) => {
    const c = ctx as unknown as RouteContext
    const u = requireUser(c)
    if (!u) return { error: "unauthorized" }
    const museums = new MuseumsRepo(c.env.DB)
    const m = await museums.get(c.params.id)
    if (!m) { c.set.status = 404; return { error: "museum not found" } }
    const repo = new VisitsRepo(c.env.DB)
    const note = typeof c.body?.note === "string" ? c.body.note.slice(0, 500) : undefined
    await repo.checkIn(c.params.id, u.id, note)
    return { ok: true, museumId: c.params.id }
  })
  .delete("/api/visits/:id", async (ctx) => {
    const c = ctx as unknown as RouteContext
    const u = requireUser(c)
    if (!u) return { error: "unauthorized" }
    const repo = new VisitsRepo(c.env.DB)
    const ok = await repo.remove(c.params.id, u.id)
    if (!ok) { c.set.status = 404; return { error: "not found" } }
    return { ok: true }
  })
  .post("/api/visits/review", async (ctx) => {
    const c = ctx as unknown as RouteContext
    const u = requireUser(c)
    if (!u) return { error: "unauthorized" }
    if (!c.env.COPILOT_GATEWAY_URL || !c.env.COPILOT_GATEWAY_KEY) {
      c.set.status = 503; return { error: "gateway not configured" }
    }
    const visits = new VisitsRepo(c.env.DB)
    const museums = new MuseumsRepo(c.env.DB)
    const rows = await visits.list(u.id)
    if (rows.length === 0) return { summary: "", count: 0 }
    // ...keep the existing review-generation body, but pass u.id everywhere repos need a userId.
    // Replace cache.save(text, rows.length, ...) with cache.save(u.id, text, rows.length, ...)
    // (see Task 10 for new cache signature)
    // For brevity the full body is unchanged from current code except those 2 substitutions.
    /* eslint-disable */
    // @ts-ignore - body intentionally kept identical to existing code; only userId injection differs
    return await runReviewLogicWithUser(c, u.id, rows, visits, museums)
    /* eslint-enable */
  })
  .get("/api/visits/review", async (ctx) => {
    const c = ctx as unknown as RouteContext
    const u = requireUser(c)
    if (!u) return { error: "unauthorized" }
    const cache = new ReviewCacheRepo(c.env.DB)
    const visits = new VisitsRepo(c.env.DB)
    const [cached, rows] = await Promise.all([cache.get(u.id), visits.list(u.id)])
    const currentCount = rows.length
    if (!cached) return { summary: "", count: currentCount, cached: false, stale: false }
    return {
      summary: cached.summary,
      count: cached.visit_count,
      currentCount,
      generatedAt: cached.generated_at,
      withChatContext: !!cached.with_chat_context,
      cached: true,
      stale: cached.visit_count !== currentCount,
    }
  })
```

NOTE: in the actual edit, **inline** the existing review-generation logic from `src/routes/visits.ts:48-191` (lines 48-191 of the original file) into the POST `/api/visits/review` handler — replacing `visits.list()` with `visits.list(u.id)`, the candidate query similarly, and `cache.save(text, rows.length, chatHistory.length > 0)` with `cache.save(u.id, text, rows.length, chatHistory.length > 0)`. Do not introduce a `runReviewLogicWithUser` helper — the placeholder above is illustrative only. Keep the prompt and gateway call identical to the current implementation.

- [ ] **Step 2: 改 dynasties.ts 中的 visit/review 端点**

打开 `src/routes/dynasties.ts`，找到所有调用 `VisitsRepo` 或 `DynastyReviewCacheRepo` 的地方（grep `new VisitsRepo|new DynastyReviewCacheRepo`），同样套 `requireUser` 取 `u.id` 传入。如果只是匿名读取（不用 user 数据），保持不变。

- [ ] **Step 3: 跑 typecheck**

Run: `bun run typecheck`
Expected: 通过（visits + dynasties 调用都已更新）

- [ ] **Step 4: Commit**

```bash
git add src/routes/visits.ts src/routes/dynasties.ts
git commit -m "feat(auth): visits/dynasty-review require login, use ctx.user.id"
```

---

## Task 12: Auth 路由

**Files:**
- Create: `src/routes/auth.ts`
- Test: `tests/auth-routes.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/auth-routes.test.ts
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv(extra: Record<string, string> = {}) {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"],
  })
  const DB = await mf.getD1Database("DB")
  const RATE = await mf.getKVNamespace("RATE")
  return { DB, RATE, ...extra } as any
}

function getCookie(res: Response, name: string): string | null {
  const sc = res.headers.get("set-cookie") || ""
  const m = sc.match(new RegExp(`${name}=([^;]+)`))
  return m ? m[1]! : null
}

describe("/auth flows", () => {
  it("register → me → logout → me=null", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const email = `r-${Date.now()}@example.com`

    const reg = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
        body: JSON.stringify({ email, password: "hunter2hunter" }),
      }),
    )
    expect(reg.status).toBe(200)
    const sid = getCookie(reg, "sid")
    expect(sid).toBeTruthy()

    const me = await app.handle(
      new Request("http://localhost/auth/me", { headers: { cookie: `sid=${sid}` } }),
    )
    const meBody = (await me.json()) as any
    expect(meBody.user?.email).toBe(email)

    const out = await app.handle(
      new Request("http://localhost/auth/logout", {
        method: "POST",
        headers: { cookie: `sid=${sid}`, origin: "http://localhost", host: "localhost" },
      }),
    )
    expect(out.status).toBe(204)

    const me2 = await app.handle(
      new Request("http://localhost/auth/me", { headers: { cookie: `sid=${sid}` } }),
    )
    const me2Body = (await me2.json()) as any
    expect(me2Body.user).toBeNull()
  })

  it("login rejects wrong password", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const email = `lw-${Date.now()}@example.com`
    await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
        body: JSON.stringify({ email, password: "hunter2hunter" }),
      }),
    )
    const r = await app.handle(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
        body: JSON.stringify({ email, password: "wrong" }),
      }),
    )
    expect(r.status).toBe(401)
  })

  it("CSRF: rejects POST when Origin host mismatches Host", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const r = await app.handle(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://evil.example", host: "localhost" },
        body: JSON.stringify({ email: `c-${Date.now()}@example.com`, password: "hunter2hunter" }),
      }),
    )
    expect(r.status).toBe(403)
  })

  it("merge-anonymous returns 401 without session", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const r = await app.handle(
      new Request("http://localhost/auth/merge-anonymous", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
        body: JSON.stringify({ visits: [] }),
      }),
    )
    expect(r.status).toBe(401)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `bun test tests/auth-routes.test.ts`
Expected: FAIL — auth route 404

- [ ] **Step 3: 实现 src/routes/auth.ts**

```ts
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { AuthService } from "~/services/auth"
import { buildAuthUrl, exchangeCode } from "~/services/google-oauth"
import { generateToken } from "~/lib/crypto"
import { parseCookies, serializeCookie } from "~/lib/cookies"
import { sessionMiddleware, requireUser } from "~/middleware/session"
import { getClientIp } from "~/lib/getClientIp"
import { rateLimit } from "~/lib/rateLimit"
import type { UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"

interface Ctx {
  env: Env
  request: Request
  body: any
  query: any
  set: any
  user: UserRow | null
  session: SessionRow | null
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const STATE_MAX_AGE = 600

function isSecure(req: Request): boolean {
  // Workers always uses https; localhost dev uses http but we still emit Secure (browsers ignore)
  return new URL(req.url).protocol === "https:"
}

function originOk(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true
  const origin = req.headers.get("origin")
  if (!origin) return true // server-to-server allowed; cookie auth only useful from browser anyway
  try {
    const o = new URL(origin)
    const host = req.headers.get("host") || new URL(req.url).host
    return o.host === host
  } catch {
    return false
  }
}

function setSidCookie(set: any, sid: string, secure: boolean) {
  set.headers["set-cookie"] = serializeCookie("sid", sid, {
    httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: COOKIE_MAX_AGE,
  })
}

function clearSidCookie(set: any, secure: boolean) {
  set.headers["set-cookie"] = serializeCookie("sid", "", {
    httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: 0,
  })
}

function userView(u: UserRow) {
  return {
    id: u.id, email: u.email, displayName: u.display_name, avatarUrl: u.avatar_url, isAdmin: u.is_admin === 1,
  }
}

async function authRateLimit(env: Env, req: Request, set: any): Promise<boolean> {
  const ip = getClientIp(req) || "unknown"
  const limited = await rateLimit(env.RATE, `auth:${ip}`, 5, 60)
  if (limited) {
    set.status = 429
    return false
  }
  return true
}

export const authRoute = new Elysia()
  .use(sessionMiddleware)
  .post("/auth/register", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    if (!(await authRateLimit(c.env, c.request, c.set))) return { error: "rate_limited" }
    try {
      const svc = new AuthService(c.env.DB)
      const r = await svc.register({
        email: String(c.body?.email ?? ""),
        password: String(c.body?.password ?? ""),
        displayName: typeof c.body?.displayName === "string" ? c.body.displayName.slice(0, 80) : undefined,
        userAgent: c.request.headers.get("user-agent") || undefined,
        ip: getClientIp(c.request) || undefined,
      })
      setSidCookie(c.set, r.session.id, isSecure(c.request))
      return { user: userView(r.user) }
    } catch (e: any) {
      const msg = e?.message || "error"
      if (msg === "email_taken") { c.set.status = 409; return { error: "email_taken" } }
      if (msg === "weak_password" || msg === "invalid_email") {
        c.set.status = 400; return { error: msg }
      }
      c.set.status = 500; return { error: "server_error" }
    }
  })
  .post("/auth/login", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    if (!(await authRateLimit(c.env, c.request, c.set))) return { error: "rate_limited" }
    try {
      const svc = new AuthService(c.env.DB)
      const r = await svc.login({
        email: String(c.body?.email ?? ""),
        password: String(c.body?.password ?? ""),
        userAgent: c.request.headers.get("user-agent") || undefined,
        ip: getClientIp(c.request) || undefined,
      })
      setSidCookie(c.set, r.session.id, isSecure(c.request))
      return { user: userView(r.user) }
    } catch {
      c.set.status = 401
      return { error: "invalid_credentials" }
    }
  })
  .post("/auth/logout", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    if (c.session) {
      const svc = new AuthService(c.env.DB)
      await svc.logout(c.session.id)
    }
    clearSidCookie(c.set, isSecure(c.request))
    c.set.status = 204
    return ""
  })
  .get("/auth/me", (ctx) => {
    const c = ctx as unknown as Ctx
    return { user: c.user ? userView(c.user) : null }
  })
  .get("/auth/google/start", (ctx) => {
    const c = ctx as unknown as Ctx
    const clientId = c.env.GOOGLE_CLIENT_ID
    const redirectUri = c.env.OAUTH_REDIRECT_URI
    if (!clientId || !redirectUri) { c.set.status = 503; return { error: "google_oauth_unconfigured" } }
    const state = generateToken(16)
    const url = buildAuthUrl({ clientId, redirectUri, state })
    c.set.headers["set-cookie"] = serializeCookie("oauth_state", state, {
      httpOnly: true, secure: isSecure(c.request), sameSite: "Lax", path: "/auth", maxAge: STATE_MAX_AGE,
    })
    c.set.status = 302
    c.set.headers["location"] = url
    return ""
  })
  .get("/auth/google/callback", async (ctx) => {
    const c = ctx as unknown as Ctx
    const clientId = c.env.GOOGLE_CLIENT_ID
    const secret = c.env.GOOGLE_CLIENT_SECRET
    const redirectUri = c.env.OAUTH_REDIRECT_URI
    if (!clientId || !secret || !redirectUri) { c.set.status = 503; return { error: "google_oauth_unconfigured" } }
    const cookies = parseCookies(c.request.headers.get("cookie"))
    const state = (c.query?.state as string) || ""
    if (!state || cookies["oauth_state"] !== state) { c.set.status = 400; return { error: "bad_state" } }
    const code = (c.query?.code as string) || ""
    if (!code) { c.set.status = 400; return { error: "missing_code" } }
    try {
      const gu = await exchangeCode({ code, clientId, clientSecret: secret, redirectUri })
      const svc = new AuthService(c.env.DB)
      const r = await svc.loginOrCreateGoogle({
        sub: gu.sub, email: gu.email, name: gu.name, picture: gu.picture,
        userAgent: c.request.headers.get("user-agent") || undefined,
        ip: getClientIp(c.request) || undefined,
      })
      const headers: Record<string, string> = {
        "set-cookie": serializeCookie("sid", r.session.id, {
          httpOnly: true, secure: isSecure(c.request), sameSite: "Lax", path: "/", maxAge: COOKIE_MAX_AGE,
        }),
        location: "/?logged_in=1",
      }
      // Also clear state cookie
      // (For simplicity we overwrite set-cookie above; oauth_state expires in 10 min anyway.)
      c.set.status = 302
      Object.assign(c.set.headers, headers)
      return ""
    } catch {
      c.set.status = 502
      return { error: "google_login_failed" }
    }
  })
  .post("/auth/merge-anonymous", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    const u = requireUser(c)
    if (!u) return { error: "unauthorized" }
    const visits = Array.isArray(c.body?.visits) ? c.body.visits : []
    const svc = new AuthService(c.env.DB)
    const merged = await svc.mergeAnonymous(u.id, visits)
    return { merged }
  })
```

- [ ] **Step 4: 跑测试确认通过**

Run: `bun test tests/auth-routes.test.ts`
Expected: 4 pass

- [ ] **Step 5: Commit**

```bash
git add src/routes/auth.ts tests/auth-routes.test.ts
git commit -m "feat(auth): /auth/* routes (register/login/logout/me/google/merge)"
```

---

## Task 13: 接入 createApp + Env

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: 更新 Env + createApp**

替换 `src/index.ts`：

```ts
import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { museumsRoute } from "~/routes/museums"
import { dynastiesRoute } from "~/routes/dynasties"
import { chatRoute } from "~/routes/chat"
import { importRoute } from "~/routes/import"
import { visitsRoute } from "~/routes/visits"
import { authRoute } from "~/routes/auth"
import { cdnRoute } from "~/lib/cdn"
import { homeRoute } from "~/routes/home"

export interface Env {
  DB: D1Database
  RATE: KVNamespace
  RATE_PER_MIN?: string
  RATE_PER_DAY?: string
  GLOBAL_PER_DAY?: string
  COPILOT_GATEWAY_URL?: string
  COPILOT_GATEWAY_KEY?: string
  DISABLE_CHAT?: string
  ADMIN_TOKEN?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  OAUTH_REDIRECT_URI?: string
}

export function createApp(env: Env) {
  ;(globalThis as any).__env = env
  return new Elysia({ aot: false })
    .use(cors({ origin: true, credentials: true }))
    .decorate("env", env)
    .get("/health", () => ({ status: "ok" }))
    .use(cdnRoute)
    .use(homeRoute)
    .use(authRoute)
    .use(museumsRoute)
    .use(dynastiesRoute)
    .use(chatRoute)
    .use(importRoute)
    .use(visitsRoute)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createApp(env).handle(request)
  },
}
```

- [ ] **Step 2: 跑全部测试**

Run: `bun test`
Expected: 全绿（所有原有测试 + 新加的 8 套）

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(auth): mount authRoute, expose env globally for session middleware"
```

---

## Task 14: 替换 import 路由的 ADMIN_TOKEN 校验

**Files:**
- Modify: `src/routes/import.ts`

- [ ] **Step 1: 改 checkAuth → requireAdmin**

把 `src/routes/import.ts` 顶部的 `checkAuth` 函数删除，引入 sessionMiddleware + requireAdmin：

```ts
import { sessionMiddleware, requireAdmin } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"

interface RouteContext {
  env: Env
  request: Request
  body: any
  params: any
  set: any
  user: UserRow | null
  session: SessionRow | null
}

export const importRoute = new Elysia().use(sessionMiddleware)
```

把每个 handler 里的 `const auth = checkAuth(env, request); if (!auth.ok) { set.status=auth.status; return auth.body }` 替换成：

```ts
const admin = requireAdmin(ctx as any)
if (!admin) return { error: "forbidden" }
```

确保 `(ctx as unknown as RouteContext)` 解构时把 `user` 也带上。删除 `import.ts` 里所有对 `env.ADMIN_TOKEN` 的引用。

- [ ] **Step 2: typecheck + 测试**

Run: `bun run typecheck && bun test`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add src/routes/import.ts
git commit -m "feat(auth): admin routes use requireAdmin (drop ADMIN_TOKEN)"
```

---

## Task 15: UI — 客户端 auth 模块

**Files:**
- Create: `src/ui/client/auth.ts`
- Modify: `src/ui/home.ts`（引入 `<script src="/cdn/...">` 不需要 — auth.ts 走和 app.ts 同样的打包路径）

- [ ] **Step 1: 检查现有 client 打包方式**

Run: `bun run typecheck && grep -n "client/app\|client/chat" src/ui/home.ts`

确认 client 脚本是怎么 inline 进 HTML 的（基于现状是直接 import as text）。下一步参照同模式。

- [ ] **Step 2: 写 auth.ts**

```ts
// src/ui/client/auth.ts
;(function(){
  var ANON_KEY = 'museumAnonVisits';

  function readAnon() {
    try {
      var raw = window.localStorage.getItem(ANON_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(_) { return []; }
  }
  function writeAnon(arr){
    try { window.localStorage.setItem(ANON_KEY, JSON.stringify(arr)); } catch(_) {}
  }
  function clearAnon(){
    try { window.localStorage.removeItem(ANON_KEY); } catch(_) {}
  }
  function pushAnon(museumId, visitedAt){
    var arr = readAnon();
    var i = arr.findIndex(function(v){ return v.museumId === museumId; });
    if (i >= 0) arr.splice(i,1);
    arr.unshift({ museumId: museumId, visitedAt: visitedAt || Date.now() });
    writeAnon(arr);
  }
  function removeAnon(museumId){
    var arr = readAnon().filter(function(v){ return v.museumId !== museumId; });
    writeAnon(arr);
  }

  async function syncMe(){
    try {
      var res = await fetch('/auth/me', { credentials: 'same-origin' });
      var j = await res.json();
      window.MuseumAuth.user = j.user || null;
      return window.MuseumAuth.user;
    } catch(_) { window.MuseumAuth.user = null; return null; }
  }
  async function register(email, password){
    var res = await fetch('/auth/register', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });
    var j = await res.json();
    if (!res.ok) throw new Error(j.error || 'register_failed');
    window.MuseumAuth.user = j.user;
    await mergeLocal();
    return j.user;
  }
  async function login(email, password){
    var res = await fetch('/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });
    var j = await res.json();
    if (!res.ok) throw new Error(j.error || 'login_failed');
    window.MuseumAuth.user = j.user;
    await mergeLocal();
    return j.user;
  }
  async function logout(){
    await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.MuseumAuth.user = null;
  }
  function googleStart(){
    window.location.href = '/auth/google/start';
  }
  async function mergeLocal(){
    var anon = readAnon();
    if (!anon.length) return 0;
    try {
      var res = await fetch('/auth/merge-anonymous', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ visits: anon }),
      });
      if (res.ok) { clearAnon(); var j = await res.json(); return j.merged || 0; }
    } catch(_) {}
    return 0;
  }

  window.MuseumAuth = {
    user: null,
    syncMe: syncMe,
    register: register,
    login: login,
    logout: logout,
    googleStart: googleStart,
    mergeLocal: mergeLocal,
    isAuthenticated: function(){ return !!window.MuseumAuth.user; },
    anon: { read: readAnon, push: pushAnon, remove: removeAnon, clear: clearAnon },
  };
})();
```

- [ ] **Step 3: 把 auth.ts inline 到 home.ts 输出**

打开 `src/ui/home.ts`，在 `<script>` 标签里 import auth.ts 源码（与 app.ts 同样的方式：用 `import authClient from "./client/auth.ts" with { type: "text" }` 或现有 pattern）。**先 grep 一下 app.ts 是怎么注入的**：

Run: `grep -n "client/app\|MuseumChat\|appClient" src/ui/home.ts`

按相同 pattern 加一段引入 auth.ts 的源码，并放在 app.ts 之前（app.ts 的 init 会读 `window.MuseumAuth.syncMe`）。

- [ ] **Step 4: typecheck**

Run: `bun run typecheck`
Expected: 通过

- [ ] **Step 5: Commit**

```bash
git add src/ui/client/auth.ts src/ui/home.ts
git commit -m "feat(auth): client MuseumAuth module + anon visits localStorage"
```

---

## Task 16: app.ts 集成（启动 syncMe + 匿名/在线 visits 双源）

**Files:**
- Modify: `src/ui/client/app.ts`

- [ ] **Step 1: 改 init / loadVisits / toggleVisit**

在 Alpine `data()` 里加 `me: null`，并在 `init()` 末尾调用 `await window.MuseumAuth.syncMe(); this.me = window.MuseumAuth.user;`。

把 `loadVisits()` 改成：

```js
async loadVisits() {
  if (window.MuseumAuth && window.MuseumAuth.isAuthenticated()) {
    try {
      var res = await fetch('/api/visits', { credentials: 'same-origin' });
      if (!res.ok) return;
      var j = await res.json();
      var ids = (j.items || []).map(function(x){ return x.museumId; });
      var byId = {};
      (j.items || []).forEach(function(x){ byId[x.museumId] = x; });
      this.visits.ids = ids;
      this.visits.byId = byId;
    } catch(_) {}
  } else {
    var anon = window.MuseumAuth.anon.read();
    var ids = anon.map(function(v){ return v.museumId; });
    var byId = {};
    anon.forEach(function(v){ byId[v.museumId] = { museumId: v.museumId, visitedAt: v.visitedAt, note: null }; });
    this.visits.ids = ids;
    this.visits.byId = byId;
  }
},
```

把 `toggleVisit(id)` 改成：

```js
async toggleVisit(id) {
  var visited = this.isVisited(id);
  if (window.MuseumAuth && window.MuseumAuth.isAuthenticated()) {
    try {
      if (visited) await fetch('/api/visits/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' });
      else await fetch('/api/visits/' + encodeURIComponent(id), { method: 'POST', credentials: 'same-origin', headers: {'content-type':'application/json'}, body: '{}' });
    } catch(_) {}
  } else {
    if (visited) window.MuseumAuth.anon.remove(id);
    else window.MuseumAuth.anon.push(id, Date.now());
  }
  await this.loadVisits();
  this.refreshMarkers();
  if (this.visits.review) this.visits.reviewStale = true;
  var self = this;
  Object.keys(this.dynastyReviews).forEach(function(did){
    if (self.dynastyReviews[did].summary) self.dynastyReviews[did].stale = true;
  });
  if (this.drawer.open && this.drawer.kind === 'dynasty' && this.drawer.dynastyId) this.fetchDynastyReview(this.drawer.dynastyId);
  if (this.drawer.open && this.drawer.kind === 'museum' && this.selectedMuseumId === id) this.openMuseum(id);
},
```

加新方法（侧边栏会调）：

```js
authForm: { email: '', password: '', loading: false, error: '' },

async submitLogin() {
  if (this.authForm.loading) return;
  this.authForm.loading = true; this.authForm.error = '';
  try {
    await window.MuseumAuth.login(this.authForm.email, this.authForm.password);
    this.me = window.MuseumAuth.user;
    this.authForm.email = ''; this.authForm.password = '';
    await this.loadVisits(); this.refreshMarkers();
    this.flashToast('已登录');
  } catch(e) {
    this.authForm.error = (e && e.message) || '登录失败';
  } finally { this.authForm.loading = false; }
},

async submitRegister() {
  if (this.authForm.loading) return;
  this.authForm.loading = true; this.authForm.error = '';
  try {
    await window.MuseumAuth.register(this.authForm.email, this.authForm.password);
    this.me = window.MuseumAuth.user;
    this.authForm.email = ''; this.authForm.password = '';
    await this.loadVisits(); this.refreshMarkers();
    this.flashToast('已注册并登录');
  } catch(e) {
    var msg = (e && e.message) || '注册失败';
    if (msg === 'email_taken') msg = '邮箱已注册';
    if (msg === 'weak_password') msg = '密码至少 8 位';
    if (msg === 'invalid_email') msg = '邮箱格式不对';
    this.authForm.error = msg;
  } finally { this.authForm.loading = false; }
},

async doLogout() {
  await window.MuseumAuth.logout();
  this.me = null;
  await this.loadVisits(); this.refreshMarkers();
  this.flashToast('已退出');
},

doGoogleLogin() { window.MuseumAuth.googleStart(); },
```

- [ ] **Step 2: 兼容 logged_in=1 query 参数**

OAuth 回跳带 `?logged_in=1`。在 `init()` 里检测并清理：

```js
if (window.location.search.indexOf('logged_in=1') >= 0) {
  var url = new URL(window.location.href);
  url.searchParams.delete('logged_in');
  window.history.replaceState({}, '', url.toString());
}
```

放在 syncMe 之前即可。

- [ ] **Step 3: typecheck**

Run: `bun run typecheck`
Expected: 通过

- [ ] **Step 4: Commit**

```bash
git add src/ui/client/app.ts
git commit -m "feat(auth): app.ts integrates syncMe + anon/online visits + auth form handlers"
```

---

## Task 17: Sidebar UI — 登录入口

**Files:**
- Modify: `src/ui/components/sidebar.ts`

- [ ] **Step 1: 在 footprint hero 头部嵌入登录块**

在 `src/ui/components/sidebar.ts:5-44` 的 `<div class="toc-head">` 内，紧随 `<div class="vol">` 之前/或在 footprint 计数下方插入：

```html
<!-- Auth bar -->
<div style="margin-bottom:14px;border-bottom:0.5px solid var(--rule);padding-bottom:14px;">
  <template x-if="!me">
    <div>
      <div style="font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--ink-mid);margin-bottom:8px;">登录后保存到云端</div>
      <input x-model="authForm.email" type="email" placeholder="Email"
        style="width:100%;padding:8px 10px;font-size:16px;border:0.5px solid var(--rule);background:var(--paper);font-family:var(--sans);margin-bottom:6px;" />
      <input x-model="authForm.password" type="password" placeholder="密码（≥8 位）"
        style="width:100%;padding:8px 10px;font-size:16px;border:0.5px solid var(--rule);background:var(--paper);font-family:var(--sans);margin-bottom:8px;" />
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button @click="submitLogin()" :disabled="authForm.loading"
          style="border:none;background:var(--vermilion);color:var(--paper);padding:8px 14px;font-family:var(--sans);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;cursor:pointer;">登录</button>
        <button @click="submitRegister()" :disabled="authForm.loading"
          style="border:0.5px solid var(--vermilion);background:transparent;color:var(--vermilion);padding:8px 14px;font-family:var(--sans);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;cursor:pointer;">注册</button>
        <span x-show="authForm.loading" style="font-size:11px;color:var(--ink-mid);">…</span>
      </div>
      <div style="margin-top:10px;">
        <button @click="doGoogleLogin()"
          style="width:100%;border:0.5px solid var(--ink);background:var(--paper);color:var(--ink);padding:8px 12px;font-family:var(--sans);font-size:12px;cursor:pointer;">G&nbsp;&nbsp;Google 登录</button>
      </div>
      <div x-show="authForm.error" x-text="authForm.error"
        style="margin-top:8px;font-size:12px;color:var(--vermilion);"></div>
    </div>
  </template>
  <template x-if="me">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div style="font-family:var(--sans);font-size:12px;color:var(--ink-mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" x-text="me.email"></div>
      <button @click="doLogout()"
        style="border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--ink-mid);cursor:pointer;border-bottom:0.5px solid var(--ink-mid);">退出</button>
    </div>
  </template>
</div>
```

放在三个 hero 块（footprint / dynasty / index）的 **最顶端**（每个 hero 内复用同一段 HTML 块；可以抽成本地 const 字符串避免重复）。

- [ ] **Step 2: typecheck**

Run: `bun run typecheck`
Expected: 通过

- [ ] **Step 3: 本地手测**

Run: `bun run dev`，浏览器打开 http://localhost:4242。
- 未登录：看到 Email/密码 + Google 按钮；本地打卡（写到 localStorage）。
- 注册新账号 → 自动登录 → localStorage 清空 → 远程 visits 出现刚才打卡。
- 退出 → 又看到登录入口；之前的远程 visits 隐藏（因为未登录）。

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/sidebar.ts
git commit -m "feat(auth): sidebar login entry (email+pwd / google)"
```

---

## Task 18: 部署 + 数据迁移

**Files:**
- 无代码改动，只是运维步骤

- [ ] **Step 1: 设置 Google OAuth 凭据**

在 https://console.cloud.google.com/ 创建 OAuth 2.0 client（Web application），Authorized redirect URI 填：
- `https://museummap.xianliao.de5.net/auth/google/callback`

拿到 client_id / client_secret，写入 secrets：

```bash
echo "<client_id>" | bunx wrangler secret put GOOGLE_CLIENT_ID
echo "<client_secret>" | bunx wrangler secret put GOOGLE_CLIENT_SECRET
echo "https://museummap.xianliao.de5.net/auth/google/callback" | bunx wrangler secret put OAUTH_REDIRECT_URI
```

- [ ] **Step 2: 远程 D1 应用 migration**

```bash
bunx wrangler d1 execute museum-map-db --remote --file=migrations/0010_users.sql
```

- [ ] **Step 3: 部署**

```bash
bunx wrangler deploy
```

- [ ] **Step 4: 注册首位 admin（即用户自己）**

打开 https://museummap.xianliao.de5.net → 在侧边栏注册 → 拿到自己的 user_id：

```bash
bunx wrangler d1 execute museum-map-db --remote --command="SELECT id, email, is_admin FROM users LIMIT 5"
```

- [ ] **Step 5: 把现有 'me' 数据迁移到自己账号**

```bash
MY_ID=<paste-id-from-step-4>
bunx wrangler d1 execute museum-map-db --remote --command="UPDATE visits SET user_id='$MY_ID' WHERE user_id='me'; UPDATE review_cache SET user_id='$MY_ID' WHERE user_id='me'; UPDATE dynasty_review_cache SET user_id='$MY_ID' WHERE user_id='me';"
```

- [ ] **Step 6: 验证**

打开站点 → 应看到自己之前的足迹与朝代评价缓存。退出 → 重新匿名打卡 → 再登录 → 合并应成功。

- [ ] **Step 7: Commit 部署 note（如有 README 更新）**

```bash
git add README.md
git commit -m "docs(auth): deployment + data migration notes"
```

---

## Self-review note

- ✅ Spec coverage: users/sessions schema, scrypt, sessions cookie, google oauth, auth routes, admin migration, anon merge, sidebar UI, deployment+migration — 都有对应 task
- ✅ No placeholders: 每步要么是完整代码、要么是确切命令；Task 11 中 review handler 主体明确说"inline 现有代码并替换两处 userId"
- ✅ Type consistency: `UsersRepo` 方法名（findById / findByEmail / findByGoogleSub / setGoogleSub / setAdmin / countAll / touchLogin）在 AuthService 与 routes 中使用一致；`SessionsRepo` 同理
- ✅ Tests cover：crypto, cookies, email-norm, users-repo, sessions-repo, auth-service, google-oauth, auth-routes，外加现有 routes/repo 测试不破坏
