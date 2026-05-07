import { describe, it, expect } from "bun:test"
import { compareAndChoose } from "~/services/image-comparator"

const fakeGatewayFetcher = (toolInput: unknown): typeof fetch => {
  return (async () => {
    return new Response(
      JSON.stringify({
        id: "msg_test",
        type: "message",
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "tu_1",
            name: "submit_choice",
            input: toolInput,
          },
        ],
        stop_reason: "tool_use",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )
  }) as unknown as typeof fetch
}

const sampleCands = [
  {
    url: "https://example.com/a.jpg",
    source: "wikimedia",
    license: "CC-BY-SA-4.0",
    attribution: "Photo: Daderot · CC-BY-SA-4.0",
    pageUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
  },
  {
    url: "https://example.com/b.jpg",
    source: "baidu-baike",
    license: "fair-use",
    attribution: "来源：百度百科 · https://baike.baidu.com/item/x",
    pageUrl: "https://baike.baidu.com/item/x",
  },
]

describe("compareAndChoose", () => {
  it("returns the chosen candidate index when agent submits sourceIdx", async () => {
    const r = await compareAndChoose({
      artifact: { name: "玉璧", period: "战国" },
      candidates: sampleCands,
      gatewayUrl: "https://gw.example",
      gatewayKey: "test-key",
      gatewayFetcher: fakeGatewayFetcher({ sourceIdx: 1, reason: "best match" }),
    })
    expect(r.chosen).toBe(1)
    expect(r.reason).toBe("best match")
  })

  it("returns chosen=null when agent submits 'none'", async () => {
    const r = await compareAndChoose({
      artifact: { name: "玉璧" },
      candidates: sampleCands,
      gatewayUrl: "https://gw.example",
      gatewayKey: "test-key",
      gatewayFetcher: fakeGatewayFetcher({ sourceIdx: "none", reason: "neither matches" }),
    })
    expect(r.chosen).toBeNull()
    expect(r.reason).toBe("neither matches")
  })

  it("auto-picks index 0 if only one candidate (no LLM call)", async () => {
    let called = false
    const trippedFetcher: typeof fetch = (async () => {
      called = true
      return new Response("{}", { status: 200 })
    }) as unknown as typeof fetch
    const r = await compareAndChoose({
      artifact: { name: "玉璧" },
      candidates: [sampleCands[0]!],
      gatewayUrl: "https://gw.example",
      gatewayKey: "test-key",
      gatewayFetcher: trippedFetcher,
    })
    expect(r.chosen).toBe(0)
    expect(called).toBe(false)
  })

  it("returns chosen=null with empty candidates", async () => {
    const r = await compareAndChoose({
      artifact: { name: "玉璧" },
      candidates: [],
      gatewayUrl: "https://gw.example",
      gatewayKey: "test-key",
      gatewayFetcher: fakeGatewayFetcher({}),
    })
    expect(r.chosen).toBeNull()
  })
})
