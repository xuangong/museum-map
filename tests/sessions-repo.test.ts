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
