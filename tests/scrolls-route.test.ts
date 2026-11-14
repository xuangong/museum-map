import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" }, d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"], r2Buckets: ["IMAGES"] })
  return { DB: await mf.getD1Database("DB"), RATE: await mf.getKVNamespace("RATE"), IMAGES: await mf.getR2Bucket("IMAGES") } as any
}
const post = (app: any, path: string, body: unknown, ip = "1.2.3.4") =>
  app.handle(new Request("http://localhost" + path, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }))

describe("scrolls routes", () => {
  it("seals a voyage scroll with a frozen 干支 and filtered stamps", async () => {
    const app = createApp(await makeEnv())
    const r = await post(app, "/api/scrolls", { kind: "voyage", name: " 小明 ", visitedIds: ["guobo", "not-a-museum"] }, "10.0.0.1")
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.id).toMatch(/^[a-hjkmnp-z2-9]{8}$/)
    expect(j.url).toBe("/s/" + j.id)
    const env = await makeEnv()
    const row: any = await env.DB.prepare("SELECT payload FROM share_scrolls WHERE id = ?").bind(j.id).first()
    const p = JSON.parse(row.payload)
    expect(p.name).toBe("小明")
    expect(p.visitedIds).toEqual(["guobo"])
    expect(p.ganzhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/)
    expect(typeof p.term).toBe("string")
  })
  it("validates kind, seed, achId", async () => {
    const app = createApp(await makeEnv())
    expect((await post(app, "/api/scrolls", { kind: "poster" }, "10.0.0.2")).status).toBe(400)
    expect((await post(app, "/api/scrolls", { kind: "tune" }, "10.0.0.2")).status).toBe(400)
    expect((await post(app, "/api/scrolls", { kind: "seal", achId: "nope" }, "10.0.0.2")).status).toBe(400)
    expect((await post(app, "/api/scrolls", { kind: "tune", seed: 42 }, "10.0.0.2")).status).toBe(200)
    expect((await post(app, "/api/scrolls", { kind: "seal", achId: "theme-shiku" }, "10.0.0.2")).status).toBe(200)
  })
  it("defaults the name to 无名氏 and drops ads", async () => {
    const app = createApp(await makeEnv())
    const j = await (await post(app, "/api/scrolls", { kind: "scroll", name: "加我微信", line: "www.x.cn" }, "10.0.0.3")).json()
    const env = await makeEnv()
    const p = JSON.parse(((await env.DB.prepare("SELECT payload FROM share_scrolls WHERE id = ?").bind(j.id).first()) as any).payload)
    expect(p.name).toBe("无名氏")
    expect(p.line).toBe("")
  })
  it("观款: one per IP per scroll, names filtered", async () => {
    const app = createApp(await makeEnv())
    const { id } = await (await post(app, "/api/scrolls", { kind: "voyage" }, "10.0.0.4")).json()
    const g1 = await post(app, "/api/s/" + id + "/guan", { name: "阿青" }, "10.0.0.5")
    expect(g1.status).toBe(200)
    expect((await g1.json()).items[0].name).toBe("阿青")
    expect((await post(app, "/api/s/" + id + "/guan", { name: "又来" }, "10.0.0.5")).status).toBe(409)
    const g3 = await post(app, "/api/s/" + id + "/guan", { name: "http://x" }, "10.0.0.6")
    expect((await g3.json()).items[0].name).toBeNull()
    const list: any = await (await app.handle(new Request("http://localhost/api/s/" + id + "/guan"))).json()
    expect(list.count).toBe(2)
    expect((await post(app, "/api/s/zzzzzzzz/guan", {}, "10.0.0.7")).status).toBe(404)
  })
  it("old poster link redirects to the profile", async () => {
    const app = createApp(await makeEnv())
    const r = await app.handle(new Request("http://localhost/u/somebody/share"))
    expect(r.status).toBe(301)
    expect(r.headers.get("location")).toBe("/u/somebody")
  })
})
