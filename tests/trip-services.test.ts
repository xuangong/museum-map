// tests/trip-services.test.ts
import { describe, it, expect } from "bun:test"
import { searchCity, reverseCity } from "~/services/geocode"

function memKV() {
  const m = new Map<string, string>()
  return {
    async get(k: string, type?: string) { const v = m.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v },
    async put(k: string, v: string) { m.set(k, v) },
    _m: m,
  } as any
}
const env = () => ({ RATE: memKV() }) as any
const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

describe("geocode", () => {
  it("searchCity normalizes Nominatim rows and caches them", async () => {
    let calls = 0
    const f = (async (url: string) => {
      calls++
      expect(url).toContain("nominatim.openstreetmap.org/search")
      expect(url).toContain("countrycodes=cn")
      return jsonRes([
        { name: "石家庄市", lat: "38.0429742", lon: "114.5088385", addresstype: "city", address: { state: "河北省" } },
        { name: "某某路", lat: "38", lon: "114", addresstype: "road", address: {} },
      ])
    }) as any
    const e = env()
    const a = await searchCity(e, "石家庄", f)
    expect(a).toEqual([{ name: "石家庄市", lat: 38.0429742, lng: 114.5088385, province: "河北省" }])
    const b = await searchCity(e, "石家庄", f)
    expect(b).toEqual(a)
    expect(calls).toBe(1)
  })

  it("reverseCity picks the city-level name", async () => {
    const f = (async (url: string) => {
      expect(url).toContain("/reverse")
      return jsonRes({ name: "长安区", lat: "38.04", lon: "114.51", address: { city: "石家庄市", state: "河北省" } })
    }) as any
    const p = await reverseCity(env(), 38.041, 114.512, f)
    expect(p).toEqual({ name: "石家庄市", lat: 38.04, lng: 114.51, province: "河北省" })
  })

  it("searchCity throws on upstream error (caller maps to 502)", async () => {
    const f = (async () => jsonRes({}, 503)) as any
    await expect(searchCity(env(), "西安", f)).rejects.toThrow()
  })
})
import { routeThrough, kmBetween, thin } from "~/services/route"

describe("route", () => {
  const BJ = { lat: 39.909, lng: 116.397 }, LY = { lat: 34.619, lng: 112.454 }, XA = { lat: 34.341, lng: 108.94 }

  it("kmBetween is haversine km", () => {
    expect(Math.round(kmBetween(BJ, XA))).toBe(905)
  })

  it("thin keeps first and last and caps length", () => {
    const pts = Array.from({ length: 1001 }, (_, i) => [i, i] as [number, number])
    const t = thin(pts, 100)
    expect(t.length).toBeLessThanOrEqual(101)
    expect(t[0]).toEqual([0, 0])
    expect(t[t.length - 1]).toEqual([1000, 1000])
  })

  it("uses OSRM when available (lng,lat order in, lat,lng out) and caches", async () => {
    let calls = 0
    const f = (async (url: string) => {
      calls++
      expect(url).toContain("router.project-osrm.org/route/v1/driving/116.397,39.909;112.454,34.619;108.94,34.341")
      return jsonRes({
        code: "Ok",
        routes: [{
          distance: 1174000, duration: 47880,
          geometry: { coordinates: [[116.397, 39.909], [112.454, 34.619], [108.94, 34.341]] },
          legs: [{ distance: 800000, duration: 32000 }, { distance: 374000, duration: 15880 }],
        }],
      })
    }) as any
    const e = env()
    const r = await routeThrough(e, [BJ, LY, XA], f)
    expect(r.provider).toBe("osrm")
    expect(r.km).toBe(1174)
    expect(r.h).toBe(13.3)
    expect(r.legs).toEqual([{ km: 800, h: 8.9 }, { km: 374, h: 4.4 }])
    expect(r.line[0]).toEqual([39.909, 116.397])
    await routeThrough(e, [BJ, LY, XA], f)
    expect(calls).toBe(1)
  })

  it("falls back to straight lines when OSRM fails", async () => {
    const f = (async () => { throw new Error("down") }) as any
    const r = await routeThrough(env(), [BJ, XA], f)
    expect(r.provider).toBe("line")
    expect(r.h).toBeNull()
    expect(r.km).toBe(905)
    expect(r.line).toEqual([[39.909, 116.397], [34.341, 108.94]])
  })
})
