import { describe, it, expect } from "bun:test"
import { sanitizeChatRequest, ChatGuardError, MAX_MESSAGES_BYTES, MAX_SYSTEM_BYTES, MAX_MESSAGES_LEN, forwardChat } from "~/services/chat"

describe("sanitizeChatRequest", () => {
  it("forces model to claude-haiku-4.5 regardless of input", () => {
    const out = sanitizeChatRequest({ model: "claude-opus-4", messages: [{ role: "user", content: "hi" }] })
    expect(out.model).toBe("claude-haiku-4.5")
  })

  it("forces max_tokens to 2048", () => {
    const out = sanitizeChatRequest({ max_tokens: 99999, messages: [{ role: "user", content: "hi" }] })
    expect(out.max_tokens).toBe(2048)
  })

  it("defaults stream to false when not provided", () => {
    const out = sanitizeChatRequest({ messages: [{ role: "user", content: "hi" }] })
    expect(out.stream).toBe(false)
  })

  it("honors stream:true when explicitly requested", () => {
    const out = sanitizeChatRequest({ stream: true, messages: [{ role: "user", content: "hi" }] })
    expect(out.stream).toBe(true)
  })

  it("strips non-whitelisted fields (tools, metadata, top_p, etc.)", () => {
    const out = sanitizeChatRequest({
      messages: [{ role: "user", content: "hi" }],
      system: "you are helpful",
      tools: [{}],
      metadata: { user: "x" },
      top_p: 0.9,
      temperature: 0.7,
    } as any)
    expect(out).not.toHaveProperty("tools")
    expect(out).not.toHaveProperty("metadata")
    expect(out).not.toHaveProperty("top_p")
    expect(out).not.toHaveProperty("temperature")
    expect(out.system).toBe("you are helpful")
  })

  it("rejects messages JSON > 32KB with 413", () => {
    const big = "x".repeat(MAX_MESSAGES_BYTES + 100)
    expect(() => sanitizeChatRequest({ messages: [{ role: "user", content: big }] })).toThrow(ChatGuardError)
    try {
      sanitizeChatRequest({ messages: [{ role: "user", content: big }] })
    } catch (e) {
      expect((e as ChatGuardError).status).toBe(413)
    }
  })

  it("rejects system > 8KB with 413", () => {
    const big = "y".repeat(MAX_SYSTEM_BYTES + 100)
    try {
      sanitizeChatRequest({ system: big, messages: [{ role: "user", content: "hi" }] })
      expect.unreachable()
    } catch (e) {
      expect((e as ChatGuardError).status).toBe(413)
    }
  })

  it("rejects messages.length > 12 with 400", () => {
    const msgs = Array.from({ length: MAX_MESSAGES_LEN + 1 }, (_, i) => ({ role: "user", content: `m${i}` }))
    try {
      sanitizeChatRequest({ messages: msgs })
      expect.unreachable()
    } catch (e) {
      expect((e as ChatGuardError).status).toBe(400)
    }
  })
})

describe("forwardChat — error sanitization", () => {
  const SECRET = "super-secret-key-xyz"
  const URL = "https://upstream.example/v1/messages"

  function fakeFetch(status: number, body: any) {
    return async (_input: any) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
  }

  it("returns upstream JSON on 200", async () => {
    const reply = { content: [{ type: "text", text: "hello" }] }
    const out = await forwardChat({ messages: [{ role: "user", content: "hi" }] }, {
      gatewayUrl: URL,
      gatewayKey: SECRET,
      fetcher: fakeFetch(200, reply) as any,
    })
    expect(out.status).toBe(200)
    const json = await out.json()
    expect(json).toEqual(reply)
  })

  it("on upstream 401: returns {error:'upstream_error'} only — no key, no upstream URL", async () => {
    const out = await forwardChat({ messages: [{ role: "user", content: "hi" }] }, {
      gatewayUrl: URL,
      gatewayKey: SECRET,
      fetcher: fakeFetch(401, { error: { message: `bad key: ${SECRET}` } }) as any,
    })
    expect(out.status).toBe(502)
    const body = (await out.json()) as any
    expect(body).toEqual({ error: "upstream_error" })
    const text = JSON.stringify(body)
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain("upstream.example")
  })

  it("on upstream 500: returns {error:'upstream_error'} only", async () => {
    const out = await forwardChat({ messages: [{ role: "user", content: "hi" }] }, {
      gatewayUrl: URL,
      gatewayKey: SECRET,
      fetcher: fakeFetch(500, { detail: "internal stack trace with " + URL }) as any,
    })
    expect(out.status).toBe(502)
    const json = await out.json()
    expect(json).toEqual({ error: "upstream_error" })
  })
})
