import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { AuthService } from "~/services/auth"
import { InvitesRepo } from "~/repo/invites"

async function getDb() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
  })
  return mf.getD1Database("DB")
}

async function ensureAdmin(svc: AuthService, db: D1Database) {
  const r = await db.prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").first<{ id: string }>()
  if (r) return r.id
  const seed = await svc.register({ email: `seed-${Date.now()}@example.com`, password: "hunter2hunter" })
  return seed.user.id
}

async function newInvite(db: D1Database, adminId: string) {
  const inv = new InvitesRepo(db)
  const i = await inv.create({ createdBy: adminId, expiresAt: null, note: null })
  return i.code
}

describe("AuthService.register", () => {
  it("creates user + session, lowercases email", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const adminId = await ensureAdmin(svc, db)
    const code = await newInvite(db, adminId)
    const email = `R-${Date.now()}@Example.COM`
    const r = await svc.register({ email, password: "hunter2hunter", inviteCode: code })
    expect(r.user.email).toBe(email.toLowerCase())
    expect(r.session.id).toMatch(/^[0-9a-f]{64}$/)
  })

  it("rejects duplicate email", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const adminId = await ensureAdmin(svc, db)
    const c1 = await newInvite(db, adminId)
    const c2 = await newInvite(db, adminId)
    const email = `dup-${Date.now()}@example.com`
    await svc.register({ email, password: "hunter2hunter", inviteCode: c1 })
    await expect(svc.register({ email, password: "hunter2hunter", inviteCode: c2 })).rejects.toThrow(/email_taken/)
  })

  it("rejects weak password", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const adminId = await ensureAdmin(svc, db)
    const code = await newInvite(db, adminId)
    await expect(
      svc.register({ email: `w-${Date.now()}@example.com`, password: "short", inviteCode: code }),
    ).rejects.toThrow(/weak_password/)
  })

  it("rejects missing invite code (non-first user)", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    await ensureAdmin(svc, db)
    await expect(
      svc.register({ email: `ni-${Date.now()}@example.com`, password: "hunter2hunter" }),
    ).rejects.toThrow(/invite_required/)
  })

  it("rejects reuse of invite code", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const adminId = await ensureAdmin(svc, db)
    const code = await newInvite(db, adminId)
    await svc.register({ email: `u1-${Date.now()}@example.com`, password: "hunter2hunter", inviteCode: code })
    await expect(
      svc.register({ email: `u2-${Date.now()}@example.com`, password: "hunter2hunter", inviteCode: code }),
    ).rejects.toThrow(/invite_used/)
  })
})

describe("AuthService.login", () => {
  it("logs in with correct password", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const adminId = await ensureAdmin(svc, db)
    const code = await newInvite(db, adminId)
    const email = `l-${Date.now()}@example.com`
    await svc.register({ email, password: "hunter2hunter", inviteCode: code })
    const r = await svc.login({ email, password: "hunter2hunter" })
    expect(r.user.email).toBe(email)
  })

  it("rejects wrong password", async () => {
    const db = await getDb()
    const svc = new AuthService(db)
    const adminId = await ensureAdmin(svc, db)
    const code = await newInvite(db, adminId)
    const email = `lw-${Date.now()}@example.com`
    await svc.register({ email, password: "hunter2hunter", inviteCode: code })
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
    const adminId = await ensureAdmin(svc, db)
    const code = await newInvite(db, adminId)
    const email = `m-${Date.now()}@example.com`
    const { user } = await svc.register({ email, password: "hunter2hunter", inviteCode: code })
    const merged = await svc.mergeAnonymous(user.id, [
      { museumId: "anhui", visitedAt: 1000 },
      { museumId: "anhui", visitedAt: 2000 },
      { museumId: "guobo", visitedAt: 3000 },
    ])
    expect(merged).toBe(2)
  })
})
