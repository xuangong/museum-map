import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { parse } from "yaml"
import { HERE_CORE_SCRIPT } from "~/ui/client/here-core"
import { PLACE_LINEAGES } from "~/data/place-names"

const w: any = {}
new Function("window", HERE_CORE_SCRIPT)(w)
const H = w.HereCore

const XA = { lat: 34.26, lng: 108.94 }
const fx = {
  lineages: [{ id: "xian", name: "西安", lat: 34.26, lng: 108.94, names: [
    { era: "qin", name: "咸阳" }, { era: "western-han", name: "长安" }, { era: "tang", name: "长安" }, { era: "ming", name: "西安府" } ] }],
  museums: [
    { id: "shaanxi", name: "陕西历史博物馆", lat: 34.22, lng: 108.95 },
    { id: "far", name: "远馆", lat: 30.0, lng: 120.0 },
  ],
  dynasties: [
    { id: "qin", events: [{ date: "前246年", event: "骊山陵动工", lat: 34.38, lng: 109.27 }], recommendedMuseums: [], relatedMuseums: [] },
    { id: "western-han", events: [{ date: "前138年", event: "张骞出使", lat: 34.3, lng: 108.9 }, { date: "前202年", event: "定都长安", lat: 34.3, lng: 108.9 }],
      recommendedMuseums: [{ museumId: "shaanxi" }, { museumId: "far" }], relatedMuseums: [] },
    { id: "sui", events: [{ date: "605年", event: "远处的事", lat: 30.0, lng: 120.0 }], recommendedMuseums: [], relatedMuseums: [] },
    { id: "tang", events: [], recommendedMuseums: [], relatedMuseums: [{ museumId: "shaanxi" }] },
    { id: "ming", events: [], recommendedMuseums: [], relatedMuseums: [] },
  ],
}

describe("HereCore.year", () => {
  it("reads BCE, ranges and 约", () => {
    expect(H.year("前221年")).toBe(-221)
    expect(H.year("627—649年")).toBe(627)
    expect(H.year("约前1300年")).toBe(-1300)
    expect(H.year("")).toBe(0)
  })
})

describe("HereCore.read", () => {
  const r = H.read(XA, fx)
  it("finds the city within 40 km", () => {
    expect(r.city.name).toBe("西安")
    expect(r.city.km).toBeLessThan(1)
  })
  it("orders layers newest first and drops empty eras", () => {
    expect(r.layers.map((l: any) => l.dynastyId)).toEqual(["ming", "tang", "western-han", "qin"])
  })
  it("sorts events by year and keeps only those ≤ 50 km", () => {
    const han = r.layers.find((l: any) => l.dynastyId === "western-han")
    expect(han.events.map((e: any) => e.event)).toEqual(["定都长安", "张骞出使"])
    expect(r.layers.find((l: any) => l.dynastyId === "sui")).toBeUndefined()
  })
  it("lists linked museums ≤ 100 km with km", () => {
    const han = r.layers.find((l: any) => l.dynastyId === "western-han")
    expect(han.museums.map((m: any) => m.id)).toEqual(["shaanxi"])
    expect(han.museums[0].km).toBeGreaterThan(0)
    expect(r.layers.find((l: any) => l.dynastyId === "tang").museums[0].id).toBe("shaanxi")
  })
  it("headline = most frequent ancient name, ignoring today's name", () => {
    expect(H.headline(r)).toBe("长安")
  })
  it("no city in range → names absent, nearCity reported", () => {
    const p = { lat: 34.26, lng: 109.9 } // ~88 km east
    const q = H.read(p, fx)
    expect(q.city).toBeNull()
    expect(q.nearCity.name).toBe("西安")
    expect(q.nearCity.km).toBeGreaterThan(80)
    expect(q.layers.every((l: any) => !l.name)).toBe(true)
  })
  it("empty land → no layers, nearest story reported", () => {
    const q = H.read({ lat: 39.0, lng: 83.0 }, fx) // Taklamakan
    expect(q.layers).toEqual([])
    expect(q.nearest.event.event).toBeTruthy()
    expect(q.nearest.km).toBeGreaterThan(1000)
  })
})

describe("HereCore.read on real data", () => {
  const dynasties = readdirSync("data/dynasties").map((f) => parse(readFileSync(`data/dynasties/${f}`, "utf8")))
    .sort((a: any, b: any) => a.order_index - b.order_index)
    .map((d: any) => ({ id: d.id, events: d.events, recommendedMuseums: (d.recommended_museums || []).map((r: any) => ({ museumId: r.museum_id })), relatedMuseums: [] }))
  const museums = readdirSync("data/museums").map((f) => parse(readFileSync(`data/museums/${f}`, "utf8")))
    .map((m: any) => ({ id: m.id, name: m.name, lat: m.lat, lng: m.lng }))
  it("Xi'an reads as 长安 with a Tang layer full of events", () => {
    const r = H.read(XA, { dynasties, museums, lineages: PLACE_LINEAGES })
    expect(H.headline(r)).toBe("长安")
    const tang = r.layers.find((l: any) => l.dynastyId === "tang")
    expect(tang.name).toBe("长安")
    expect(tang.events.length).toBeGreaterThanOrEqual(3)
  })
})

describe("HereCore edge cases", () => {
  const P = { lat: 34.6, lng: 112.45 }
  const ms = [1, 2, 3].map((i) => ({ id: "m" + i, name: "馆" + i, lat: 34.6 + i * 0.01, lng: 112.45 }))
  it("an undated event keeps the chronicle's order", () => {
    const d = { id: "xia", events: [
      { date: "约前2070年", event: "a", lat: 34.6, lng: 112.45 },
      { date: "太康失国", event: "b", lat: 34.6, lng: 112.45 },
      { date: "约前1600年", event: "c", lat: 34.6, lng: 112.45 },
    ], recommendedMuseums: [], relatedMuseums: [] }
    const r = H.read(P, { dynasties: [d], museums: [], lineages: [] })
    expect(r.layers[0].events.map((e: any) => e.event)).toEqual(["a", "b", "c"])
  })
  it("de-duplicates museums across recommended/related and caps at 2", () => {
    const d = { id: "tang", events: [], recommendedMuseums: [{ museumId: "m3" }, { museumId: "m1" }], relatedMuseums: [{ museumId: "m1" }, { museumId: "m2" }] }
    const r = H.read(P, { dynasties: [d], museums: ms, lineages: [] })
    expect(r.layers[0].museums.map((m: any) => m.id)).toEqual(["m1", "m2"])
  })
  it("skips events and museums without coordinates", () => {
    const d = { id: "tang", events: [{ date: "700年", event: "x", lat: null, lng: null }], recommendedMuseums: [{ museumId: "nolng" }], relatedMuseums: [] }
    const r = H.read(P, { dynasties: [d], museums: [{ id: "nolng", name: "无经度", lat: 34.6, lng: null }], lineages: [] })
    expect(r.layers).toEqual([])
  })
  it("headline: a tie goes to the newer name; no city → null", () => {
    const city = { id: "c", name: "今", lat: 34.6, lng: 112.45, names: [{ era: "qin", name: "甲" }, { era: "tang", name: "乙" }] }
    const ds = ["qin", "tang"].map((id) => ({ id, events: [], recommendedMuseums: [], relatedMuseums: [] }))
    expect(H.headline(H.read(P, { dynasties: ds, museums: [], lineages: [city] }))).toBe("乙")
    expect(H.headline(H.read({ lat: 20, lng: 80 }, { dynasties: ds, museums: [], lineages: [city] }))).toBeNull()
  })
})
