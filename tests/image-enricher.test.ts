import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { runImageEnricher } from "~/services/image-enricher"
import { MuseumsRepo } from "~/repo/museums"
import { FieldProvenanceRepo } from "~/repo/field-provenance"

async function freshDb(): Promise<D1Database> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: ":memory:" },
  })
  const db = await mf.getD1Database("DB")
  await db.batch([
    db.prepare(
      "CREATE TABLE museums (id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, location TEXT, level TEXT, core_period TEXT, specialty TEXT, dynasty_coverage TEXT, timeline TEXT)",
    ),
    db.prepare(
      "CREATE TABLE museum_treasures (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_halls (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_artifacts (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, name TEXT NOT NULL, period TEXT, description TEXT, image_url TEXT, image_license TEXT, image_attribution TEXT, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_dynasty_connections (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, dynasty TEXT NOT NULL, description TEXT, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_sources (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, source TEXT NOT NULL, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE field_provenance (museum_id TEXT NOT NULL, field_path TEXT NOT NULL, source_url TEXT, authority TEXT, recorded_at INTEGER NOT NULL, PRIMARY KEY (museum_id, field_path), FOREIGN KEY (museum_id) REFERENCES museums(id) ON DELETE CASCADE)",
    ),
  ])
  return db as unknown as D1Database
}

/** Fake gateway: returns scripted assistant responses, ignoring actual model. */
function fakeGateway(turns: any[][]): typeof fetch {
  let i = 0
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url
    if (url.indexOf("/v1/messages") < 0) {
      return new Response("not found", { status: 404 })
    }
    const content = turns[i++] ?? []
    const stop = content.some((b: any) => b.type === "tool_use") ? "tool_use" : "end_turn"
    return new Response(JSON.stringify({ content, stop_reason: stop }), { status: 200 })
  }) as unknown as typeof fetch
}

