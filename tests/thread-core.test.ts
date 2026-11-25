import { describe, it, expect } from "bun:test"
import { THREAD_CORE_SCRIPT } from "~/ui/client/thread-core"

const w: any = {}
new Function("window", THREAD_CORE_SCRIPT)(w)
const T = w.ThreadCore

const S = (name: string, modern: string, lat: number, lng: number, trip = true) => ({ name, modern, lat, lng, year: 0, when: "", title: "", story: "", trip, source: "" })
const th = (id: string, era: string, stops: any[]) => ({ id, kind: "person", title: id, who: id, era, span: "", intro: "", stops })

describe("ThreadCore.cityOf", () => {
  it("strips the province", () => {
    expect(T.cityOf("湖北黄冈")).toBe("黄冈")
    expect(T.cityOf("陕西西安")).toBe("西安")
    expect(T.cityOf("新疆吐鲁番")).toBe("吐鲁番")
    expect(T.cityOf("内蒙古呼和浩特")).toBe("呼和浩特")
    expect(T.cityOf("重庆奉节")).toBe("奉节")
    expect(T.cityOf("北京")).toBe("北京")
  })
})

describe("ThreadCore.toTrip", () => {
  const t = th("x", "tang", [
    S("长安", "陕西西安", 34.26, 108.94), S("咸阳", "陕西咸阳", 34.33, 108.71),
    S("凉州", "甘肃武威", 37.93, 102.64), S("那烂陀", "印度比哈尔", 25.14, 85.44, false), S("长安", "陕西西安", 34.26, 108.94),
  ])
  it("keeps trip stops in order, merges consecutive stops < 30 km, skips abroad", () => {
    const r = T.toTrip(t)
    expect(r.cities.map((c: any) => c.name)).toEqual(["西安", "武威", "西安"])
    expect(r.cities[0]).toEqual({ name: "西安", lat: 34.26, lng: 108.94, days: 1 })
    expect(r.skipped).toBe(1)
  })
})

describe("ThreadCore.near / byEra / notes", () => {
  const a = th("a", "song", [S("黄州", "湖北黄冈", 30.45, 114.88), S("惠州", "广东惠州", 23.11, 114.42), S("儋州", "海南儋州", 19.52, 109.58)])
  const b = th("b", "tang", [S("长安", "陕西西安", 34.26, 108.94), S("江陵", "湖北荆州", 30.35, 112.19), S("扬州", "江苏扬州", 32.39, 119.42)])
  it("near: nearest stop per thread within km, nearest first", () => {
    const r = T.near([a, b], { lat: 30.4, lng: 114.9 }, 30)
    expect(r.length).toBe(1)
    expect(r[0].thread.id).toBe("a"); expect(r[0].index).toBe(0); expect(r[0].km).toBeLessThan(10)
    expect(T.near([a, b], { lat: 0, lng: 0 }, 30)).toEqual([])
  })
  it("byEra", () => { expect(T.byEra([a, b], "tang").map((x: any) => x.id)).toEqual(["b"]) })
  it("notes: one degree per stop, arcs up and comes home, within 0..17", () => {
    const n = T.notes(a); expect(n.length).toBe(3); expect(n[0]).toBe(5); expect(n[2]).toBe(5); expect(n[1]).toBe(9)
    const one = T.notes(th("c", "tang", [S("x", "x", 1, 1)])); expect(one).toEqual([5])
    for (const d of T.notes(th("d", "tang", Array.from({ length: 12 }, () => S("x", "x", 1, 1))))) { expect(d).toBeGreaterThanOrEqual(0); expect(d).toBeLessThanOrEqual(17) }
  })
})
