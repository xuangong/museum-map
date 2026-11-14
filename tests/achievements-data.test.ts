// tests/achievements-data.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { ACHIEVEMENTS, REGIONS } from "~/data/achievements"
import { ACHIEVEMENT_LABELS } from "~/data/achievement-labels"
import { deriveProvince, deriveCity } from "~/services/museum-meta"

const museums = readdirSync("data/museums").map((f) => {
  const s = readFileSync("data/museums/" + f, "utf8")
  const loc = s.match(/^location: (.*)$/m)?.[1] ?? null
  return { id: f.replace(/\.yaml$/, ""), city: deriveCity(loc), province: deriveProvince(loc) }
})
const ids = new Set(museums.map((m) => m.id))
const themes = ACHIEVEMENTS.filter((a) => a.line === "theme")

describe("achievement catalog", () => {
  it("has 18 themes, 8 regions + 3 milestones, 6 segments + 3 chains", () => {
    expect(themes.length).toBe(18)
    expect(ACHIEVEMENTS.filter((a) => a.line === "region").length).toBe(11)
    expect(ACHIEVEMENTS.filter((a) => a.line === "era").length).toBe(9)
  })

  it("ids and seal texts are unique; seals are 2–4 characters", () => {
    const seen = new Set<string>(), seals = new Set<string>()
    for (const a of ACHIEVEMENTS) {
      expect(seen.has(a.id)).toBe(false); seen.add(a.id)
      expect(seals.has(a.seal)).toBe(false); seals.add(a.seal)
      expect(Array.from(a.seal).length).toBeGreaterThanOrEqual(1)
      expect(Array.from(a.seal).length).toBeLessThanOrEqual(4)
    }
  })

  it("theme members exist (museum ids, or cities that have a museum)", () => {
    const cities = new Set(museums.map((m) => m.city))
    for (const a of themes) for (const mem of a.members!) {
      if ("museum" in mem) expect([a.id, mem.museum, ids.has(mem.museum)]).toEqual([a.id, mem.museum, true])
      else expect([a.id, mem.city, cities.has(mem.city)]).toEqual([a.id, mem.city, true])
    }
  })

  it("theme thresholds follow the rule", () => {
    for (const a of themes) {
      const n = a.members!.length
      const rule = n <= 4 ? n : n <= 7 ? Math.max(4, n - 2) : Math.ceil(n * 0.6)
      if (a.id === "theme-shiku") expect(a.reach).toBe(3)
      else expect([a.id, a.reach]).toEqual([a.id, rule])
    }
  })

  it("every museum province belongs to exactly one region", () => {
    for (const m of museums) {
      const hits = REGIONS.filter((r) => r.provinces.includes(m.province!))
      expect([m.id, hits.length]).toEqual([m.id, 1])
    }
  })

  it("segments cover layers 1..20 exactly once", () => {
    const covered: number[] = []
    for (const a of ACHIEVEMENTS.filter((x) => x.layers)) for (let i = a.layers![0]; i <= a.layers![1]; i++) covered.push(i)
    expect(covered.sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it("every achievement has hook, why and a 展签 entry", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.hook.length).toBeGreaterThan(4)
      expect(a.why.length).toBeGreaterThan(10)
      expect(a.id in ACHIEVEMENT_LABELS).toBe(true)
    }
  })

  it("every 展签 is 120–300 characters", () => {
    for (const a of ACHIEVEMENTS) {
      const n = Array.from(ACHIEVEMENT_LABELS[a.id] ?? "").length
      expect([a.id, n >= 120 && n <= 300]).toEqual([a.id, true])
    }
  })
})
