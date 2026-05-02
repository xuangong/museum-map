import { describe, it, expect } from "bun:test"
import { searchWikidataEntity, fetchWikidataImage } from "~/services/wikimedia"

function makeFetcher(routes: Record<string, any>): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url
    for (const key of Object.keys(routes)) {
      if (url.indexOf(key) >= 0) {
        return new Response(JSON.stringify(routes[key]), { status: 200 })
      }
    }
    return new Response("not found: " + url, { status: 404 })
  }) as unknown as typeof fetch
}

describe("searchWikidataEntity", () => {
  it("returns first hit with qid/label/description", async () => {
    const fetcher = makeFetcher({
      "wbsearchentities": {
        search: [
          { id: "Q123", label: "玉璧", description: "古玉器" },
          { id: "Q124", label: "玉璧博物馆", description: "博物馆" },
        ],
      },
    })
    const hit = await searchWikidataEntity({ query: "玉璧", fetcher })
    expect(hit?.qid).toBe("Q123")
    expect(hit?.label).toBe("玉璧")
    expect(hit?.description).toBe("古玉器")
  })

  it("returns null on empty results", async () => {
    const fetcher = makeFetcher({ wbsearchentities: { search: [] } })
    const hit = await searchWikidataEntity({ query: "nope", fetcher })
    expect(hit).toBeNull()
  })
})

describe("fetchWikidataImage", () => {
  it("resolves P18 → Commons imageinfo with license + author", async () => {
    const fetcher = makeFetcher({
      "Special:EntityData/Q123.json": {
        entities: {
          Q123: {
            claims: {
              P18: [{ mainsnak: { datavalue: { value: "Sample.jpg" } } }],
            },
          },
        },
      },
      "commons.wikimedia.org/w/api.php": {
        query: {
          pages: {
            "1": {
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/wikipedia/commons/x/y/Sample.jpg",
                  extmetadata: {
                    LicenseShortName: { value: "CC BY-SA 4.0" },
                    Artist: { value: '<a href="x">Daderot</a>' },
                  },
                },
              ],
            },
          },
        },
      },
    })
    const img = await fetchWikidataImage({ qid: "Q123", fetcher })
    expect(img?.url).toBe("https://upload.wikimedia.org/wikipedia/commons/x/y/Sample.jpg")
    expect(img?.license).toBe("CC-BY-SA-4.0")
    expect(img?.attribution).toBe("Daderot")
  })

  it("returns null when entity has no P18 claim", async () => {
    const fetcher = makeFetcher({
      "Special:EntityData/Q999.json": { entities: { Q999: { claims: {} } } },
    })
    const img = await fetchWikidataImage({ qid: "Q999", fetcher })
    expect(img).toBeNull()
  })

  it("normalizes Public Domain → PD", async () => {
    const fetcher = makeFetcher({
      "Special:EntityData/Q200.json": {
        entities: {
          Q200: { claims: { P18: [{ mainsnak: { datavalue: { value: "Pd.jpg" } } }] } },
        },
      },
      "commons.wikimedia.org/w/api.php": {
        query: {
          pages: {
            "1": {
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/wikipedia/commons/a/b/Pd.jpg",
                  extmetadata: {
                    LicenseShortName: { value: "Public domain" },
                    Credit: { value: "unknown" },
                  },
                },
              ],
            },
          },
        },
      },
    })
    const img = await fetchWikidataImage({ qid: "Q200", fetcher })
    expect(img?.license).toBe("PD")
    expect(img?.attribution).toBe("unknown")
  })
})
