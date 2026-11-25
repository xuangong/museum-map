import { describe, it, expect } from "bun:test"
import { assetsRoute, PLACE_NAMES_SRC } from "~/routes/assets"
import { PLACE_LINEAGES } from "~/data/place-names"

describe("/assets/place-names.json", () => {
  it("serves the lineages, immutable-cached, under a content-hashed URL", async () => {
    expect(PLACE_NAMES_SRC).toMatch(/^\/assets\/place-names\.json\?v=[0-9a-z]+$/)
    const res = await assetsRoute.handle(new Request("http://localhost/assets/place-names.json"))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("immutable")
    const body = (await res.json()) as unknown[]
    expect(body.length).toBe(PLACE_LINEAGES.length)
  })
})
