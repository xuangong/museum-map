import { describe, expect, it } from "bun:test"
import { AI_MODELS, resolveAi } from "~/services/ai-models"

describe("resolveAi", () => {
  it("defaults to gpt-6.1-sol / medium", () => {
    expect(resolveAi(undefined, undefined)).toEqual({ model: "gpt-6.1-sol", effort: "medium" })
  })
  it("unknown model falls back to the default model", () => {
    expect(resolveAi("nope", "low")).toEqual({ model: "gpt-6.1-sol", effort: "low" })
  })
  it("keeps a valid pair", () => {
    expect(resolveAi("claude-opus-5.5", "xhigh")).toEqual({ model: "claude-opus-5.5", effort: "xhigh" })
  })
  it("unsupported effort -> medium when allowed", () => {
    expect(resolveAi("claude-haiku-5.5", "ultra").effort).toBe("medium")
    expect(resolveAi("grok-4.7", 5).effort).toBe("medium")
  })
  it("unsupported effort -> first effort when medium is not allowed", () => {
    expect(resolveAi("deepseek-flash", "ultra")).toEqual({ model: "deepseek-flash", effort: "low" })
  })
  it("catalog covers the four families", () => {
    expect(new Set(AI_MODELS.map((m) => m.family))).toEqual(new Set(["Claude", "GPT", "Grok", "DeepSeek"]))
  })
})
