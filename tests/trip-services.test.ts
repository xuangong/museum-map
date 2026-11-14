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
