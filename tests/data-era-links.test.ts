import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { parse } from "yaml"

// Every museum must sit on at least one era: otherwise its stamp adds nothing to the
// strata (no beam, no string, no note) and it never shows in any dynasty view.
describe("data: museum ↔ era links", () => {
  test("every museum is linked to at least one dynasty", () => {
    const museums = readdirSync("data/museums").filter((f) => f.endsWith(".yaml")).map((f) => parse(readFileSync(`data/museums/${f}`, "utf8")))
    const linked = new Set<string>()
    for (const f of readdirSync("data/dynasties").filter((f) => f.endsWith(".yaml"))) {
      const d = parse(readFileSync(`data/dynasties/${f}`, "utf8"))
      for (const r of d.recommended_museums ?? []) if (r.museum_id) linked.add(r.museum_id)
    }
    const reasons = parse(readFileSync("data/dynasty-museum-reasons.yaml", "utf8")) as Record<string, { museum_id: string }[]>
    for (const rows of Object.values(reasons)) for (const r of rows) linked.add(r.museum_id)
    const orphans = museums.filter((m) => !linked.has(m.id)).map((m) => `${m.id} ${m.name}`)
    expect(orphans).toEqual([])
  })
})
