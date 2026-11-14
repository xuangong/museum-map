import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" }, d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"], r2Buckets: ["IMAGES"] })
  return { DB: await mf.getD1Database("DB"), RATE: await mf.getKVNamespace("RATE"), IMAGES: await mf.getR2Bucket("IMAGES") } as any
}

describe("GET /s/:id", () => {
  it("renders a voyage scroll with title, colophon, seasons, escaped text", async () => {
    const app = createApp(await makeEnv())
    const { id } = (await (await app.handle(new Request("http://localhost/api/scrolls", { method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.9.0.1" },
      body: JSON.stringify({ kind: "voyage", name: "小明", line: "雪<夜>访古", visitedIds: ["guobo"] }) }))).json()) as { id: string }
    const r = await app.handle(new Request("http://localhost/s/" + id))
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain("<title>小明寄来一卷 ·《溯洄从之》</title>")
    expect(html).toContain("溯洄图卷")
    expect(html).toContain("溯洄而上，自今及于新石器")
    expect(html).toContain("展开你自己的一卷")
    expect(html).toContain("钤一方「观」")
    expect(html).not.toContain("雪<夜>访古")
    expect(html).not.toContain("分享")
  })
  it("lost scrolls read 此卷已佚", async () => {
    const app = createApp(await makeEnv())
    const r = await app.handle(new Request("http://localhost/s/zzzzzzzz"))
    expect(r.status).toBe(404)
    expect(await r.text()).toContain("此卷已佚")
  })
})
