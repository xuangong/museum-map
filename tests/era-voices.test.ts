import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { parse } from "yaml"
import { ERA_VOICES } from "~/data/era-voices"

// Each era's instrument in 奏一曲 must point at an object a museum really holds.
describe("era voices", () => {
  const dynasties = readdirSync("data/dynasties").map((f) => f.replace(/\.yaml$/, ""))
  test("every dynasty has a voice", () => {
    expect(dynasties.filter((d) => !ERA_VOICES[d])).toEqual([])
  })
  test("every source is a recorded artifact or treasure of that museum", () => {
    const bad: string[] = []
    for (const [d, v] of Object.entries(ERA_VOICES)) {
      if (!v.src) continue
      const path = `data/museums/${v.src.museumId}.yaml`
      let m: any
      try { m = parse(readFileSync(path, "utf8")) } catch { bad.push(`${d}: no museum ${v.src.museumId}`); continue }
      const names = [...(m.artifacts ?? []), ...(m.treasures ?? [])].map((a: any) => a.name)
      if (!names.includes(v.src.artifact)) bad.push(`${d}: ${m.name} has no 「${v.src.artifact}」`)
    }
    expect(bad).toEqual([])
  })
})
