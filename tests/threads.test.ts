// tests/threads.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync } from "node:fs"
import { THREADS } from "~/data/threads"
import { GUQIN_RECORDINGS } from "~/data/guqin-recordings"
import { ERA_ACCENTS } from "~/data/era-accents"

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


describe("magazine features", () => {
  const mags = THREADS.filter((t) => t.acts)
  it("acts cover every stop once, in order", () => {
    for (const t of mags) {
      const acts = t.acts!
      expect(acts.length).toBeGreaterThanOrEqual(4); expect(acts.length).toBeLessThanOrEqual(6)
      expect(acts[0]!.stops[0]).toBe(0)
      expect(acts[acts.length - 1]!.stops[1]).toBe(t.stops.length - 1)
      for (let k = 1; k < acts.length; k++) expect(acts[k]!.stops[0]).toBe(acts[k - 1]!.stops[1] + 1)
      for (const a of acts) expect(a.stops[1]).toBeGreaterThanOrEqual(a.stops[0])
    }
  })
  it("lengths, quotes, sources", () => {
    for (const t of mags) {
      expect(len(t.mag!)).toBeGreaterThanOrEqual(2); expect(len(t.mag!)).toBeLessThanOrEqual(4)
      expect(len(t.deck!)).toBeLessThanOrEqual(40)
      expect(len(t.opening!)).toBeGreaterThanOrEqual(150); expect(len(t.opening!)).toBeLessThanOrEqual(240)
      for (const a of t.acts!) {
        const body = a.body.join("")
        expect(len(body)).toBeGreaterThanOrEqual(280); expect(len(body)).toBeLessThanOrEqual(420)
        expect(len(a.title)).toBeGreaterThanOrEqual(2); expect(len(a.title)).toBeLessThanOrEqual(6)
        expect(a.source.length).toBeGreaterThan(0)
        if (a.quote) { expect(a.quote.text.length).toBeGreaterThan(0); expect(a.quote.source.length).toBeGreaterThan(0) }
        if (a.quote && a.quote.at != null) { expect(a.quote.at).toBeGreaterThanOrEqual(0); expect(a.quote.at).toBeLessThan(a.body.length) }
      }
    }
  })
  it("images are self-hosted and fully credited", () => {
    for (const t of mags) {
      const imgs = [t.cover!, ...t.acts!.map((a) => a.image).filter(Boolean)] as any[]
      for (const im of imgs) {
        expect(im.src).toMatch(/^\/img\/xj-[a-z0-9-]+-[0-9a-f]{16}\.jpg$/)
        for (const k of ["work", "by", "where", "license"]) expect(String(im[k]).length).toBeGreaterThan(0)
        expect(im.w).toBeGreaterThan(0)
        expect(im.h).toBeGreaterThan(0)
      }
    }
  })
  it("pilot threads carry a magazine", () => {
    expect(mags.map((t) => t.id)).toEqual(expect.arrayContaining(["sushi", "zhangqian"]))
  })
  it("every era has an accent", () => {
    for (const t of THREADS) expect(ERA_ACCENTS[t.era]).toMatch(/^#[0-9A-F]{6}$/i)
  })
})

describe("paged features", () => {
  const paged = THREADS.filter((t) => t.chapters)
  const L = (x: string[] | undefined) => (x || []).reduce((n, p) => n + len(p), 0)
  it("chapters cover every stop once, in order", () => {
    for (const t of paged) {
      const cs = t.chapters!
      if (t.kind === "person") { expect(cs.length).toBeGreaterThanOrEqual(5); expect(cs.length).toBeLessThanOrEqual(7) }
      else { expect(cs.length).toBeGreaterThanOrEqual(3); expect(cs.length).toBeLessThanOrEqual(6) }
      expect(cs[0]!.stops[0]).toBe(0)
      expect(cs[cs.length - 1]!.stops[1]).toBe(t.stops.length - 1)
      for (let k = 1; k < cs.length; k++) expect(cs[k]!.stops[0]).toBe(cs[k - 1]!.stops[1] + 1)
    }
  })
  it("pages are well-formed", () => {
    for (const t of paged) {
      let total = 0
      for (const c of t.chapters!) {
        expect(c.pages.length).toBeGreaterThanOrEqual(6); expect(c.pages.length).toBeLessThanOrEqual(14)
        expect(c.pages[0]!.kind).toBe("opener")
        expect(c.pages.some((p) => p.kind === "map")).toBe(true)
        expect(c.source.length).toBeGreaterThan(0)
        for (const p of c.pages) {
          if (p.kind === "text") { const n = L(p.paras); total += n; expect(n).toBeGreaterThanOrEqual(120); expect(n).toBeLessThanOrEqual(220) }
          if (p.kind === "object") { const n = L(p.paras); total += n; expect(n).toBeLessThanOrEqual(220) }
          if (p.kind === "quote") { expect(p.text.length).toBeGreaterThan(0); expect(p.source.length).toBeGreaterThan(0) }
          if (p.kind === "people") { expect(p.people.length).toBeGreaterThanOrEqual(2); expect(p.people.length).toBeLessThanOrEqual(4); for (const x of p.people) expect(x.name && x.role && x.line).toBeTruthy() }
          const im = p.kind === "image" ? p.image : p.kind === "object" ? p.image : undefined
          if (im) { expect(im.src).toMatch(/^\/img\/xj-[a-z0-9-]+-[0-9a-f]{16}\.jpg$/); if (im.commons) expect(im.commons).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/); for (const k of ["work", "by", "where", "license"] as const) expect(String(im[k]).length).toBeGreaterThan(0); expect((im as any).w).toBeGreaterThan(0); expect((im as any).h).toBeGreaterThan(0) }
          if (p.kind === "image") expect(p.caption.length).toBeGreaterThan(0)
        }
      }
      // A life runs 5000–9000 字; a poem's road is shorter, 2000–6000.
      if (t.kind === "person") { expect(total).toBeGreaterThanOrEqual(5000); expect(total).toBeLessThanOrEqual(9000) }
      else { expect(total).toBeGreaterThanOrEqual(2000); expect(total).toBeLessThanOrEqual(6000) }
    }
  })
})

describe("every thread is a book", () => {
  it("has mag, deck, opening and chapters", () => {
    const missing = THREADS.filter((t) => !t.chapters || !t.mag || !t.deck || !t.opening).map((t) => t.id)
    expect(missing).toEqual([])
  })
})
