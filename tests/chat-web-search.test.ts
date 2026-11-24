import { describe, expect, it } from "bun:test"
import { runToolLoop, runToolLoopStream, sourcesMarkdown } from "~/services/agent-loop"
import { runLlmLoop } from "~/services/llm"
import { CHAT_AGENT_SYSTEM } from "~/services/chat-tools"

const json = (o: any) => new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json" } })
const base = { gatewayUrl: "https://gw.example", gatewayKey: "k", model: "m", maxTokens: 100, system: "s", tools: [] as any[] }
const search = [
  { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: { query: "故宫 开放时间" } },
  {
    type: "web_search_tool_result",
    tool_use_id: "srvtoolu_1",
    content: [{ type: "web_search_result", url: "https://www.dpm.org.cn/a", title: "故宫 [官网]", encrypted_content: "x" }],
  },
]

describe("web search, anthropic", () => {
  it("adds the native server tool next to local tools and handles pause_turn", async () => {
    const sent: any[] = []
    const turns = [
      { content: search, stop_reason: "pause_turn" },
      { content: [{ type: "text", text: "周一闭馆。", citations: [{ type: "web_search_result_location", url: "https://www.dpm.org.cn/a", title: "t" }] }], stop_reason: "end_turn" },
    ]
    const messages: any[] = [{ role: "user", content: "q" }]
    const searches: string[] = []
    const res = await runToolLoop({
      ...base,
      tools: [{ name: "get_museum", input_schema: {} }],
      webSearch: true,
      messages,
      onSearch: (q) => void searches.push(q),
      fetcher: (async (_u: any, init: any) => {
        sent.push(JSON.parse(init.body))
        return json(turns.shift())
      }) as any,
      executeTool: async () => {
        throw new Error("server tools must not run locally")
      },
    })
    expect(sent[0].tools.map((t: any) => t.name)).toEqual(["get_museum", "web_search"])
    expect(sent[0].tools[1]).toMatchObject({ type: "web_search_20250305", max_uses: 3 })
    expect(res.stopReason).toBe("end_turn")
    expect(res.iterations).toBe(2)
    expect(res.text).toBe("周一闭馆。")
    expect(searches).toEqual(["故宫 开放时间"])
    expect(res.sources).toEqual([{ url: "https://www.dpm.org.cn/a", title: "故宫 [官网]" }])
    // second request replays the assistant blocks verbatim, no user turn in between
    expect(sent[1].messages[1]).toEqual({ role: "assistant", content: search })
    expect(sent[1].messages.length).toBe(2)
  })

  it("pause_turn respects maxIters", async () => {
    const res = await runToolLoop({
      ...base,
      webSearch: true,
      messages: [{ role: "user", content: "q" }],
      maxIters: 2,
      fetcher: (async () => json({ content: search, stop_reason: "pause_turn" })) as any,
      executeTool: async (c) => ({ tool_use_id: c.id, content: "" }),
    })
    expect(res.stopReason).toBe("max_iters")
  })

  it("omits web_search when disabled", async () => {
    const sent: any[] = []
    await runToolLoop({
      ...base,
      messages: [{ role: "user", content: "q" }],
      fetcher: (async (_u: any, init: any) => {
        sent.push(JSON.parse(init.body))
        return json({ content: [{ type: "text", text: "x" }, { type: "mystery", a: 1 }], stop_reason: "end_turn" })
      }) as any,
      executeTool: async (c) => ({ tool_use_id: c.id, content: "" }),
    })
    expect(sent[0].tools).toBeUndefined()
  })

  it("streams server_tool_use / result blocks, replays them, continues on pause_turn", async () => {
    const sse = (events: any[]) =>
      new Response(events.map((e) => "data: " + JSON.stringify(e) + "\n\n").join(""), { status: 200, headers: { "content-type": "text/event-stream" } })
    const turn1 = [
      { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "s1", name: "web_search", input: {} } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"query":"故宫"}' } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: search[1] },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", delta: { stop_reason: "pause_turn" } },
    ]
    const turn2 = [
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "好的" } },
      { type: "content_block_delta", index: 0, delta: { type: "citations_delta", citation: { type: "web_search_result_location", url: "https://e.com/x", title: "E" } } },
      { type: "content_block_start", index: 1, content_block: { type: "future_block", z: 1 } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn" } },
    ]
    const turns = [turn1, turn2]
    const sent: any[] = []
    const deltas: string[] = []
    const searches: string[] = []
    const res = await runToolLoopStream({
      ...base,
      webSearch: true,
      messages: [{ role: "user", content: "q" }],
      fetcher: (async (_u: any, init: any) => {
        sent.push(JSON.parse(init.body))
        return sse(turns.shift()!)
      }) as any,
      executeTool: async () => {
        throw new Error("no local tool expected")
      },
      onSearch: (q) => void searches.push(q),
      onDelta: (t) => void deltas.push(t),
    })
    expect(res.stopReason).toBe("end_turn")
    expect(searches).toEqual(["故宫"])
    expect(deltas).toEqual(["好的"])
    expect(sent[1].messages[1].content).toEqual([
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "故宫" } },
      search[1],
    ])
    expect(res.sources?.map((s) => s.url)).toEqual(["https://www.dpm.org.cn/a", "https://e.com/x"])
  })

  it("renders sources as safe compact links", () => {
    const md = sourcesMarkdown([{ url: "https://a.com/x)y z", title: "A [b](c) *" }, { url: "https://b.com", title: "B" }])
    expect(md).toContain("来源：")
    expect(md).toContain("- [A b c](https://a.com/x%29y%20z)")
  })
})

describe("web search, openai", () => {
  it("sends web_search_options and passes the completion through", async () => {
    const sent: any[] = []
    const res = await runLlmLoop({
      ...base,
      webSearch: true,
      messages: [{ role: "user", content: "q" }],
      fetcher: (async (_u: any, init: any) => {
        sent.push(JSON.parse(init.body))
        return json({
          choices: [{ finish_reason: "stop", message: { content: "答案", annotations: [{ type: "url_citation", url_citation: { url: "https://e.com", title: "E" } }, { type: "weird" }] } }],
        })
      }) as any,
      executeTool: async (c) => ({ tool_use_id: c.id, content: "" }),
    })
    expect(sent[0].web_search_options).toEqual({})
    expect(res.text).toBe("答案")
    expect(res.stopReason).toBe("end_turn")
    expect(res.sources).toEqual([{ url: "https://e.com", title: "E" }])
  })

  it("omits web_search_options by default", async () => {
    const sent: any[] = []
    await runLlmLoop({
      ...base,
      messages: [{ role: "user", content: "q" }],
      fetcher: (async (_u: any, init: any) => {
        sent.push(JSON.parse(init.body))
        return json({ choices: [{ finish_reason: "stop", message: { content: "x" } }] })
      }) as any,
      executeTool: async (c) => ({ tool_use_id: c.id, content: "" }),
    })
    expect(sent[0].web_search_options).toBeUndefined()
  })
})

describe("CHAT_AGENT_SYSTEM", () => {
  it("tells the model it can search the web", () => {
    expect(CHAT_AGENT_SYSTEM).toContain("联网搜索")
    expect(CHAT_AGENT_SYSTEM).toContain("无法联网")
  })
})
