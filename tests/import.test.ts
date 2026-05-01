import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { runImportAgent } from "~/services/import"
import { validateMuseumPayload, mergeFragment } from "~/services/import-schema"
import { runExtractor } from "~/services/extractor"
import { MuseumsPendingRepo } from "~/repo/museums-pending"

async function freshDb(): Promise<D1Database> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: ":memory:" },
  })
  const db = await mf.getD1Database("DB")
  await db
    .prepare(
      "CREATE TABLE museums_pending (id TEXT PRIMARY KEY, query TEXT NOT NULL, payload TEXT NOT NULL, provenance TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, reviewed_at INTEGER, notes TEXT)",
    )
    .run()
  return db as unknown as D1Database
}

describe("validateMuseumPayload", () => {
  it("rejects missing name", () => {
    const r = validateMuseumPayload({ lat: 30, lng: 120 })
    expect(r.ok).toBe(false)
  })
  it("rejects out-of-range lat", () => {
    const r = validateMuseumPayload({ name: "x", lat: 200, lng: 120 })
    expect(r.ok).toBe(false)
  })
  it("accepts minimal valid payload", () => {
    const r = validateMuseumPayload({ name: "X", lat: 30, lng: 120 })
    expect(r.ok).toBe(true)
  })
})

describe("mergeFragment", () => {
  it("scalars: later non-empty wins, empty ignored", () => {
    const m = mergeFragment({ name: "A", location: "X" }, { location: "", level: "一级" })
    expect(m.name).toBe("A")
    expect(m.location).toBe("X")
    expect(m.level).toBe("一级")
  })
  it("arrays: concat + dedupe by lower-cased key", () => {
    const m = mergeFragment(
      { treasures: ["A", "B"], artifacts: [{ name: "x" }] },
      { treasures: ["b", "C"], artifacts: [{ name: "X", period: "唐" }, { name: "Y" }] },
    )
    expect(m.treasures).toEqual(["A", "B", "C"])
    expect(m.artifacts).toHaveLength(2)
    expect(m.artifacts![0]!.name).toBe("x")
  })
})

function fakeGateway(turns: any[]): typeof fetch {
  let i = 0
  const f = async (input: any, _init?: any) => {
    const url = typeof input === "string" ? input : input.url
    if (url && url.indexOf("/v1/messages") >= 0) {
      const reply = turns[i++]
      if (!reply) throw new Error("no more turns")
      return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } })
    }
    return new Response("<html><body>some content</body></html>", { status: 200 })
  }
  return f as unknown as typeof fetch
}

