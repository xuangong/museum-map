import { describe, it, expect } from "bun:test"
import { ERA_SYNTH_SCRIPT } from "~/ui/client/era-synth"
import { ERA_VOICES } from "~/data/era-voices"

describe("EraSynth", () => {
  const w: any = {}
  new Function("window", ERA_SYNTH_SCRIPT)(w)
  const S = w.EraSynth
  it("exposes the synth surface strata relies on", () => {
    for (const k of ["degFreq", "MAX_DEG", "VOICES", "makeGraph", "stringSound", "audioCtx", "unlock", "ctx", "master", "note"]) expect(S[k]).toBeDefined()
    expect(S.degFreq(0)).toBeCloseTo(98, 5)
  })
  it("maps every era to a known voice", () => {
    for (const id of Object.keys(ERA_VOICES)) expect(S.VOICES[S.voiceOf(id)]).toBeDefined()
    expect(S.voiceOf("nope")).toBe("ks")
  })
  it("note() is a silent no-op without Web Audio", () => {
    expect(() => S.note("tang", 7)).not.toThrow()
  })
})
