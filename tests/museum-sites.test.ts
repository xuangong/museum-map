import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import * as gugong from "~/services/museum-sites/gugong"
import * as chnmuseum from "~/services/museum-sites/chnmuseum"
import * as shanghaimuseum from "~/services/museum-sites/shanghaimuseum"
import * as njmuseum from "~/services/museum-sites/njmuseum"
import * as sxhm from "~/services/museum-sites/sxhm"

const loadFixture = (name: string) => readFileSync(`tests/fixtures/museum-sites/${name}-search.html`, "utf-8")

const fakeFetcher = (body: string): typeof fetch =>
  (async () => new Response(body, { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch

describe.each([
  ["gugong", gugong],
  ["chnmuseum", chnmuseum],
  ["shanghaimuseum", shanghaimuseum],
  ["njmuseum", njmuseum],
  ["sxhm", sxhm],
] as const)("%s adapter", (name, mod) => {
  it("returns candidates from the search HTML fixture", async () => {
    const fetcher = fakeFetcher(loadFixture(name))
    const cands = await mod.find({ artifactName: "玉璧", fetcher })
    expect(Array.isArray(cands)).toBe(true)
    if (cands.length > 0) {
      expect(cands[0]!.url).toMatch(/^https?:\/\//)
      expect(cands[0]!.pageUrl).toMatch(/^https?:\/\//)
      expect(typeof cands[0]!.title).toBe("string")
    }
  })

  it("caps results at 5", async () => {
    const fetcher = fakeFetcher(loadFixture(name))
    const cands = await mod.find({ artifactName: "玉璧", fetcher })
    expect(cands.length).toBeLessThanOrEqual(5)
  })

  it("returns empty array when search returns empty body", async () => {
    const empty: typeof fetch = (async () =>
      new Response("<html><body></body></html>", { status: 200 })) as unknown as typeof fetch
    const cands = await mod.find({ artifactName: "x", fetcher: empty })
    expect(cands).toEqual([])
  })
})
