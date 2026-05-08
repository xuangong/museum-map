import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"
import { AuthService } from "~/services/auth"
import { InvitesRepo } from "~/repo/invites"

async function makeEnv(extra: Record<string, string> = {}) {
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
  return { DB, RATE, IMAGES, ...extra } as any
}

async function seedInvite(env: any): Promise<string> {
  const svc = new AuthService(env.DB)
  let adminId = ((await env.DB.prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").first()) as { id: string } | null)?.id
  if (!adminId) {
    const r = await svc.register({ email: `admin-${Date.now()}@example.com`, password: "hunter2hunter" })
    adminId = r.user.id
  }
  const inv = new InvitesRepo(env.DB)
  const i = await inv.create({ createdBy: adminId!, expiresAt: null, note: null })
  return i.code
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
    const inviteCode = await seedInvite(env)
    const email = `r-${Date.now()}@example.com`
    const reg = await app.handle(new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ email, password: "hunter2hunter", inviteCode }),
    }))
    expect(reg.status).toBe(200)
    const sid = getCookie(reg, "sid")
    expect(sid).toBeTruthy()
    const me = await app.handle(new Request("http://localhost/auth/me", { headers: { cookie: `sid=${sid}` } }))
    const meBody = (await me.json()) as any
    expect(meBody.user?.email).toBe(email)
    const out = await app.handle(new Request("http://localhost/auth/logout", {
      method: "POST",
      headers: { cookie: `sid=${sid}`, origin: "http://localhost", host: "localhost" },
    }))
    expect(out.status).toBe(204)
    const me2 = await app.handle(new Request("http://localhost/auth/me", { headers: { cookie: `sid=${sid}` } }))
    const me2Body = (await me2.json()) as any
    expect(me2Body.user).toBeNull()
  })

  it("login rejects wrong password", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const inviteCode = await seedInvite(env)
    const email = `lw-${Date.now()}@example.com`
    await app.handle(new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ email, password: "hunter2hunter", inviteCode }),
    }))
    const r = await app.handle(new Request("http://localhost/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ email, password: "wrong" }),
    }))
    expect(r.status).toBe(401)
  })

  it("CSRF: rejects POST when Origin host mismatches Host", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const r = await app.handle(new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://evil.example", host: "localhost" },
      body: JSON.stringify({ email: `c-${Date.now()}@example.com`, password: "hunter2hunter" }),
    }))
    expect(r.status).toBe(403)
  })

  it("merge-anonymous returns 401 without session", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const r = await app.handle(new Request("http://localhost/auth/merge-anonymous", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost", host: "localhost" },
      body: JSON.stringify({ visits: [] }),
    }))
    expect(r.status).toBe(401)
  })
})
