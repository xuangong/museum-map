import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { ScrollsRepo, newScrollId } from "~/repo/scrolls"

async function db() {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" }, d1Persist: ".wrangler/state/v3/d1" })
  return await mf.getD1Database("DB")
}

describe("ScrollsRepo", () => {
  it("ids are 8 chars from an unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) expect(newScrollId()).toMatch(/^[a-hjkmnp-z2-9]{8}$/)
  })
  it("creates, reads, and collects 观款", async () => {
    const repo = new ScrollsRepo(await db())
    const id = await repo.create({ kind: "voyage", payload: { name: "小明", visitedIds: ["guobo"] }, userId: null })
    const s = await repo.get(id)
    expect(s?.kind).toBe("voyage")
    expect(s?.payload.name).toBe("小明")
    expect(await repo.get("nope0000")).toBeNull()
    await repo.addGuan(id, "阿青")
    await repo.addGuan(id, null)
    const g = await repo.listGuan(id, 30)
    expect(g.count).toBe(2)
    expect(g.items.map((x) => x.name)).toEqual([null, "阿青"]) // newest first
  })
})
