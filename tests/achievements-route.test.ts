import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"
import { AuthService } from "~/services/auth"
import { InvitesRepo } from "~/repo/invites"

async function makeEnv() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"],
    r2Buckets: ["IMAGES"],
  })
  const DB = await mf.getD1Database("DB")
  const RATE = await mf.getKVNamespace("RATE")
  const IMAGES = await mf.getR2Bucket("IMAGES")
  return { DB, RATE, IMAGES } as any
}

async function seedInvite(env: any): Promise<string> {
  const svc = new AuthService(env.DB)
  let adminId = ((await env.DB.prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").first()) as { id: string } | null)?.id
  if (!adminId) {
    const r = await svc.register({ email: `admin-${Date.now()}@example.com`, password: "hunter2hunter" })
    adminId = r.user.id
  }
  const i = await new InvitesRepo(env.DB).create({ createdBy: adminId!, expiresAt: null, note: null })
  return i.code
}

async function setup() {
  const env = await makeEnv()
  const app = createApp(env)
  const inviteCode = await seedInvite(env)
  const reg = await app.handle(new Request("http://localhost/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify({ email: `ach-${Date.now()}-${Math.random()}@example.com`, password: "hunter2hunter", inviteCode }),
  }))
  const sid = (reg.headers.get("set-cookie") || "").match(/sid=([^;]+)/)?.[1]
  return { app, cookie: `sid=${sid}` }
}

describe("/api/achievements", () => {
  it("401 without a session", async () => {
    const { app } = await setup()
    const res = await app.handle(new Request("http://localhost/api/achievements"))
    expect(res.status).toBe(401)
  })

  it("stores unlocks, ignores unknown ids, never lowers", async () => {
    const { app, cookie } = await setup()
    const post = (items: unknown) => app.handle(new Request("http://localhost/api/achievements", {
      method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ items }),
    }))
    expect((await post([{ id: "theme-sanguo", r: 1000, c: 1000 }, { id: "nope", r: 1, c: 0 }])).status).toBe(200)
    expect((await post([{ id: "theme-sanguo", r: 5000, c: 0 }])).status).toBe(200)
    const got = (await (await app.handle(new Request("http://localhost/api/achievements", { headers: { cookie } }))).json()) as any
    expect(got.items).toEqual({ "theme-sanguo": { r: 1000, c: 1000 } })
  })
})
