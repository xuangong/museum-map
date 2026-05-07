# Phase B.2 — Plan 03: Museum-site adapters

**Files:**
- Create: `src/services/museum-sites/types.ts`
- Create: `src/services/museum-sites/gugong.ts`
- Create: `src/services/museum-sites/chnmuseum.ts`
- Create: `src/services/museum-sites/shanghaimuseum.ts`
- Create: `src/services/museum-sites/njmuseum.ts`
- Create: `src/services/museum-sites/sxhm.ts`
- Create: `src/services/museum-sites/index.ts` (registry)
- Create: `tests/fixtures/museum-sites/{gugong,chnmuseum,shanghaimuseum,njmuseum,sxhm}-search.html`
- Create: `tests/museum-sites.test.ts`

Each adapter implements a single function: search the museum's collection page by artifact name, return up to 5 candidate `{ url, title, pageUrl }`.

---

## Task 1: Define shared types

- [ ] **Step 1: Create `src/services/museum-sites/types.ts`**

```ts
export interface MuseumSiteCandidate {
  url: string       // direct image URL
  title: string     // site's own caption / artifact name
  pageUrl: string   // collection page where the image lives (for attribution)
}

export interface MuseumSiteAdapter {
  /** Stable id matching the museum row's primary key in D1 */
  museumId: string
  /** Human label used in attribution captions */
  sourceLabel: string
  find: (opts: {
    artifactName: string
    period?: string | null
    fetcher?: typeof fetch
  }) => Promise<MuseumSiteCandidate[]>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/museum-sites/types.ts
git commit -m "feat(museum-sites): shared adapter types"
```

---

## Task 2: Identify the 5 target museum IDs

- [ ] **Step 1: Query D1 for the IDs**

```bash
curl -sS 'https://museum.xianliao.de5.net/api/museums' | jq -r '.[] | select(.name | test("故宫|国博|国家博物|上海博物|南京博物|陕西历史")) | "\(.id)\t\(.name)"'
```

Expected: 5 lines mapping ID → name. Record the actual IDs and update the registry constants in plan 03's Task 8.

> If a museum is missing from the live data, drop its adapter from this plan; update the registry to include only those that exist.

- [ ] **Step 2: Save mapping to a scratch file**

Create `/tmp/museum-ids.tsv` with the output. Reference these IDs in subsequent adapter modules.

---

## Task 3: Capture HTML fixtures (5 sites)

- [ ] **Step 1: Capture fixtures**

