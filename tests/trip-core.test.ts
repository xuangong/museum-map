// tests/trip-core.test.ts
import { describe, it, expect } from "bun:test"
import { TRIP_CORE_SCRIPT } from "~/ui/client/trip-core"

const w: any = {}
new Function("window", TRIP_CORE_SCRIPT)(w)
const T = w.TripCore

const BJ = { lat: 39.909, lng: 116.397 }, LY = { lat: 34.619, lng: 112.454 }, XA = { lat: 34.341, lng: 108.94 }

describe("TripCore geometry", () => {
  it("along(): distance to a line and position along it", () => {
    const line = [[BJ.lat, BJ.lng], [LY.lat, LY.lng], [XA.lat, XA.lng]]
    const zz = { lat: 34.75, lng: 113.62 } // 郑州, a little off the 北京→洛阳 straight line
    const r = T.along(zz, line)
    expect(r.km).toBeLessThan(120)
    expect(r.at).toBeGreaterThan(500)
    expect(r.at).toBeLessThan(T.lineKm(line))
    expect(T.along(BJ, line).at).toBeCloseTo(0, 5)
  })

  it("stopsAlong(): museums within radius, ordered by position", () => {
    const line = [[BJ.lat, BJ.lng], [XA.lat, XA.lng]]
    const ms = [
      { id: "far", lat: 30, lng: 100 },
      { id: "xa", lat: 34.34, lng: 108.95 },
      { id: "bj", lat: 39.91, lng: 116.39 },
    ]
    const s = T.stopsAlong(ms, line, 30)
    expect(s.map((x: any) => x.m.id)).toEqual(["bj", "xa"])
  })

  it("stopsNearCities(): each museum goes to its nearest city in range", () => {
    const cities = [{ name: "北京", ...BJ }, { name: "西安", ...XA }]
    const ms = [{ id: "a", lat: 39.92, lng: 116.4 }, { id: "b", lat: 34.3, lng: 108.9 }, { id: "c", lat: 30, lng: 100 }]
    const s = T.stopsNearCities(ms, cities, 30)
    expect(s.map((x: any) => [x.m.id, x.city])).toEqual([["a", 0], ["b", 1]])
  })
})

describe("TripCore planning", () => {
  it("transitHint() by distance", () => {
    expect(T.transitHint(100).mode).toBe("高铁或大巴")
    expect(T.transitHint(700)).toEqual({ mode: "高铁", h: 3.8 })
    expect(T.transitHint(2000).mode).toBe("飞机")
  })

  it("splitDays(): per-city days, at most perDay each, overflow flagged", () => {
    const groups = [{ days: 1, stops: ["a", "b", "c", "d"] }, { days: 2, stops: ["e"] }]
    const plan = T.splitDays(groups, 3)
    expect(plan).toEqual([
      { day: 1, group: 0, stops: ["a", "b", "c", "d"], over: true },
      { day: 2, group: 1, stops: ["e"], over: false },
      { day: 3, group: 1, stops: [], over: false },
    ])
  })

  it("splitDays(): groups without days chunk by perDay (drive)", () => {
    const plan = T.splitDays([{ stops: ["a", "b", "c", "d"] }], 3)
    expect(plan.map((d: any) => d.stops)).toEqual([["a", "b", "c"], ["d"]])
  })

  it("longestRun(): the longest run of consecutive eras that includes one of `must`", () => {
    expect(T.longestRun([3, 4, 5, 7, 8], [4])).toEqual([3, 5])
    expect(T.longestRun([3, 4, 5, 7, 8], [8])).toEqual([7, 8])
    expect(T.longestRun([1, 9], [5])).toBeNull()
  })

  it("score(): must-see, fills, connects, on-site, near", () => {
    expect(T.score({ must: true, fills: 0, connects: false, onSite: false, km: 0 })).toBeCloseTo(3, 5)
    expect(T.score({ must: false, fills: 2, connects: true, onSite: true, km: 50 })).toBeCloseTo(2 * 2 + 2 + 1 - 0.5, 5)
  })

  it("migrate(): old {ids} becomes v2 transit with cities from museums", () => {
    const byId: any = {
      gugong: { id: "gugong", city: "北京", lat: 39.916, lng: 116.397 },
      guobo: { id: "guobo", city: "北京", lat: 39.905, lng: 116.401 },
      shaanxi: { id: "shaanxi", city: "西安", lat: 34.22, lng: 108.95 },
    }
    const t = T.migrate({ ids: ["gugong", "guobo", "shaanxi", "gone"], order: "route" }, byId)
    expect(t.v).toBe(2)
    expect(t.mode).toBe("transit")
    expect(t.picks).toEqual(["gugong", "guobo", "shaanxi"])
    expect(t.cities.map((c: any) => c.name)).toEqual(["北京", "西安"])
    expect(t.cities[0].lat).toBeCloseTo(39.9105, 3)
    expect(t.radius).toBe(30)
  })

  it("migrate(): keeps a valid v2 trip and drops unknown picks", () => {
    const t = T.migrate({ v: 2, mode: "drive", cities: [{ name: "北京", lat: 1, lng: 2, days: 1 }], radius: 80, picks: ["x"] }, {})
    expect(t).toEqual({ v: 2, mode: "drive", cities: [{ name: "北京", lat: 1, lng: 2, days: 1 }], radius: 80, picks: [], route: null })
  })

  it("migrate(): survives garbage input", () => {
    const t = T.migrate({ v: 2, mode: "x", cities: "x", picks: {}, radius: "80" }, {})
    expect(t).toEqual({ v: 2, mode: "transit", cities: [], radius: 30, picks: [], route: null })
    const u = T.migrate({ v: 2, cities: [{ name: "A", lat: "x", lng: 1 }, { name: "B", lat: 1, lng: 2, days: 1e9 }, { name: "C", lat: 1, lng: 2, days: -5 }], picks: ["__proto__", "ok"], radius: -1 }, { ok: { id: "ok" } })
    expect(u.cities).toEqual([{ name: "B", lat: 1, lng: 2, days: 9 }, { name: "C", lat: 1, lng: 2, days: 1 }])
    expect(u.picks).toEqual(["ok"])
    expect(u.radius).toBe(30)
    expect(T.migrate({ ids: "x" }, {}).cities).toEqual([])
  })

  it("transitHint() short hop adds half an hour", () => {
    expect(T.transitHint(100).h).toBe(1.5)
  })
})
