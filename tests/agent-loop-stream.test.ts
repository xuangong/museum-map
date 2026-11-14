import { describe, expect, it } from "bun:test"
import { runToolLoopStream } from "~/services/agent-loop"

/** A fake gateway that streams each turn as Anthropic SSE events. */
function sse(events: any[]): Response {
  const body = events.map((e) => "event: " + e.type + "\ndata: " + JSON.stringify(e) + "\n\n").join("")
  // Split mid-frame to exercise buffering.
  const bytes = new TextEncoder().encode(body)
  const cut = Math.floor(bytes.length / 2)
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes.slice(0, cut))
      c.enqueue(bytes.slice(cut))
      c.close()
    },
  })
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })
}

const toolTurn = [
  { type: "message_start", message: { id: "m1" } },
  { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig-abc" } },
  { type: "content_block_stop", index: 0 },
  { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "我查一下。" } },
  { type: "content_block_stop", index: 1 },
  { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "tu1", name: "search_museums", input: {} } },
  { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"loca' } },
  { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: 'tion":"洛阳"}' } },
  { type: "content_block_stop", index: 2 },
  { type: "message_delta", delta: { stop_reason: "tool_use" } },
  { type: "message_stop" },
]
const textTurn = [
  { type: "message_start", message: { id: "m2" } },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "洛阳有" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "龙门石窟。" } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: "end_turn" } },
  { type: "message_stop" },
]

describe("runToolLoopStream", () => {
  it("streams text as it arrives, runs tools from streamed JSON, and continues", async () => {
    const turns = [toolTurn, textTurn]
    const sent: any[] = []
    const deltas: string[] = []
    const tools: any[] = []
    const messages: any[] = [{ role: "user", content: "洛阳有什么？" }]
    const res = await runToolLoopStream({
      gatewayUrl: "https://gw.example/",
      gatewayKey: "k",
      model: "m",
      maxTokens: 100,
      system: "s",
      tools: [],
      messages,
      fetcher: (async (_url: any, init: any) => {
        sent.push(JSON.parse(init.body))
        return sse(turns.shift()!)
      }) as any,
      executeTool: async (call) => {
        tools.push(call)
        return { tool_use_id: call.id, content: "[龙门石窟]" }
      },
      onDelta: (t) => {
        deltas.push(t)
      },
    })
    expect(res.stopReason).toBe("end_turn")
    expect(res.iterations).toBe(2)
    expect(deltas).toEqual(["我查一下。", "\n\n", "洛阳有", "龙门石窟。"])
    expect(res.text).toBe("我查一下。\n\n洛阳有龙门石窟。")
    expect(tools).toEqual([{ type: "tool_use", id: "tu1", name: "search_museums", input: { location: "洛阳" } }])
    expect(sent[0].stream).toBe(true)
    // The second turn carries the assistant's turn back unchanged — thinking block
    // (with signature) included — plus the tool result.
    expect(sent[1].messages[1]).toEqual({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "", signature: "sig-abc" },
        { type: "text", text: "我查一下。" },
        { type: "tool_use", id: "tu1", name: "search_museums", input: { location: "洛阳" } },
      ],
    })
    expect(sent[1].messages[2].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu1", content: "[龙门石窟]" })
  })

  it("reports a gateway error without leaking upstream details to text", async () => {
    const res = await runToolLoopStream({
      gatewayUrl: "https://gw.example",
      gatewayKey: "k",
      model: "m",
      maxTokens: 100,
      system: "s",
      tools: [],
      messages: [{ role: "user", content: "hi" }],
      fetcher: (async () => new Response("nope", { status: 503 })) as any,
      executeTool: async (c) => ({ tool_use_id: c.id, content: "" }),
      onDelta: () => {},
    })
    expect(res.stopReason).toBe("gateway_error")
    expect(res.text).toBe("")
  })
})
