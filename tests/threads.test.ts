// tests/threads.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync } from "node:fs"
import { THREADS } from "~/data/threads"
import { GUQIN_RECORDINGS } from "~/data/guqin-recordings"

const eras = new Set(readdirSync("data/dynasties").map((f) => f.replace(/\.yaml$/, "")))
const len = (s: string) => Array.from(s).length

describe("THREADS", () => {
  it("has the 8 v1 threads with unique ids", () => {
    expect(THREADS.map((t) => t.id).sort()).toEqual(
      ["dufu-763", "libai", "libai-baidi", "sushi", "wangwei-anxi", "wentianxiang", "xuanzang", "zhangqian"],
    )
    expect(THREADS.filter((t) => t.kind === "person").length).toBe(4)
    expect(THREADS.filter((t) => t.kind === "poem").length).toBe(4)
  })
  it("every thread is well-formed", () => {
    for (const t of THREADS) {
      expect(eras.has(t.era)).toBe(true)
      expect(len(t.title)).toBeLessThanOrEqual(16)
      expect(len(t.intro)).toBeGreaterThan(0)
      expect(len(t.intro)).toBeLessThanOrEqual(80)
      expect(t.stops.length).toBeGreaterThanOrEqual(3)
      expect(t.stops.some((s) => s.trip)).toBe(true)
      if (t.kind === "poem") expect(t.poem?.text.length).toBeGreaterThan(10)
      if (t.recording) expect(GUQIN_RECORDINGS[t.recording]).toBeDefined()
      let prev = -Infinity
      for (const s of t.stops) {
        expect(s.year).toBeGreaterThanOrEqual(prev); prev = s.year
        expect(s.lat).toBeGreaterThan(-10); expect(s.lat).toBeLessThan(60)
        expect(s.lng).toBeGreaterThan(40); expect(s.lng).toBeLessThan(150)
        if (s.trip) { expect(s.lat).toBeGreaterThan(15); expect(s.lat).toBeLessThan(55); expect(s.lng).toBeGreaterThan(73); expect(s.lng).toBeLessThan(135) }
        expect(len(s.title)).toBeLessThanOrEqual(12)
        expect(len(s.story)).toBeGreaterThan(20)
        expect(len(s.story)).toBeLessThanOrEqual(120)
        expect(s.source.length).toBeGreaterThan(0)
      }
    }
  })
  it("a poem thread quotes its own poem", () => {
    for (const t of THREADS.filter((x) => x.kind === "poem")) {
      const quoted = t.stops.filter((s) => s.line)
      expect(quoted.length).toBeGreaterThanOrEqual(2)
      for (const s of quoted) expect(t.poem!.text.replace(/\s/g, "")).toContain(s.line!.replace(/\s/g, ""))
    }
  })
})

describe("THREADS modern names", () => {
  it("trip stops use the short 省+市 form ThreadCore.cityOf expects", () => {
    for (const t of THREADS) for (const s of t.stops) {
      if (!s.trip) continue
      expect(s.modern).not.toMatch(/省|自治区|维吾尔|壮族|回族/)
      expect(s.modern.length).toBeGreaterThanOrEqual(2)
    }
  })
})
