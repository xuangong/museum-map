import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { MuseumsRepo } from "~/repo/museums"
import { DynastiesRepo } from "~/repo/dynasties"
import legacyData from "../legacy/data.json"

async function getDb() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
  })
  return mf.getD1Database("DB")
}

describe("MuseumsRepo.list", () => {
  it("returns 64 museums with list-payload fields", async () => {
    const db = await getDb()
    const repo = new MuseumsRepo(db)
    const list = await repo.list()
    expect(list).toHaveLength(64)
    const first = list[0]!
    expect(first).toHaveProperty("id")
    expect(first).toHaveProperty("name")
    expect(first).toHaveProperty("lat")
    expect(first).toHaveProperty("lng")
    expect(first).toHaveProperty("corePeriod")
    expect(first).toHaveProperty("dynastyCoverage")
  })
})

describe("MuseumsRepo.get", () => {
  it("returns full anhui museum matching legacy/data.json", async () => {
    const db = await getDb()
    const repo = new MuseumsRepo(db)
    const m = await repo.get("anhui")
    expect(m).not.toBeNull()
    const legacy = (legacyData as any).museums.find((x: any) => x.id === "anhui")
    expect(m!.name).toBe(legacy.name)
    expect(m!.lat).toBe(legacy.lat)
    expect(m!.lng).toBe(legacy.lng)
    expect(m!.location).toBe(legacy.location)
    expect(m!.level).toBe(legacy.level)
    expect(m!.corePeriod).toBe(legacy.corePeriod)
    expect(m!.specialty).toBe(legacy.specialty)
    expect(m!.dynastyCoverage).toBe(legacy.dynastyCoverage)
    expect(m!.timeline).toBe(legacy.timeline)
    expect(m!.treasures).toEqual(legacy.treasures)
    expect(m!.halls).toEqual(legacy.halls)
    expect(m!.artifacts.length).toBe(legacy.artifacts.length)
    legacy.artifacts.forEach((a: any, i: number) => {
      expect(m!.artifacts[i]!.name).toBe(a.name)
      expect(m!.artifacts[i]!.period ?? null).toBe(a.period ?? null)
      expect(m!.artifacts[i]!.description ?? null).toBe(a.description ?? null)
    })
    expect(m!.sources).toEqual(legacy.sources ?? [])
  })

  it("returns null for unknown id", async () => {
    const db = await getDb()
    const repo = new MuseumsRepo(db)
    expect(await repo.get("does-not-exist")).toBeNull()
  })
})

describe("DynastiesRepo", () => {
  it("listFull returns 20 dynasties in order_index order", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const list = await repo.listFull()
    expect(list).toHaveLength(20)
    const ids = list.map((d) => d.id)
    const expected = (legacyData as any).dynasties.map((d: any) => d.id)
    expect(ids).toEqual(expected)
  })

  it("listFull dynasty.culture is a [{category,description}] array, not a string", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const list = await repo.listFull()
    for (const d of list) {
      expect(Array.isArray(d.culture)).toBe(true)
      expect(d.culture.length).toBeGreaterThan(0)
      expect(typeof d.culture[0]!.category).toBe("string")
    }
  })

  it("listFull each dynasty has events array (preserves order)", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const list = await repo.listFull()
    const tang = list.find((d) => d.id === "tang")
    expect(tang).toBeDefined()
    const legacyTang = (legacyData as any).dynasties.find((d: any) => d.id === "tang")
    expect(tang!.events.length).toBe(legacyTang.events.length)
    expect(tang!.events[0]!.date).toBe(legacyTang.events[0].date)
    expect(tang!.events[0]!.event).toBe(legacyTang.events[0].event)
  })

  it("get(id) returns same shape as a list item", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    const single = await repo.get("tang")
    const list = await repo.listFull()
    const fromList = list.find((d) => d.id === "tang")
    expect(single).toEqual(fromList!)
  })

  it("get(id) returns null for unknown id", async () => {
    const db = await getDb()
    const repo = new DynastiesRepo(db)
    expect(await repo.get("nope")).toBeNull()
  })
})
