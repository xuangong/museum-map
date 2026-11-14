// tests/achievements-core.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { ACH_CORE_SCRIPT } from "~/ui/client/achievements-core"
import { ACHIEVEMENTS } from "~/data/achievements"
import { deriveCity, deriveProvince } from "~/services/museum-meta"

const w: any = {}
new Function("window", ACH_CORE_SCRIPT)(w)
const A = w.AchCore

const museums = [
  { id: "a", city: "大同", province: "山西" }, { id: "b", city: "大同", province: "山西" },
  { id: "c", city: "洛阳", province: "河南" }, { id: "d", city: "洛阳", province: "河南" },
  { id: "e", city: "西安", province: "陕西" }, { id: "f", city: "北京", province: "北京" },
]
const catalog = [
  { id: "t1", line: "theme", members: [{ museum: "a" }, { museum: "b" }, { museum: "c" }, { museum: "d" }], reach: 3 },
  { id: "t2", line: "theme", members: [{ city: "西安" }, { city: "洛阳" }, { city: "北京" }], reach: 3 },
  { id: "r1", line: "region", provinces: ["山西", "北京", "天津"] },
  { id: "r2", line: "region", provinces: ["陕西"] },
  { id: "m1", line: "region", share: 0.5 },
  { id: "s1", line: "era", layers: [1, 3] },
  { id: "c3", line: "era", chain: 3 },
]
const eras = { a: [1], b: [2], c: [3, 4], d: [6], e: [5], f: [20] }
const ctx = (visited: string[]) => ({ visited, museums, eras, layers: 20 })
const by = (rs: any[]) => Object.fromEntries(rs.map((r: any) => [r.id, r]))

describe("AchCore.evaluate", () => {
  it("theme: reach → level 1, all → level 2, missing listed", () => {
    let r = by(A.evaluate(catalog, ctx(["a", "c"])))
    expect([r.t1.level, r.t1.have, r.t1.reach, r.t1.total]).toEqual([0, 2, 3, 4])
    expect(r.t1.missing).toEqual([{ museum: "b" }, { museum: "d" }])
    r = by(A.evaluate(catalog, ctx(["a", "b", "c"])))
    expect(r.t1.level).toBe(1)
    r = by(A.evaluate(catalog, ctx(["a", "b", "c", "d"])))
    expect(r.t1.level).toBe(2)
  })

  it("theme with city members: any museum in the city counts", () => {
    const r = by(A.evaluate(catalog, ctx(["d", "e"])))
    expect([r.t2.have, r.t2.missing]).toEqual([2, [{ city: "北京" }]])
  })

  it("region: first visit → 1; every province that has museums → 2 (天津 has none, so it doesn't count)", () => {
    let r = by(A.evaluate(catalog, ctx(["a"])))
    expect([r.r1.level, r.r1.have, r.r1.total, r.r1.missing]).toEqual([1, 1, 2, [{ province: "北京" }]])
    r = by(A.evaluate(catalog, ctx(["a", "f"])))
    expect(r.r1.level).toBe(2)
    expect(r.r2.level).toBe(0)
  })

  it("milestone: share of provinces that have museums", () => {
    // 4 provinces have museums → share 0.5 needs 2
    expect(by(A.evaluate(catalog, ctx(["a"]))).m1.level).toBe(0)
    expect(by(A.evaluate(catalog, ctx(["a", "e"]))).m1).toMatchObject({ level: 2, have: 2, reach: 2, total: 2 })
  })

  it("era segment: each layer needs a visited museum", () => {
    let r = by(A.evaluate(catalog, ctx(["a", "c"])))
    expect([r.s1.level, r.s1.have, r.s1.missing]).toEqual([0, 2, [{ layer: 2 }]])
    r = by(A.evaluate(catalog, ctx(["a", "b", "c"])))
    expect(r.s1.level).toBe(2)
  })

  it("chain: longest consecutive run", () => {
    expect(by(A.evaluate(catalog, ctx(["a", "b"]))).c3).toMatchObject({ level: 0, have: 2 })
    expect(by(A.evaluate(catalog, ctx(["a", "b", "c"]))).c3).toMatchObject({ level: 2, have: 3 })
  })
})

describe("AchCore.merge", () => {
  it("never lowers a stored level; records new ones with time", () => {
    const stored = { t1: { r: 100, c: 0 } }
    const results = [{ id: "t1", level: 0 }, { id: "s1", level: 2 }, { id: "r1", level: 1 }]
    const { next, fresh } = A.merge(stored, results, 500)
    expect(next).toEqual({ t1: { r: 100, c: 0 }, s1: { r: 500, c: 500 }, r1: { r: 500, c: 0 } })
    expect(fresh).toEqual([{ id: "s1", level: 2 }, { id: "r1", level: 1 }])
  })
  it("upgrades 1 → 2", () => {
    const { next, fresh } = A.merge({ t1: { r: 100, c: 0 } }, [{ id: "t1", level: 2 }], 900)
    expect(next.t1).toEqual({ r: 100, c: 900 })
    expect(fresh).toEqual([{ id: "t1", level: 2 }])
  })
  it("levelOf combines stored and computed", () => {
    expect(A.levelOf({ t1: { r: 1, c: 0 } }, { id: "t1", level: 0 })).toBe(1)
    expect(A.levelOf({}, { id: "t1", level: 2 })).toBe(2)
  })
})

describe("AchCore.nudges", () => {
  it("names what visiting a museum would do", () => {
    const res = A.evaluate(catalog, ctx(["a", "c"]))
    const n = A.nudges(catalog, res, museums.find((m) => m.id === "b"), eras)
    expect(n.map((x: any) => [x.id, x.kind])).toEqual([["t1", "last"], ["s1", "last"]])
    const n2 = A.nudges(catalog, res, museums.find((m) => m.id === "e"), eras)
    expect(n2.map((x: any) => [x.id, x.kind])).toEqual([["r2", "first"], ["t2", "advance"]])
  })
})

describe("AchCore with the real catalog", () => {
  it("大同 + 云冈 + 汉魏洛阳 → 千都 3/4; 龙门 would complete it", () => {
    const real = readdirSync("data/museums").map((f) => {
      const loc = readFileSync("data/museums/" + f, "utf8").match(/^location: (.*)$/m)?.[1] ?? null
      return { id: f.replace(/\.yaml$/, ""), city: deriveCity(loc), province: deriveProvince(loc) }
    })
    const res = A.evaluate(ACHIEVEMENTS, { visited: ["shanxi-datong", "yungang", "hanwei-luoyang"], museums: real, eras: {}, layers: 20 })
    expect(by(res)["theme-qiandu"]).toMatchObject({ level: 0, have: 3, reach: 4 })
    const n = A.nudges(ACHIEVEMENTS, res, real.find((m) => m.id === "longmen"), {})
    expect(n[0]).toMatchObject({ id: "theme-qiandu", kind: "last" })
  })
})
