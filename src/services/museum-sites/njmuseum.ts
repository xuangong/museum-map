import * as cheerio from "cheerio"
import type { MuseumSiteCandidate } from "./types"

const UA = "Mozilla/5.0 museum-map/0.1"
const ORIGIN = "https://www.njmuseum.com"

export const sourceLabel = "南京博物院"

export async function find(opts: {
  artifactName: string
  period?: string | null
  fetcher?: typeof fetch
}): Promise<MuseumSiteCandidate[]> {
  const fetcher = opts.fetcher ?? fetch
  const url = `${ORIGIN}/zh/searchResult?searchKey=${encodeURIComponent(opts.artifactName)}`
  const res = await fetcher(url, { headers: { "user-agent": UA, referer: ORIGIN } })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out: MuseumSiteCandidate[] = []
  // NOTE: Site is a JS SPA shell (Vue.js).
  // The captured HTML contains only <div id=app></div> with no parseable content.
  // This adapter returns [] as per spec for JS-rendered sites.
  return out
}
