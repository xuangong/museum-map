import { describe, it, expect } from "bun:test"
import { readdirSync } from "node:fs"
import { MUSEUM_ALIASES } from "~/data/museum-aliases"

const ids = new Set(readdirSync("data/museums").filter((f) => f.endsWith(".yaml")).map((f) => f.replace(/\.yaml$/, "")))

describe("museum aliases", () => {
  it("every key is a museum id in data/museums", () => {
    const unknown = Object.keys(MUSEUM_ALIASES).filter((id) => !ids.has(id))
    expect(unknown).toEqual([])
  })

  it("no alias points at two museums, and none is empty", () => {
    const owner = new Map<string, string>()
    const clashes: string[] = []
    for (const [id, list] of Object.entries(MUSEUM_ALIASES)) {
      for (const a of list) {
        expect(a.trim().length).toBeGreaterThanOrEqual(2)
        const prev = owner.get(a)
        if (prev && prev !== id) clashes.push(`${a}: ${prev} / ${id}`)
        owner.set(a, id)
      }
    }
    expect(clashes).toEqual([])
  })
})