describe("runImportAgent (orchestrator + extractors)", () => {
  it("dispatches extractors in parallel, merges, saves, emits events", async () => {
    const db = await freshDb()
    const turns = [
      {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: "搜索中…" },
          { type: "tool_use", id: "s1", name: "web_search", input: { query: "苏州博物馆" } },
        ],
      },
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "d1",
            name: "dispatch_extractors",
            input: { urls: ["https://www.szmuseum.com/", "https://baike.baidu.com/item/苏州博物馆"] },
          },
        ],
      },
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "v1",
            name: "save_museum",
            input: {
              name: "苏州博物馆",
              lat: 31.32,
              lng: 120.62,
              location: "江苏苏州",
              level: "一级博物馆",
              corePeriod: "明清",
              treasures: ["秘色瓷莲花碗"],
              sources: ["https://www.szmuseum.com/", "https://baike.baidu.com/item/苏州博物馆"],
            },
          },
        ],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "已完成。" }] },
    ]

    const dispatched: string[] = []
    const fakeExtractor = async (opts: any) => {
      dispatched.push(opts.url)
      if (opts.url.includes("szmuseum")) {
        return { url: opts.url, fragment: { name: "苏州博物馆", lat: 31.32, lng: 120.62, treasures: ["秘色瓷莲花碗"], sources: [opts.url] } }
      }
      return { url: opts.url, fragment: { location: "江苏苏州", level: "一级博物馆", sources: [opts.url] } }
    }

    const events: any[] = []
    const r = await runImportAgent({
      db,
      query: "苏州博物馆",
      gatewayUrl: "https://gw.example",
      gatewayKey: "k",
      onEvent: (e) => { events.push(e) },
      fetcher: fakeGateway(turns),
      now: () => 1_700_000_000_000,
      idGen: () => "test-id-1",
      runExtractor: fakeExtractor as any,
    })

    expect(r.savedId).toBe("test-id-1")
    expect(dispatched).toEqual(["https://www.szmuseum.com/", "https://baike.baidu.com/item/苏州博物馆"])
    expect(events.some((e) => e.type === "tool" && /📚 抽取 2/.test(e.message))).toBe(true)
    expect(events.filter((e) => e.type === "tool_result" && /^✅/.test(e.message))).toHaveLength(2)
    expect(events.some((e) => e.type === "saved")).toBe(true)
    expect(events.some((e) => e.type === "done")).toBe(true)

    const repo = new MuseumsPendingRepo(db)
    const row = await repo.get("test-id-1")
    expect(row).not.toBeNull()
    const payload = JSON.parse(row!.payload)
    expect(payload.name).toBe("苏州博物馆")
    expect(payload.sources).toContain("https://www.szmuseum.com/")
  })

  it("dedupes/limits >4 URLs and keeps only valid https", async () => {
    const db = await freshDb()
    const turns = [
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "d1",
            name: "dispatch_extractors",
            input: {
              urls: [
                "https://a.example/",
                "https://b.example/",
                "https://a.example/", // dup
                "ftp://nope/",
                "https://c.example/",
                "https://d.example/",
                "https://e.example/", // 5th valid → trimmed
              ],
            },
          },
        ],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "完。" }] },
    ]
    const dispatched: string[] = []
    const fakeExtractor = async (opts: any) => {
      dispatched.push(opts.url)
      return { url: opts.url, fragment: { sources: [opts.url] } }
    }
    const events: any[] = []
    await runImportAgent({
      db,
      query: "x",
      gatewayUrl: "https://gw.example",
      gatewayKey: "k",
      onEvent: (e) => { events.push(e) },
      fetcher: fakeGateway(turns),
      runExtractor: fakeExtractor as any,
    })
    expect(dispatched).toEqual(["https://a.example/", "https://b.example/", "https://c.example/", "https://d.example/"])
  })

  it("save_museum invalid payload → error event, no row inserted", async () => {
    const db = await freshDb()
    const turns = [
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "v1", name: "save_museum", input: { name: "X" } }],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "放弃。" }] },
    ]
    const events: any[] = []
    const r = await runImportAgent({
      db,
      query: "X",
      gatewayUrl: "https://gw.example",
      gatewayKey: "k",
      onEvent: (e) => { events.push(e) },
      fetcher: fakeGateway(turns),
      now: () => 1,
      idGen: () => "id-x",
    })
    expect(r.savedId).toBeNull()
    const repo = new MuseumsPendingRepo(db)
    expect(await repo.get("id-x")).toBeNull()
    expect(events.some((e) => e.type === "tool_result" && /校验失败/.test(e.message))).toBe(true)
  })

  it("stops on gateway 4xx with error event", async () => {
    const db = await freshDb()
    const fetcher = (async () =>
      new Response(JSON.stringify({ error: "bad" }), { status: 400 })) as unknown as typeof fetch
    const events: any[] = []
    await runImportAgent({
      db,
      query: "X",
      gatewayUrl: "https://gw.example",
      gatewayKey: "k",
      onEvent: (e) => { events.push(e) },
      fetcher,
    })
    expect(events.some((e) => e.type === "error")).toBe(true)
  })
})

describe("runExtractor", () => {
  it("calls web_fetch then submit_fragment, returns fragment with source URL", async () => {
    const turns = [
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "f1", name: "web_fetch", input: { url: "https://x.example/" } }],
      },
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "s1",
            name: "submit_fragment",
            input: { name: "X 馆", treasures: ["甲"] },
          },
        ],
      },
    ]
    const r = await runExtractor({
      url: "https://x.example/",
      query: "X 馆",
      gatewayUrl: "https://gw.example",
      gatewayKey: "k",
      fetcher: fakeGateway(turns),
    })
    expect(r.error).toBeUndefined()
    expect(r.fragment.name).toBe("X 馆")
    expect(r.fragment.sources).toContain("https://x.example/")
  })

  it("returns error fragment when no submit_fragment ever called", async () => {
    const turns = [
      { stop_reason: "end_turn", content: [{ type: "text", text: "放弃。" }] },
    ]
    const r = await runExtractor({
      url: "https://x.example/",
      query: "X",
      gatewayUrl: "https://gw.example",
      gatewayKey: "k",
      fetcher: fakeGateway(turns),
    })
    expect(r.error).toBeDefined()
    expect(r.fragment.sources).toEqual(["https://x.example/"])
  })
})
