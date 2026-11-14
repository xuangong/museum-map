// tests/trip-routes.test.ts
import { describe, it, expect, afterEach } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"],
    r2Buckets: ["IMAGES"],
  })
  return { DB: await mf.getD1Database("DB"), RATE: await mf.getKVNamespace("RATE"), IMAGES: await mf.getR2Bucket("IMAGES") } as any
}
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } })

describe("trip endpoints", () => {
  it("GET /api/geocode returns places", async () => {
    globalThis.fetch = (async () => json([{ name: "洛阳市", lat: "34.62", lon: "112.45", addresstype: "city", address: { state: "河南省" } }])) as any
    const app = createApp(await makeEnv())
    const res = await app.handle(new Request("http://localhost/api/geocode?q=" + encodeURIComponent("洛阳-test-" + Date.now())))
    expect(res.status).toBe(200)
    expect((await res.json()) as any).toEqual([{ name: "洛阳市", lat: 34.62, lng: 112.45, province: "河南省" }])
  })

  it("GET /api/route validates points", async () => {
    const app = createApp(await makeEnv())
    const res = await app.handle(new Request("http://localhost/api/route?pts=abc"))
    expect(res.status).toBe(400)
  })

  it("GET /api/route falls back to a straight line", async () => {
    globalThis.fetch = (async () => { throw new Error("offline") }) as any
    const app = createApp(await makeEnv())
    const res = await app.handle(new Request("http://localhost/api/route?pts=39.909,116.397;34.341,108.94"))
    expect(res.status).toBe(200)
    const r = (await res.json()) as any
    expect(r.provider).toBe("line")
    expect(r.line.length).toBe(2)
  })
})
