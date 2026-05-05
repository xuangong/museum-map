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
    expect(u.id).toMatch(/^[0-9a-f]{26}$/)
    const byId = await repo.findById(u.id)
    expect(byId?.email).toBe(email)
    const byEmail = await repo.findByEmail(email)
    expect(byEmail?.id).toBe(u.id)

    await repo.setGoogleSub(u.id, `google-sub-${Date.now()}-${Math.random()}`)
    const byGoogle = await repo.findByGoogleSub((await repo.findById(u.id))!.google_sub!)
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
