import { describe, it, expect } from "bun:test"
import { toMapCoord } from "~/ui/client/coords"

// Reference values produced by running legacy/index.html wgs84ToGcj02 on the inputs
const REF: Array<[string, number, number, number, number]> = [
  // [city, wgsLat, wgsLng, expectedGcjLat, expectedGcjLng]
  ["beijing", 39.9042, 116.4074, 39.90560334316507, 116.41364225378803],
  ["xian",    34.3416, 108.9398, 34.340044495655384, 108.94445563427456],
  ["hangzhou",30.2741, 120.1551, 30.271771223200254, 120.15979447929637],
]

describe("WGS-84 → GCJ-02", () => {
  for (const [city, lat, lng, eLat, eLng] of REF) {
    it(`${city} matches legacy implementation within 1e-6`, () => {
      const [outLat, outLng] = toMapCoord(lat, lng)
      expect(outLat).toBeCloseTo(eLat, 6)
      expect(outLng).toBeCloseTo(eLng, 6)
    })
  }

  it("returns input unchanged for points outside China (Tokyo)", () => {
    expect(toMapCoord(35.6812, 139.7671)).toEqual([35.6812, 139.7671])
  })

  it("outOfChina edges return original coords", () => {
    expect(toMapCoord(30.0, 72.0)).toEqual([30.0, 72.0])      // lng < 72.004
    expect(toMapCoord(30.0, 137.9)).toEqual([30.0, 137.9])    // > 137.8347
    expect(toMapCoord(0.8, 100.0)).toEqual([0.8, 100.0])      // lat < 0.8293
    expect(toMapCoord(55.9, 100.0)).toEqual([55.9, 100.0])    // > 55.8271
  })
})
