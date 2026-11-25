// tests/place-names.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { parse } from "yaml"
import { PLACE_LINEAGES } from "~/data/place-names"

const dyn = readdirSync("data/dynasties").map((f) => parse(readFileSync(`data/dynasties/${f}`, "utf8")))
const order: Record<string, number> = Object.fromEntries(dyn.map((d: any) => [d.id, d.order_index]))
const museums = readdirSync("data/museums").map((f) => parse(readFileSync(`data/museums/${f}`, "utf8")))

describe("PLACE_LINEAGES", () => {
  it("has ~70 cities with unique ids", () => {
    expect(PLACE_LINEAGES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(PLACE_LINEAGES.map((c) => c.id)).size).toBe(PLACE_LINEAGES.length)
  })
  it("every entry is well-formed", () => {
    for (const c of PLACE_LINEAGES) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.lat).toBeGreaterThan(15); expect(c.lat).toBeLessThan(55)
      expect(c.lng).toBeGreaterThan(70); expect(c.lng).toBeLessThan(140)
      expect(c.names.length).toBeGreaterThanOrEqual(3)
      let prev = -1
      for (const n of c.names) {
        expect(order[n.era]).toBeDefined()           // a real dynasty id
        expect(order[n.era]).toBeGreaterThan(prev)    // one name per era, oldest first
        prev = order[n.era]!
        expect(n.name.trim().length).toBeGreaterThan(0)
      }
    }
  })
  it("covers most museum cities (a lineage within 40 km of ≥ 85% of museums)", () => {
    const km = (a: any, b: any) => {
      const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
      return 12742 * Math.asin(Math.sqrt(h))
    }
    const covered = museums.filter((m: any) => PLACE_LINEAGES.some((c) => km(c, m) <= 40))
    expect(covered.length / museums.length).toBeGreaterThanOrEqual(0.85)
  })
})
