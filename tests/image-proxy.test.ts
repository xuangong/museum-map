import { describe, it, expect, beforeAll } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

describe("GET /img/:hash", () => {
  let mf: Miniflare
  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {}",
      r2Buckets: ["IMAGES"],
      d1Databases: ["DB"],
      kvNamespaces: ["RATE"],
    })
    const bucket = await mf.getR2Bucket("IMAGES")
    await bucket.put("abc123.jpg", new Uint8Array([1, 2, 3, 4]), {
      httpMetadata: { contentType: "image/jpeg" },
    })
  })

  it("serves an existing object", async () => {
    const env = {
      DB: await mf.getD1Database("DB"),
      RATE: await mf.getKVNamespace("RATE"),
      IMAGES: await mf.getR2Bucket("IMAGES"),
    } as any
    const res = await createApp(env).handle(new Request("http://localhost/img/abc123.jpg"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/jpeg")
    expect(res.headers.get("cache-control")).toContain("immutable")
    const body = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(body)).toEqual([1, 2, 3, 4])
  })

  it("returns 404 for missing object", async () => {
    const env = {
      DB: await mf.getD1Database("DB"),
      RATE: await mf.getKVNamespace("RATE"),
      IMAGES: await mf.getR2Bucket("IMAGES"),
    } as any
    const res = await createApp(env).handle(new Request("http://localhost/img/nope.jpg"))
    expect(res.status).toBe(404)
  })
})
