import { describe, it, expect } from "bun:test"
import { searchWikidataEntity, fetchWikidataImage, searchCommonsFile } from "~/services/wikimedia"

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

describe("searchCommonsFile", () => {
  it("returns first image hit with url + license + attribution", async () => {
    const fetcher = makeFetcher({
      "list=search": {
        query: {
          search: [
            { title: "File:Dingyao bowl.jpg", snippet: "Ding ware bowl", ns: 6 },
            { title: "File:Other.jpg", snippet: "x", ns: 6 },
          ],
        },
      },
      "prop=imageinfo": {
        query: {
          pages: {
            "1": {
              title: "File:Dingyao bowl.jpg",
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/wikipedia/commons/a/b/Dingyao_bowl.jpg",
                  width: 800,
                  extmetadata: {
                    LicenseShortName: { value: "CC BY-SA 3.0" },
                    Artist: { value: "Daderot" },
                    ImageDescription: { value: "Ding ware bowl" },
                  },
                },
              ],
            },
          },
        },
      },
    })
    const hit = await searchCommonsFile({ query: "定窑", fetcher })
    expect(hit?.url).toBe("https://upload.wikimedia.org/wikipedia/commons/a/b/Dingyao_bowl.jpg")
    expect(hit?.license).toBe("CC-BY-SA-3.0")
    expect(hit?.attribution).toBe("Daderot")
    expect(hit?.title).toBe("File:Dingyao bowl.jpg")
  })

  it("returns null when search returns no files", async () => {
    const fetcher = makeFetcher({ "list=search": { query: { search: [] } } })
    const hit = await searchCommonsFile({ query: "nope", fetcher })
    expect(hit).toBeNull()
  })

  it("skips replica/copy/复制品 titles and falls through", async () => {
    const fetcher = makeFetcher({
      "list=search": {
        query: {
          search: [
            { title: "File:金杖（复制品）.jpg", snippet: "x", ns: 6 },
            { title: "File:Bronze sword replica.jpg", snippet: "y", ns: 6 },
            { title: "File:Real artifact.jpg", snippet: "z", ns: 6 },
          ],
        },
      },
      "titles=File%3AReal%20artifact.jpg": {
        query: {
          pages: {
            "1": {
              title: "File:Real artifact.jpg",
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/wikipedia/commons/r/Real_artifact.jpg",
                  width: 800,
                  extmetadata: { LicenseShortName: { value: "CC BY 4.0" }, Artist: { value: "X" } },
                },
              ],
            },
          },
        },
      },
    })
    const hit = await searchCommonsFile({ query: "x", fetcher })
    expect(hit?.title).toBe("File:Real artifact.jpg")
  })

  it("skips images smaller than 200px wide and falls through to next candidate", async () => {
    const fetcher = makeFetcher({
      "list=search": {
        query: {
          search: [
            { title: "File:Tiny.png", snippet: "x", ns: 6 },
            { title: "File:Big.jpg", snippet: "y", ns: 6 },
          ],
        },
      },
      "titles=File%3ATiny.png": {
        query: {
          pages: {
            "1": {
              title: "File:Tiny.png",
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/wikipedia/commons/x/Tiny.png",
                  width: 50,
                  extmetadata: { LicenseShortName: { value: "PD" } },
                },
              ],
            },
          },
        },
      },
      "titles=File%3ABig.jpg": {
        query: {
          pages: {
            "1": {
              title: "File:Big.jpg",
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/wikipedia/commons/y/Big.jpg",
                  width: 1024,
                  extmetadata: { LicenseShortName: { value: "CC BY 4.0" }, Artist: { value: "X" } },
                },
              ],
            },
          },
        },
      },
    })
    const hit = await searchCommonsFile({ query: "x", fetcher })
    expect(hit?.title).toBe("File:Big.jpg")
    expect(hit?.license).toBe("CC-BY-4.0")
  })
})
