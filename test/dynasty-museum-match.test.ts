import { describe, expect, it } from "bun:test"
import { buildEvidence, dynastyAliases } from "~/services/dynasty-museum-match"

describe("dynastyAliases", () => {
  it("夏朝 → only 夏朝/夏代 (no bare 夏)", () => {
    const a = dynastyAliases("夏朝（约公元前2070年—前1600年）")
    expect(a).toContain("夏朝")
    expect(a).toContain("夏代")
    expect(a).not.toContain("夏")
  })
  it("西汉 → 西汉 + 汉", () => {
    const a = dynastyAliases("西汉（公元前202年—公元9年）")
    expect(a).toContain("西汉")
    expect(a).not.toContain("汉")
  })
  it("唐朝 → 唐朝/唐代 (no bare 唐)", () => {
    const a = dynastyAliases("唐朝（公元618年—907年）")
    expect(a).toEqual(expect.arrayContaining(["唐朝", "唐代"]))
    expect(a).not.toContain("唐")
  })
  it("东周：春秋与战国 → 东周/春秋/战国", () => {
    const a = dynastyAliases("东周：春秋与战国（公元前770年—前221年）")
    expect(a).toEqual(expect.arrayContaining(["东周", "春秋", "战国"]))
  })
})

describe("buildEvidence collision filter", () => {
  const dyn = { id: "xia", name: "夏朝（约公元前2070年—前1600年）" }
  it("does NOT match 西夏", () => {
    const evs = buildEvidence(dyn, [
      { id: "ningxia", name: "宁夏回族自治区博物馆", corePeriod: "西夏（1038-1227）", dynastyCoverage: null },
    ], [])
    expect(evs).toEqual([])
  })
  it("does match 夏代/夏朝", () => {
    const evs = buildEvidence(dyn, [
      { id: "erlitou", name: "二里头夏都遗址博物馆", corePeriod: "夏代晚期（公元前1750—前1530年）", dynastyCoverage: null },
    ], [])
    expect(evs.length).toBe(1)
    expect(evs[0].signals.length).toBeGreaterThan(0)
  })
})