For each of the 5 sites, capture a search-results page using the artifact name "玉璧" (or a name confirmed to exist in that museum's catalog):

```bash
mkdir -p tests/fixtures/museum-sites
https_proxy=http://127.0.0.1:7890 curl -sS -A "Mozilla/5.0" \
  "https://www.dpm.org.cn/searchs/list.html?searchPhrase=%E7%8E%89%E7%92%A7" \
  -o tests/fixtures/museum-sites/gugong-search.html
https_proxy=http://127.0.0.1:7890 curl -sS -A "Mozilla/5.0" \
  "https://www.chnmuseum.cn/zh/?action=search&keyword=%E7%8E%89%E7%92%A7" \
  -o tests/fixtures/museum-sites/chnmuseum-search.html
https_proxy=http://127.0.0.1:7890 curl -sS -A "Mozilla/5.0" \
  "https://www.shanghaimuseum.net/mu/frontend/pg/article/list?word=%E7%8E%89%E7%92%A7" \
  -o tests/fixtures/museum-sites/shanghaimuseum-search.html
https_proxy=http://127.0.0.1:7890 curl -sS -A "Mozilla/5.0" \
  "https://www.njmuseum.com/zh/searchResult?searchKey=%E7%8E%89%E7%92%A7" \
  -o tests/fixtures/museum-sites/njmuseum-search.html
https_proxy=http://127.0.0.1:7890 curl -sS -A "Mozilla/5.0" \
  "https://www.sxhm.com/index.php?ac=search&kw=%E7%8E%89%E7%92%A7" \
  -o tests/fixtures/museum-sites/sxhm-search.html
```

> Each URL above is a best-guess based on each site's typical layout. If a site returns 404 or empty, open the museum's actual website in a browser, perform the search manually, copy the URL from the address bar, and update the curl invocation here.

- [ ] **Step 2: Verify each fixture is non-trivial**

```bash
wc -c tests/fixtures/museum-sites/*.html
```

Expected: each file > 5 KB and contains some `<img>` tag (`grep -c "<img" tests/fixtures/museum-sites/*.html`).

- [ ] **Step 3: Inspect each fixture and note selector**

For each file, open in a browser or `less`, find the search-result card structure, and note:
- The container selector (e.g. `.search-result-item`, `.list-card`)
- The image selector relative to the container
- The page-link selector

Write these into `/tmp/site-selectors.md` for reference in Task 4.

- [ ] **Step 4: Commit fixtures**

```bash
git add tests/fixtures/museum-sites/
git commit -m "test(fixtures): capture search HTML for 5 museum sites"
```

---

## Task 4: Write failing tests for all 5 adapters

- [ ] **Step 1: Create `tests/museum-sites.test.ts`**

```ts
import { describe, it, expect } from "bun:test"
import { readFileSync } from "node:fs"
import * as gugong from "~/services/museum-sites/gugong"
import * as chnmuseum from "~/services/museum-sites/chnmuseum"
import * as shanghaimuseum from "~/services/museum-sites/shanghaimuseum"
import * as njmuseum from "~/services/museum-sites/njmuseum"
import * as sxhm from "~/services/museum-sites/sxhm"

const loadFixture = (name: string) => readFileSync(`tests/fixtures/museum-sites/${name}-search.html`, "utf-8")

const fakeFetcher = (body: string): typeof fetch =>
  async () => new Response(body, { status: 200, headers: { "content-type": "text/html" } })

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
    const empty: typeof fetch = async () =>
      new Response("<html><body></body></html>", { status: 200 })
    const cands = await mod.find({ artifactName: "x", fetcher: empty })
    expect(cands).toEqual([])
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
bun test tests/museum-sites.test.ts
```

Expected: FAIL — modules not found.

---

## Task 5: Implement `gugong.ts`

- [ ] **Step 1: Write `src/services/museum-sites/gugong.ts`**

```ts
import * as cheerio from "cheerio"
import type { MuseumSiteCandidate } from "./types"

const UA = "Mozilla/5.0 museum-map/0.1"
const ORIGIN = "https://www.dpm.org.cn"

export const sourceLabel = "故宫博物院"

export async function find(opts: {
  artifactName: string
  period?: string | null
  fetcher?: typeof fetch
}): Promise<MuseumSiteCandidate[]> {
  const fetcher = opts.fetcher ?? fetch
  const url = `${ORIGIN}/searchs/list.html?searchPhrase=${encodeURIComponent(opts.artifactName)}`
  const res = await fetcher(url, { headers: { "user-agent": UA, referer: ORIGIN } })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out: MuseumSiteCandidate[] = []
  // NOTE: selector based on captured fixture; update if site changes.
  $(".search-result-item, .list-item, .result-card").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    const img = $el.find("img").first()
    const a = $el.find("a").first()
    let imgUrl = img.attr("src") || img.attr("data-src") || ""
    if (!imgUrl) return
    if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl
    else if (imgUrl.startsWith("/")) imgUrl = ORIGIN + imgUrl
    let pageUrl = a.attr("href") || ""
    if (pageUrl.startsWith("/")) pageUrl = ORIGIN + pageUrl
    if (!pageUrl) pageUrl = url
    const title = (a.attr("title") || $el.find(".title, .name").first().text() || img.attr("alt") || "").trim()
    out.push({ url: imgUrl, title: title || opts.artifactName, pageUrl })
  })
  return out
}
```

- [ ] **Step 2: Run gugong test only**

```bash
bun test tests/museum-sites.test.ts -t gugong
```

Expected: 3/3 pass for gugong (or for "returns candidates" the result may be `[]` if the fixture's selector differs — in that case inspect fixture, adjust the `.each(...)` selector list, and retry).

- [ ] **Step 3: Commit**

```bash
git add src/services/museum-sites/gugong.ts
git commit -m "feat(museum-sites): gugong adapter (dpm.org.cn search)"
```

---

## Task 6: Implement remaining 4 adapters

Repeat the Task 5 pattern for each. Each follows the **same shape** — only `ORIGIN`, the search URL template, and the cheerio selectors differ. For brevity each implementation block below shows only what changes; the rest of the file mirrors `gugong.ts` exactly.

- [ ] **Step 1: `src/services/museum-sites/chnmuseum.ts`**

```ts
import * as cheerio from "cheerio"
import type { MuseumSiteCandidate } from "./types"

const UA = "Mozilla/5.0 museum-map/0.1"
const ORIGIN = "https://www.chnmuseum.cn"

export const sourceLabel = "中国国家博物馆"

export async function find(opts: {
  artifactName: string
  period?: string | null
  fetcher?: typeof fetch
}): Promise<MuseumSiteCandidate[]> {
  const fetcher = opts.fetcher ?? fetch
  const url = `${ORIGIN}/zh/?action=search&keyword=${encodeURIComponent(opts.artifactName)}`
  const res = await fetcher(url, { headers: { "user-agent": UA, referer: ORIGIN } })
  if (!res.ok) return []
  const html = await res.text()
  const $ = cheerio.load(html)
  const out: MuseumSiteCandidate[] = []
  $(".search-list li, .result-item, .article-item").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    const img = $el.find("img").first()
    const a = $el.find("a").first()
    let imgUrl = img.attr("src") || img.attr("data-src") || ""
    if (!imgUrl) return
    if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl
    else if (imgUrl.startsWith("/")) imgUrl = ORIGIN + imgUrl
    let pageUrl = a.attr("href") || ""
    if (pageUrl.startsWith("/")) pageUrl = ORIGIN + pageUrl
    if (!pageUrl) pageUrl = url
    const title = (a.attr("title") || $el.find(".title").first().text() || img.attr("alt") || "").trim()
    out.push({ url: imgUrl, title: title || opts.artifactName, pageUrl })
  })
  return out
}
```

- [ ] **Step 2: `src/services/museum-sites/shanghaimuseum.ts`**

```ts
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
  $(".article-list li, .list-item, .collection-item").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    const img = $el.find("img").first()
    const a = $el.find("a").first()
    let imgUrl = img.attr("src") || img.attr("data-src") || ""
    if (!imgUrl) return
    if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl
    else if (imgUrl.startsWith("/")) imgUrl = ORIGIN + imgUrl
    let pageUrl = a.attr("href") || ""
    if (pageUrl.startsWith("/")) pageUrl = ORIGIN + pageUrl
    if (!pageUrl) pageUrl = url
    const title = (a.attr("title") || $el.find(".title").first().text() || img.attr("alt") || "").trim()
    out.push({ url: imgUrl, title: title || opts.artifactName, pageUrl })
  })
  return out
}
```

- [ ] **Step 3: `src/services/museum-sites/njmuseum.ts`**

```ts
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
  $(".search-list li, .result-card, .item").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    const img = $el.find("img").first()
    const a = $el.find("a").first()
    let imgUrl = img.attr("src") || img.attr("data-src") || ""
    if (!imgUrl) return
    if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl
    else if (imgUrl.startsWith("/")) imgUrl = ORIGIN + imgUrl
    let pageUrl = a.attr("href") || ""
    if (pageUrl.startsWith("/")) pageUrl = ORIGIN + pageUrl
    if (!pageUrl) pageUrl = url
    const title = (a.attr("title") || $el.find(".title").first().text() || img.attr("alt") || "").trim()
    out.push({ url: imgUrl, title: title || opts.artifactName, pageUrl })
  })
  return out
}
```

- [ ] **Step 4: `src/services/museum-sites/sxhm.ts`**

```ts
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
  $(".list li, .result-item, .article-item").each((_, el) => {
    if (out.length >= 5) return false
    const $el = $(el)
    const img = $el.find("img").first()
    const a = $el.find("a").first()
    let imgUrl = img.attr("src") || img.attr("data-src") || ""
    if (!imgUrl) return
    if (imgUrl.startsWith("//")) imgUrl = "https:" + imgUrl
    else if (imgUrl.startsWith("/")) imgUrl = ORIGIN + imgUrl
    let pageUrl = a.attr("href") || ""
    if (pageUrl.startsWith("/")) pageUrl = ORIGIN + pageUrl
    if (!pageUrl) pageUrl = url
    const title = (a.attr("title") || $el.find(".title").first().text() || img.attr("alt") || "").trim()
    out.push({ url: imgUrl, title: title || opts.artifactName, pageUrl })
  })
  return out
}
```

- [ ] **Step 5: Run all adapter tests**

```bash
bun test tests/museum-sites.test.ts
```

Expected: 15/15 pass (3 tests × 5 adapters). If a "returns candidates" test produces 0 results, inspect the corresponding HTML fixture and tweak the selector list — the empty-body and cap-at-5 tests should pass regardless.

- [ ] **Step 6: Commit**

```bash
git add src/services/museum-sites/{chnmuseum,shanghaimuseum,njmuseum,sxhm}.ts
git commit -m "feat(museum-sites): chnmuseum/shanghaimuseum/njmuseum/sxhm adapters"
```

---

## Task 7: Build the registry

- [ ] **Step 1: Create `src/services/museum-sites/index.ts`**

Use the IDs you saved in Task 2 Step 2. If a museum is not present in your D1, omit it.

```ts
import type { MuseumSiteAdapter } from "./types"
import * as gugong from "./gugong"
import * as chnmuseum from "./chnmuseum"
import * as shanghaimuseum from "./shanghaimuseum"
import * as njmuseum from "./njmuseum"
import * as sxhm from "./sxhm"

// REPLACE these IDs with the actual D1 museum.id values from Task 2 Step 1.
export const MUSEUM_SITE_ADAPTERS: MuseumSiteAdapter[] = [
  { museumId: "REPLACE_ME_GUGONG_ID",         sourceLabel: gugong.sourceLabel,         find: gugong.find },
  { museumId: "REPLACE_ME_CHNMUSEUM_ID",      sourceLabel: chnmuseum.sourceLabel,      find: chnmuseum.find },
  { museumId: "REPLACE_ME_SHANGHAI_ID",       sourceLabel: shanghaimuseum.sourceLabel, find: shanghaimuseum.find },
  { museumId: "REPLACE_ME_NJMUSEUM_ID",       sourceLabel: njmuseum.sourceLabel,       find: njmuseum.find },
  { museumId: "REPLACE_ME_SXHM_ID",           sourceLabel: sxhm.sourceLabel,           find: sxhm.find },
]

export function findAdapterFor(museumId: string): MuseumSiteAdapter | null {
  return MUSEUM_SITE_ADAPTERS.find((a) => a.museumId === museumId) ?? null
}
```

- [ ] **Step 2: Replace `REPLACE_ME_*` placeholders**

Open `/tmp/museum-ids.tsv` from Task 2, then `Edit` each placeholder to the real museum ID.

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/services/museum-sites/index.ts
git commit -m "feat(museum-sites): registry mapping museum IDs to adapters"
```

---

## Done when

- `bun test tests/museum-sites.test.ts` — 15/15 pass
- `bun run typecheck` — passes
- `MUSEUM_SITE_ADAPTERS` contains real D1 museum IDs (no `REPLACE_ME` strings)
