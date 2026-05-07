import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { searchBaikeEntry, extractBaikeImages } from "~/services/baidu-baike"

const cardJson = readFileSync("tests/fixtures/baike-card-simuwu.json", "utf-8")
const entryHtml = readFileSync("tests/fixtures/baike-entry-simuwu.html", "utf-8")

const fakeFetcher = (urls: Record<string, { body: string; status?: number; type?: string }>): typeof fetch => {
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url
    for (const [pat, resp] of Object.entries(urls)) {
      if (url.indexOf(pat) >= 0) {
        return new Response(resp.body, {
          status: resp.status ?? 200,
          headers: { "content-type": resp.type ?? "text/html" },
        })
      }
    }
    return new Response("not found", { status: 404 })
  }) as unknown as typeof fetch
}

describe("searchBaikeEntry", () => {
  it("returns canonical entry URL from BaikeLemmaCardApi JSON", async () => {
    const fetcher = fakeFetcher({
      "BaikeLemmaCardApi": { body: cardJson, type: "application/json" },
    })
    const r = await searchBaikeEntry({ query: "司母戊鼎", fetcher })
    expect(r).not.toBeNull()
    expect(r!.url).toMatch(/^https:\/\/baike\.baidu\.com\/item\//)
    expect(r!.title).toContain("母戊")
  })

  it("returns null on empty card response", async () => {
    const fetcher = fakeFetcher({
      "BaikeLemmaCardApi": { body: "{}", type: "application/json" },
    })
    const r = await searchBaikeEntry({ query: "asdfasdfasdf", fetcher })
    expect(r).toBeNull()
  })
})

describe("extractBaikeImages", () => {
  it("extracts og:image and summary images from an entry page", async () => {
    const fetcher = fakeFetcher({
      "/item/": { body: entryHtml },
    })
    const imgs = await extractBaikeImages({ entryUrl: "https://baike.baidu.com/item/司母戊鼎", fetcher })
    expect(imgs.length).toBeGreaterThan(0)
    expect(imgs[0]!.url).toMatch(/^https?:\/\//)
    expect(imgs.some((i) => i.source === "infobox")).toBe(true)
  })

  it("caps results at 5", async () => {
    const fetcher = fakeFetcher({
      "/item/": { body: entryHtml },
    })
    const imgs = await extractBaikeImages({ entryUrl: "https://baike.baidu.com/item/x", fetcher })
    expect(imgs.length).toBeLessThanOrEqual(5)
  })
})
