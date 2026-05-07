import * as cheerio from "cheerio"
import type { MuseumSiteCandidate } from "./types"

const UA = "Mozilla/5.0 museum-map/0.1"
const ORIGIN = "https://www.sxhm.com"

export const sourceLabel = "陕西历史博物馆"

export async function find(opts: {
  artifactName: string
  period?: string | null
  fetcher?: typeof fetch
}): Promise<MuseumSiteCandidate[]> {
  const fetcher = opts.fetcher ?? fetch
  const url = `${ORIGIN}/index.php?ac=search&kw=${encodeURIComponent(opts.artifactName)}`
  const res = await fetcher(url, { headers: { "user-agent": UA, referer: ORIGIN } })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out: MuseumSiteCandidate[] = []
  // NOTE: Search URL returns homepage content (no actual search results in HTML).
  // The site likely uses client-side JS to render search results.
  // This adapter returns [] as per spec for JS-rendered sites.
  return out
}
