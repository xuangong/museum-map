import * as cheerio from "cheerio"
import type { MuseumSiteCandidate } from "./types"

const UA = "Mozilla/5.0 museum-map/0.1"
const ORIGIN = "https://www.shanghaimuseum.net"

export const sourceLabel = "上海博物馆"

export async function find(opts: {
  artifactName: string
  period?: string | null
  fetcher?: typeof fetch
}): Promise<MuseumSiteCandidate[]> {
  const fetcher = opts.fetcher ?? fetch
  const url = `${ORIGIN}/mu/frontend/pg/article/list?word=${encodeURIComponent(opts.artifactName)}`
  const res = await fetcher(url, { headers: { "user-agent": UA, referer: ORIGIN } })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out: MuseumSiteCandidate[] = []
  // NOTE: Search URL returns error page ("对不起，好像遇到点问题").
  // This adapter returns [] as per spec for non-scrapable sites.
  return out
}
