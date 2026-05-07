# Phase B.2 — Plan 02: Baidu Baike scraper

**Files:**
- Modify: `package.json` (add `cheerio`)
- Create: `src/services/baidu-baike.ts`
- Create: `tests/fixtures/baike-search.html`
- Create: `tests/fixtures/baike-entry.html`
- Create: `tests/baidu-baike.test.ts`

This plan adds a self-contained Baidu Baike client: search → entry URL, then entry URL → image candidate list.

---

## Task 1: Add `cheerio` dependency

- [ ] **Step 1: Install**

```bash
bun add cheerio
```

Expected: `cheerio` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Verify import works**

```bash
bun -e "import('cheerio').then(c => console.log(typeof c.load))"
```

Expected: `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb 2>/dev/null
git commit -m "feat(deps): add cheerio for HTML scraping"
```

---

## Task 2: Capture HTML fixtures

> **Note:** Use the user's local clash proxy if direct access fails. Run from project root.

- [ ] **Step 1: Capture a search-results page**

```bash
https_proxy=http://127.0.0.1:7890 \
  curl -sS -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" \
    "https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?scope=103&format=json&appid=379020&bk_key=%E5%8F%B8%E6%AF%8D%E6%88%8A%E9%BC%8E&bk_length=600" \
    -o tests/fixtures/baike-card-simuwu.json
```

Expected: a JSON file ~1-5 KB with `cardTitle`, `image`, `description`, `url` fields. (BaikeLemmaCardApi returns JSON, not HTML — preferred path.)

- [ ] **Step 2: Capture an entry-page HTML for fallback parser test**

```bash
https_proxy=http://127.0.0.1:7890 \
  curl -sS -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)" \
    "https://baike.baidu.com/item/%E5%8F%B8%E6%AF%8D%E6%88%8A%E9%BC%8E" \
    -o tests/fixtures/baike-entry-simuwu.html
```

Expected: file > 50 KB containing `<meta property="og:image"` and `summary-pic`.

- [ ] **Step 3: Sanity check the fixtures**

```bash
wc -c tests/fixtures/baike-card-simuwu.json tests/fixtures/baike-entry-simuwu.html
grep -c og:image tests/fixtures/baike-entry-simuwu.html
```

Expected: card JSON > 0 bytes, entry HTML > 50 KB, ≥1 occurrence of `og:image`.

- [ ] **Step 4: Commit fixtures**

```bash
git add tests/fixtures/baike-card-simuwu.json tests/fixtures/baike-entry-simuwu.html
git commit -m "test(fixtures): capture baidu baike search + entry HTML for 司母戊鼎"
```

---

## Task 3: Write failing tests for `searchBaikeEntry`

- [ ] **Step 1: Create `tests/baidu-baike.test.ts`**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { searchBaikeEntry, extractBaikeImages } from "~/services/baidu-baike"

const cardJson = readFileSync("tests/fixtures/baike-card-simuwu.json", "utf-8")
const entryHtml = readFileSync("tests/fixtures/baike-entry-simuwu.html", "utf-8")

const fakeFetcher = (urls: Record<string, { body: string; status?: number; type?: string }>): typeof fetch => {
  return async (input: any) => {
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
  }
}

describe("searchBaikeEntry", () => {
  it("returns canonical entry URL from BaikeLemmaCardApi JSON", async () => {
    const fetcher = fakeFetcher({
      "BaikeLemmaCardApi": { body: cardJson, type: "application/json" },
    })
    const r = await searchBaikeEntry({ query: "司母戊鼎", fetcher })
    expect(r).not.toBeNull()
    expect(r!.url).toMatch(/^https:\/\/baike\.baidu\.com\/item\//)
    expect(r!.title).toContain("司母戊")
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test tests/baidu-baike.test.ts
```

Expected: FAIL — module `~/services/baidu-baike` not found.

---

## Task 4: Implement `src/services/baidu-baike.ts`

- [ ] **Step 1: Write the module**

```ts
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
  const title = typeof j?.cardTitle === "string" ? j.cardTitle : (typeof j?.abstractTitle === "string" ? j.abstractTitle : null)
  if (!url || !title) return null
  // Normalize protocol-relative or missing scheme.
  const canonical = url.startsWith("//") ? "https:" + url : url
  if (!/^https?:\/\/baike\.baidu\.com\/item\//.test(canonical)) return null
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
  // 2. summary picture
  $(".summary-pic img, .lemma-summary-pic img").each((_, el) => {
    const $el = $(el)
    push($el.attr("src") || $el.attr("data-src"), $el.attr("alt") || null, "infobox")
  })
  // 3. gallery (album thumbnails)
  $(".lemma-album img, .album-list img").each((_, el) => {
    const $el = $(el)
    push($el.attr("src") || $el.attr("data-src"), $el.attr("alt") || null, "gallery")
  })
  // 4. body images
  $(".main-content img, .para img").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    push($el.attr("src") || $el.attr("data-src"), $el.attr("alt") || null, "body")
  })
  return out.slice(0, 5)
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
bun test tests/baidu-baike.test.ts
```

Expected: all 4 tests PASS.

> If `extractBaikeImages` returns 0 images, inspect the fixture: open `tests/fixtures/baike-entry-simuwu.html` and verify the selectors. Update selector list to match what's actually in the page.

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/services/baidu-baike.ts tests/baidu-baike.test.ts
git commit -m "feat(services): baidu-baike client (search + image extraction)"
```

---

## Done when

- `bun test tests/baidu-baike.test.ts` — 4/4 pass
- `bun run typecheck` — passes