describe("runImageEnricher", () => {
  it("merges matched images into artifacts + writes field_provenance rows", async () => {
    const db = await freshDb()
    // Seed museum with 2 artifacts.
    const museums = new MuseumsRepo(db)
    await museums.upsert("m1", {
      name: "测试馆",
      lat: 30,
      lng: 120,
      artifacts: [{ name: "玉璧" }, { name: "无名氏" }],
    })

    const gatewayTurns: any[][] = [
      [
        {
          type: "tool_use",
          id: "u1",
          name: "wikidata_search",
          input: { query: "玉璧" },
        },
      ],
      [
        {
          type: "tool_use",
          id: "u2",
          name: "wikidata_image",
          input: { qid: "Q123" },
        },
      ],
      [
        {
          type: "tool_use",
          id: "u3",
          name: "submit_results",
          input: {
            matches: {
              "玉璧": {
                qid: "Q123",
                url: "https://upload.wikimedia.org/wikipedia/commons/x/y/jade.jpg",
                license: "CC-BY-SA-4.0",
                attribution: "Daderot",
              },
            },
          },
        },
      ],
    ]
    const gatewayFetcher = fakeGateway(gatewayTurns)

    // Wikimedia fetcher (used by tools internally).
    const wmFetcher = (async (input: any) => {
      const u = typeof input === "string" ? input : input.url
      if (u.indexOf("wbsearchentities") >= 0) {
        return new Response(
          JSON.stringify({ search: [{ id: "Q123", label: "玉璧", description: "古玉" }] }),
          { status: 200 },
        )
      }
      if (u.indexOf("Special:EntityData/Q123.json") >= 0) {
        return new Response(
          JSON.stringify({
            entities: { Q123: { claims: { P18: [{ mainsnak: { datavalue: { value: "jade.jpg" } } }] } } },
          }),
          { status: 200 },
        )
      }
      if (u.indexOf("commons.wikimedia.org/w/api.php") >= 0) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "1": {
                  imageinfo: [
                    {
                      url: "https://upload.wikimedia.org/wikipedia/commons/x/y/jade.jpg",
                      extmetadata: {
                        LicenseShortName: { value: "CC BY-SA 4.0" },
                        Artist: { value: "Daderot" },
                      },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        )
      }
      return new Response("not found", { status: 404 })
    }) as unknown as typeof fetch

    const events: any[] = []
    const result = await runImageEnricher({
      db,
      museumId: "m1",
      gatewayUrl: "http://gw",
      gatewayKey: "k",
      gatewayFetcher,
      wmFetcher,
      onEvent: (e) => { events.push(e) },
    })

    expect(result.matched).toBe(1)
    expect(result.total).toBe(2)

    const updated = await museums.get("m1")
    const yu = updated!.artifacts.find((a) => a.name === "玉璧")!
    expect(yu.image).toBe("https://upload.wikimedia.org/wikipedia/commons/x/y/jade.jpg")
    expect(yu.imageLicense).toBe("CC-BY-SA-4.0")
    expect(yu.imageAttribution).toBe("Daderot")
    const wm = updated!.artifacts.find((a) => a.name === "无名氏")!
    expect(wm.image).toBeNull()

    const prov = await new FieldProvenanceRepo(db).listFor("m1")
    const imageRows = prov.filter((r) => r.field_path.endsWith(".image"))
    expect(imageRows).toHaveLength(1)
    expect(imageRows[0]!.field_path).toBe("artifacts[0].image")
    expect(imageRows[0]!.source_url).toBe("https://www.wikidata.org/wiki/Q123")
    expect(imageRows[0]!.authority).toBe("encyclopedia")
  })

  it("returns matched=0 and writes nothing when agent submits empty match map", async () => {
    const db = await freshDb()
    const museums = new MuseumsRepo(db)
    await museums.upsert("m2", { name: "X", lat: 0, lng: 0, artifacts: [{ name: "甲" }] })

    const gatewayFetcher = fakeGateway([
      [
        {
          type: "tool_use",
          id: "u1",
          name: "submit_results",
          input: { matches: {} },
        },
      ],
    ])
    const wmFetcher = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch

    const result = await runImageEnricher({
      db,
      museumId: "m2",
      gatewayUrl: "http://gw",
      gatewayKey: "k",
      gatewayFetcher,
      wmFetcher,
      onEvent: () => {},
    })
    expect(result.matched).toBe(0)
    expect(result.total).toBe(1)
    const updated = await museums.get("m2")
    expect(updated!.artifacts[0]!.image).toBeNull()
    const prov = await new FieldProvenanceRepo(db).listFor("m2")
    expect(prov.find((r) => r.field_path.endsWith(".image"))).toBeUndefined()
  })

  it("recovers matches via server-side candidate tracking when agent submits empty {} despite tool hits", async () => {
    const db = await freshDb()
    const museums = new MuseumsRepo(db)
    await museums.upsert("m3", {
      name: "测试馆",
      lat: 0,
      lng: 0,
      artifacts: [{ name: "玉璧" }, { name: "未找到的文物" }],
    })

    // Agent: searches for 玉璧, gets a hit, then bug: submits empty {}.
    const gatewayTurns: any[][] = [
      [{ type: "tool_use", id: "u1", name: "commons_search", input: { query: "玉璧 测试馆" } }],
      [{ type: "tool_use", id: "u2", name: "submit_results", input: { matches: {} } }],
    ]
    const gatewayFetcher = fakeGateway(gatewayTurns)

    const wmFetcher = (async (input: any) => {
      const u = typeof input === "string" ? input : input.url
      const isYubi = u.indexOf(encodeURIComponent("玉璧")) >= 0
      if (u.indexOf("list=search") >= 0) {
        if (isYubi) {
          return new Response(JSON.stringify({ query: { search: [{ title: "File:Yu_bi.jpg", ns: 6 }] } }), { status: 200 })
        }
        return new Response(JSON.stringify({ query: { search: [] } }), { status: 200 })
      }
      if (u.indexOf("wbsearchentities") >= 0) {
        return new Response(JSON.stringify({ search: [] }), { status: 200 })
      }
      if (u.indexOf("prop=imageinfo") >= 0) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                "1": {
                  title: "File:Yu_bi.jpg",
                  imageinfo: [
                    {
                      url: "https://upload.wikimedia.org/wikipedia/commons/y/Yu_bi.jpg",
                      width: 800,
                      extmetadata: { LicenseShortName: { value: "CC BY 4.0" }, Artist: { value: "X" } },
                    },
                  ],
                },
              },
            },
          }),
          { status: 200 },
        )
      }
      return new Response("not found", { status: 404 })
    }) as unknown as typeof fetch

    const result = await runImageEnricher({
      db,
      museumId: "m3",
      gatewayUrl: "http://gw",
      gatewayKey: "k",
      gatewayFetcher,
      wmFetcher,
      onEvent: () => {},
    })
    expect(result.matched).toBe(1)
    const updated = await museums.get("m3")
    const yu = updated!.artifacts.find((a) => a.name === "玉璧")!
    expect(yu.image).toBe("https://upload.wikimedia.org/wikipedia/commons/y/Yu_bi.jpg")
    expect(yu.imageLicense).toBe("CC-BY-4.0")
    const wm = updated!.artifacts.find((a) => a.name === "未找到的文物")!
    expect(wm.image).toBeNull()
  })

  it("returns error when museum does not exist", async () => {
    const db = await freshDb()
    const result = await runImageEnricher({
      db,
      museumId: "nope",
      gatewayUrl: "http://gw",
      gatewayKey: "k",
      gatewayFetcher: fakeGateway([[]]),
      wmFetcher: (async () => new Response("{}")) as unknown as typeof fetch,
      onEvent: () => {},
    })
    expect(result.matched).toBe(0)
    expect(result.error).toBeDefined()
  })
})
