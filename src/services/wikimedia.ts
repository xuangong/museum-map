/** Wikidata + Wikimedia Commons read-only client. Pure JSON, no HTML parsing.
 * Both functions accept an optional `fetcher` for tests. */

const WM_UA = "museum-map/0.1 (https://museummap.xianliao.de5.net; admin@xianliao.de5.net)"
const WM_HEADERS = { accept: "application/json", "user-agent": WM_UA, "api-user-agent": WM_UA }

export interface WikidataHit {
  qid: string
  label: string
  description: string | null
}

export interface WikidataImage {
  url: string
  license: string | null
  attribution: string | null
}

export async function searchWikidataEntity(opts: {
  query: string
  fetcher?: typeof fetch
}): Promise<WikidataHit | null> {
  const fetcher = opts.fetcher ?? fetch
  const url =
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&language=zh&limit=3&search=" +
    encodeURIComponent(opts.query)
  const res = await fetcher(url, { headers: WM_HEADERS })
  if (!res.ok) return null
  const j: any = await res.json()
  const first = Array.isArray(j?.search) && j.search.length ? j.search[0] : null
  if (!first?.id) return null
  return {
    qid: String(first.id),
    label: String(first.label || ""),
    description: first.description ? String(first.description) : null,
  }
}

export async function fetchWikidataImage(opts: {
  qid: string
  fetcher?: typeof fetch
}): Promise<WikidataImage | null> {
  const fetcher = opts.fetcher ?? fetch
  const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(opts.qid)}.json`
  const ent = await fetcher(entityUrl, { headers: WM_HEADERS })
  if (!ent.ok) return null
  const ej: any = await ent.json()
  const claims = ej?.entities?.[opts.qid]?.claims
  const p18: any[] = claims?.P18 ?? []
  const filename = p18[0]?.mainsnak?.datavalue?.value
  if (!filename || typeof filename !== "string") return null

  const commonsUrl =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Cextmetadata&titles=" +
    encodeURIComponent("File:" + filename)
  const cm = await fetcher(commonsUrl, { headers: WM_HEADERS })
  if (!cm.ok) return null
  const cj: any = await cm.json()
  const pages = cj?.query?.pages
  const firstKey = pages ? Object.keys(pages)[0] : undefined
  const info = firstKey ? pages[firstKey]?.imageinfo?.[0] : undefined
  if (!info?.url) return null
  return {
    url: String(info.url),
    license: normalizeLicense(info.extmetadata?.LicenseShortName?.value || info.extmetadata?.License?.value),
    attribution: normalizeAttribution(info.extmetadata?.Artist?.value || info.extmetadata?.Credit?.value),
  }
}

function normalizeLicense(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null
  const s = raw.trim()
  if (!s) return null
  if (/public\s*domain/i.test(s)) return "PD"
  // "CC BY-SA 4.0" → "CC-BY-SA-4.0"; strip duplicate spaces, replace spaces with dash, uppercase.
  return s.replace(/\s+/g, "-").toUpperCase()
}

function normalizeAttribution(raw: unknown): string | null {
  if (!raw || typeof raw !== "string") return null
  // Strip HTML tags + collapse whitespace.
  const stripped = raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  if (!stripped) return null
  return stripped.length > 80 ? stripped.slice(0, 77) + "…" : stripped
}

export interface CommonsHit {
  title: string
  url: string
  license: string | null
  attribution: string | null
}

/** Search Wikimedia Commons file namespace (ns=6) for a query and return the first
 *  candidate with a width ≥ 200px (filters out tiny icons / broken thumbs). */
export async function searchCommonsFile(opts: {
  query: string
  fetcher?: typeof fetch
  /** Max candidates to inspect before giving up. Default 5. */
  limit?: number
}): Promise<CommonsHit | null> {
  const fetcher = opts.fetcher ?? fetch
  const limit = opts.limit ?? 5
  const searchUrl =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&list=search&srnamespace=6&srlimit=" +
    limit +
    "&srsearch=" +
    encodeURIComponent(opts.query)
  const sr = await fetcher(searchUrl, { headers: WM_HEADERS })
  if (!sr.ok) return null
  const sj: any = await sr.json()
  const hits: any[] = Array.isArray(sj?.query?.search) ? sj.query.search : []
  if (!hits.length) return null

  for (const h of hits) {
    const title = String(h?.title || "")
    if (!title) continue
    // Skip text-document scans (古籍 / 文献) — they're not artifact photos.
    if (/\.(djvu|pdf|tif|tiff|svg|webm|ogv)$/i.test(title)) continue
    if (!/\.(jpe?g|png|gif)$/i.test(title)) continue
    const infoUrl =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&titles=" +
      encodeURIComponent(title)
    const ir = await fetcher(infoUrl, { headers: WM_HEADERS })
    if (!ir.ok) continue
    const ij: any = await ir.json()
    const pages = ij?.query?.pages
    const firstKey = pages ? Object.keys(pages)[0] : undefined
    const info = firstKey ? pages[firstKey]?.imageinfo?.[0] : undefined
    if (!info?.url) continue
    const width = Number(info.width || 0)
    if (width && width < 200) continue
    return {
      title,
      url: String(info.url),
      license: normalizeLicense(info.extmetadata?.LicenseShortName?.value || info.extmetadata?.License?.value),
      attribution: normalizeAttribution(info.extmetadata?.Artist?.value || info.extmetadata?.Credit?.value),
    }
  }
  return null
}
