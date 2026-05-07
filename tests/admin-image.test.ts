import { describe, it, expect, beforeAll } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"
import { readFileSync } from "node:fs"

describe("POST /api/admin/set-artifact-image", () => {
  let mf: Miniflare
  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {}",
      r2Buckets: ["IMAGES"],
      d1Databases: ["DB"],
      kvNamespaces: ["RATE"],
      bindings: { ADMIN_TOKEN: "test-token" },
    })
    const db = await mf.getD1Database("DB")
    const sql = readFileSync("migrations/0001_init.sql", "utf-8")
    for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run()
    }
    // Apply later migrations needed for image columns + provenance:
    for (const mig of ["0006_field_provenance.sql", "0007_artifact_images.sql"]) {
      const text = readFileSync(`migrations/${mig}`, "utf-8")
      for (const stmt of text.split(";").map((s) => s.trim()).filter(Boolean)) {
        await db.prepare(stmt).run()
      }
    }
    await db.prepare(
      `INSERT INTO museums (id, name, lat, lng) VALUES ('m1', 'Test', 0, 0)`,
    ).run()
    await db.prepare(
      `INSERT INTO museum_artifacts (museum_id, order_index, name) VALUES ('m1', 0, '玉璧')`,
    ).run()
  })

  const buildEnv = async () => ({
    DB: await mf.getD1Database("DB"),
    RATE: await mf.getKVNamespace("RATE"),
    IMAGES: await mf.getR2Bucket("IMAGES"),
    ADMIN_TOKEN: "test-token",
  } as any)

  it("rejects without admin token", async () => {
    const env = await buildEnv()
    const res = await createApp(env).handle(
      new Request("http://localhost/api/admin/set-artifact-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ museumId: "m1", artifactIdx: 0, imageUrl: "/img/abc.jpg", license: "fair-use", attribution: "test" }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it("updates artifact image fields", async () => {
    const env = await buildEnv()
    const res = await createApp(env).handle(
      new Request("http://localhost/api/admin/set-artifact-image", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": "test-token" },
        body: JSON.stringify({
          museumId: "m1",
          artifactIdx: 0,
          imageUrl: "/img/abc.jpg",
          license: "fair-use",
          attribution: "来源：百度百科 · https://baike.baidu.com/item/x",
          sourceUrl: "https://baike.baidu.com/item/x",
          authority: "encyclopedia",
        }),
      }),
    )
    expect(res.status).toBe(200)
    const row: any = await env.DB.prepare(
      `SELECT image_url, image_license, image_attribution FROM museum_artifacts WHERE museum_id='m1' AND order_index=0`,
    ).first()
    expect(row.image_url).toBe("/img/abc.jpg")
    expect(row.image_license).toBe("fair-use")
    expect(row.image_attribution).toContain("百度百科")
  })
})
