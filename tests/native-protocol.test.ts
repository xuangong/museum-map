import { describe, expect, it } from "bun:test"
import { nativeProtocol } from "~/services/ai-models"
import { messagesBody } from "~/services/agent-loop"

describe("nativeProtocol", () => {
  it("Claude models speak Anthropic Messages", () => {
    expect(nativeProtocol("claude-opus-5.5")).toBe("anthropic")
    expect(nativeProtocol("claude-haiku-5.5")).toBe("anthropic")
  })
  it("GPT / Grok / DeepSeek speak OpenAI chat completions", () => {
    expect(nativeProtocol("gpt-6.1-sol")).toBe("openai")
    expect(nativeProtocol("grok-4.7")).toBe("openai")
    expect(nativeProtocol("deepseek-flash")).toBe("openai")
  })
})

describe("messagesBody", () => {
  const base = {
    gatewayUrl: "x",
    gatewayKey: "k",
    model: "claude-opus-5.5",
    maxTokens: 100,
    system: "s",
    tools: [],
    messages: [],
    executeTool: async () => ({ tool_use_id: "", content: "" }),
  }
  it("effort turns on adaptive thinking at that effort", () => {
    const b = messagesBody({ ...base, effort: "low" }, true)
    expect(b.thinking).toEqual({ type: "adaptive" })
    expect(b.output_config).toEqual({ effort: "low" })
    expect(b.stream).toBe(true)
  })
  it("no effort, no tools, no system → none of those keys", () => {
    const b = messagesBody({ ...base, system: "" }, false)
    expect("thinking" in b || "output_config" in b || "tools" in b || "system" in b).toBe(false)
  })
})
