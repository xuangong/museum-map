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
      { museumId: "anhui", visitedAt: 2000 },
      { museumId: "guobo", visitedAt: 3000 },
    ])
    expect(merged).toBe(2)
  })
})
