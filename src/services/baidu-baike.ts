/** Baidu Baike read-only client. JSON card API preferred; HTML fallback for image extraction.
 *  Both functions accept an optional `fetcher` for tests. */

import * as cheerio from "cheerio"

const BAIKE_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) museum-map/0.1"
const BAIKE_HEADERS = { "user-agent": BAIKE_UA, accept: "*/*" }

export interface BaikeEntry {
  url: string   // canonical https://baike.baidu.com/item/<...>
  title: string
}

export interface BaikeImage {
  url: string
  alt: string | null
  source: "infobox" | "gallery" | "body"
}

export async function searchBaikeEntry(opts: {
  query: string
  fetcher?: typeof fetch
}): Promise<BaikeEntry | null> {
  const fetcher = opts.fetcher ?? fetch
  const cardUrl =
    "https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_length=600&bk_key=" +
    encodeURIComponent(opts.query)
  const res = await fetcher(cardUrl, { headers: BAIKE_HEADERS })
  if (!res.ok) return null
  let j: any
  try {
    j = await res.json()
  } catch {
    return null
  }
  const url = typeof j?.url === "string" ? j.url : null
  const title = typeof j?.title === "string" ? j.title : (typeof j?.key === "string" ? j.key : null)
  if (!url || !title) return null
  // Normalize protocol-relative or missing scheme.
  const canonical = url.startsWith("//") ? "https:" + url : (url.startsWith("http://") ? url.replace("http://", "https://") : url)
  if (!/^https:\/\/baike\.baidu\.com\/(item|subview|view)\//.test(canonical)) return null
  return { url: canonical, title }
}

export async function extractBaikeImages(opts: {
  entryUrl: string
  fetcher?: typeof fetch
}): Promise<BaikeImage[]> {
  const fetcher = opts.fetcher ?? fetch
  const res = await fetcher(opts.entryUrl, { headers: BAIKE_HEADERS })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out: BaikeImage[] = []
  const seen = new Set<string>()
  const push = (url: string | undefined, alt: string | null, source: BaikeImage["source"]) => {
    if (!url) return
    let normalized = url.trim()
    if (normalized.startsWith("//")) normalized = "https:" + normalized
    if (!/^https?:\/\//.test(normalized)) return
    if (seen.has(normalized)) return
    seen.add(normalized)
    out.push({ url: normalized, alt, source })
  }
  // 1. og:image
  const og = $('meta[property="og:image"]').attr("content")
  push(og, null, "infobox")
  // 2. lemmaPicture (main infobox-style images)
  $(".lemmaPicture img, .J-lemma-content-single-image img").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    push($el.attr("src") || $el.attr("data-src"), $el.attr("alt") || null, "infobox")
  })
  // 3. gallery (swiper/album thumbnails)
  $(".swiperUl img, .swiperLi img, .album img, .album-list img, .lemmaAlbum img").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    push($el.attr("src") || $el.attr("data-src"), $el.attr("alt") || null, "gallery")
  })
  // 4. body images (para/main-content)
  $(".main-content img, .para img").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    push($el.attr("src") || $el.attr("data-src"), $el.attr("alt") || null, "body")
  })
  return out.slice(0, 5)
}
