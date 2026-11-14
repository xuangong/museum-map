import { describe, expect, it } from "bun:test"
import { runLlmLoop, runLlmLoopStream, toOpenAiTools } from "~/services/llm"

const json = (o: any, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } })

function sse(chunks: any[]): Response {
  const body = chunks.map((c) => "data: " + JSON.stringify(c) + "\n\n").join("") + "data: [DONE]\n\n"
  const bytes = new TextEncoder().encode(body)
  const cut = Math.floor(bytes.length / 2)
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, cut))
        c.enqueue(bytes.slice(cut))
        c.close()
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  )
}

const TOOLS = [{ name: "search_museums", description: "d", input_schema: { type: "object", properties: { location: { type: "string" } } } }]
const base = (fetcher: any, extra: any = {}) => ({
  gatewayUrl: "https://gw.example/",
  gatewayKey: "KEY",
  model: "gpt-6.1-sol",
  effort: "medium",
  maxTokens: 100,
  system: "SYS",
  tools: TOOLS,
  messages: [{ role: "user", content: "洛阳" }] as any[],
  executeTool: async (c: any) => ({ tool_use_id: c.id, content: JSON.stringify({ got: c.input }) }),
  fetcher,
  ...extra,
})

describe("llm tool loop (OpenAI format)", () => {
  it("converts tools to function tools", () => {
    expect(toOpenAiTools(TOOLS)[0]).toEqual({ type: "function", function: { name: "search_museums", description: "d", parameters: TOOLS[0]!.input_schema } })
  })

  it("tool call, then final text", async () => {
    const reqs: any[] = []
    const replies = [
      json({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "search_museums", arguments: '{"location":"洛阳"}' } }] } }] }),
      json({ choices: [{ finish_reason: "stop", message: { content: "龙门石窟。" } }] }),
    ]
    const f = async (url: any, init: any) => {
      reqs.push({ url, init, body: JSON.parse(init.body) })
      return replies.shift()!
    }
    const r = await runLlmLoop(base(f))
    expect(r.stopReason).toBe("end_turn")
    expect(r.text).toBe("龙门石窟。")
    expect(reqs[0].url).toBe("https://gw.example/v1/chat/completions")
    expect(reqs[0].init.headers.authorization).toBe("Bearer KEY")
    expect(reqs[0].init.headers["user-agent"]).toBeTruthy()
    expect(reqs[0].body.messages[0]).toEqual({ role: "system", content: "SYS" })
    expect(reqs[0].body.reasoning_effort).toBe("medium")
    expect(reqs[0].body.max_completion_tokens).toBe(100)
    const second = reqs[1].body.messages
    expect(second[2].tool_calls[0].function.name).toBe("search_museums")
    expect(second[3]).toEqual({ role: "tool", tool_call_id: "c1", content: '{"got":{"location":"洛阳"}}' })
  })

  it("streams deltas and accumulates tool_calls by index", async () => {
    const turns = [
      sse([
        { choices: [{ delta: { content: "我查" } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "t1", function: { name: "search_museums", arguments: '{"loca' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'tion":"洛阳"}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]),
      sse([{ choices: [{ delta: { content: "洛阳有" } }] }, { choices: [{ delta: { content: "龙门。" } }] }, { choices: [{ delta: {}, finish_reason: "stop" }] }]),
    ]
    const bodies: any[] = []
    const deltas: string[] = []
    const tools: string[] = []
    const f = async (_u: any, init: any) => {
      bodies.push(JSON.parse(init.body))
      return turns.shift()!
    }
    const r = await runLlmLoopStream(base(f, { onDelta: (t: string) => void deltas.push(t), onTool: (c: any) => void tools.push(c.name + JSON.stringify(c.input)) }))
    expect(r.stopReason).toBe("end_turn")
    expect(deltas.join("")).toBe("我查\n\n洛阳有龙门。")
    expect(r.text).toBe("我查\n\n洛阳有龙门。")
    expect(tools).toEqual(['search_museums{"location":"洛阳"}'])
    expect(bodies[0].stream).toBe(true)
    expect(bodies[1].messages.at(-1).tool_call_id).toBe("t1")
  })

  it("retries once on 502, then succeeds", async () => {
    let n = 0
    const f = async () => (++n === 1 ? json({ error: { message: "The operation was aborted" } }, 502) : json({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }))
    const r = await runLlmLoop(base(f))
    expect(n).toBe(2)
    expect(r.text).toBe("ok")
  })

  it("a second 502 is a gateway_error", async () => {
    let n = 0
    const f = async () => (++n, json({ error: { message: "aborted" } }, 502))
    const r = await runLlmLoopStream(base(f, { onDelta: () => {} }))
    expect(n).toBe(2)
    expect(r.stopReason).toBe("gateway_error")
    expect(r.lastError).toContain("502")
  })

  it("does not retry a 4xx", async () => {
    let n = 0
    const f = async () => (++n, json({ error: "bad" }, 400))
    const r = await runLlmLoop(base(f))
    expect(n).toBe(1)
    expect(r.stopReason).toBe("gateway_error")
  })
})
