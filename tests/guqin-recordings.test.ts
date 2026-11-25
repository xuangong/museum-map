import { describe, it, expect } from "bun:test"
import { readdirSync } from "node:fs"
import { GUQIN_RECORDINGS } from "~/data/guqin-recordings"
import { STRATA_MODULE } from "~/ui/client/strata"

const eras = new Set(readdirSync("data/dynasties").map((f) => f.replace(/\.yaml$/, "")))

describe("GUQIN_RECORDINGS", () => {
  it("each sits on a real era, is self-hosted and credited", () => {
    for (const [era, r] of Object.entries(GUQIN_RECORDINGS)) {
      expect(eras.has(era)).toBe(true)
      expect(r.src).toMatch(/^\/img\/guqin-[a-z-]+-[0-9a-f]{16}\.mp3$/)
      expect(r.performer.length).toBeGreaterThan(0)
      expect(r.license).toMatch(/^CC BY(-SA)? \d\.\d$/)
      expect(r.commons).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
    }
  })
  it("an 'original' is the very piece 奏一曲 quotes for that era", () => {
    for (const [era, r] of Object.entries(GUQIN_RECORDINGS)) {
      if (r.kind !== "original") continue
      const key = /^[a-z]+$/.test(era) ? era : `'${era}'`
      expect(STRATA_MODULE).toContain(`${key}: [{ name: '${r.piece}'`)
    }
  })
  it("strata carries the recordings and the listen control", () => {
    expect(STRATA_MODULE).toContain("const RECORDINGS = ")
    expect(STRATA_MODULE).toContain("strata-listen")
  })
})
