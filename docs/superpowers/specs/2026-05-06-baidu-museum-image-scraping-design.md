# Baidu + Museum-site Image Scraping (Phase B.2)

## Context

Phase B (Wikimedia/Wikidata) brought artifact image coverage to **51.4% (294/572)**. The remaining 278 artifacts have no image because they lack a Wikidata entity, have a generic name (e.g. "陶罐"), or aren't on Commons. To push coverage past 80%, we extend to two China-hosted sources under fair-use educational standards:

1. **Baidu Baike (百度百科)** — broad encyclopedia, infobox usually carries a representative image
2. **Five major museum official sites** — 故宫 / 国博 / 上博 / 南博 / 陕历博 — they publish structured collection pages with high-quality canonical images

Existing artifact image schema (`image_url`, `image_license`, `image_attribution`) is reused as-is.

## Non-goals

- Small/local museum scrapers (94 different sites, low ROI; covered indirectly by Baidu Baike)
- Video / 3D / 360° viewers
- Multiple images per artifact (UI still shows one)
- Image cropping / thumbnail generation (browser CSS controls display size)
- Admin re-pick UI (existing `/enrich-images <id>` chat command is the override mechanism)
- Worker-side scraping (avoids CN reverse-proxy fragility; see Architecture)

## Design

### Architecture

```
LOCAL MACHINE (clash → CN direct)
  scripts/scrape-images.ts (Bun)
    ├─ For each museum × artifact (full re-run, all 572):
    │    ├─ Source A: Baidu Baike search → entry page → infobox + body image candidates
    │    ├─ Source B: museum-site adapter (if museum has one) → collection page candidates
    │    ├─ Source C: existing Wikimedia url (if image_license starts with CC/PD)
    │    └─ Run image-comparator (Haiku):
    │         input  = artifact name + period + [up to ~6 candidate thumbnails with source labels]
    │         tool   = submit_choice({ sourceIdx | "none", reason })
    │         output = winner candidate or "none"
    ├─ Download winner bytes via fetch
    ├─ Upload to R2: key = sha256(originalUrl).slice(0,16) + ext
    ├─ Write D1: image_url = "/img/<hash>",
    │            image_license = winner.license ("fair-use" | "CC-BY-SA-4.0" | …),
    │            image_attribution = "来源：<source name> · <original page url>"
    └─ Write field_provenance: source_url = original page, authority = encyclopedia | official

CLOUDFLARE WORKER (runtime)
  GET /img/:hash
    └─ env.IMAGES.get(key) → Response with Cache-Control: public, max-age=31536000, immutable
       404 if missing
```

### Why local script, not Worker

- Baidu Baike + museum sites enforce IP-based rate limits and CF egress IPs are flagged
- Local clash already routes wikidata/wikimedia (and now baike) directly through the user's home proxy with stable reputation
- Run-time decoupling: D1 only ever sees finished `image_url = /img/<hash>` strings; no scraping happens during HTTP requests

### Why R2, not hot-link

- Baidu/museum sites change URLs without notice → broken images
- Defeats anti-hot-link (Referer/User-Agent) protections
- R2 free tier: 10 GB storage + 1M class-A ops/month. 1000 images × ~100 KB ≈ 100 MB, ~3000 ops total = well under quota
- Single immutable URL pattern simplifies CDN cache + browser cache

### Why LLM full re-compare (option B from brainstorm)

- A pure rule ("Wikimedia wins if exists") would skip cases where Wikimedia happens to have a generic placeholder while Baidu has the canonical artifact photo
- Haiku is cheap (~¥0.001 per artifact) and good at "which photo represents this object"
- **Risk acknowledgement**: this can downgrade a CC-BY image to a fair-use one. Mitigation:
  - The comparator's system prompt explicitly biases toward CC/PD when image quality is comparable
  - Caption always includes source + original URL so attribution survives any swap

### Source A: Baidu Baike scraper

`src/services/baidu-baike.ts`:

```ts
export async function searchBaikeEntry(opts: { query: string; fetcher?: typeof fetch }): Promise<{
  url: string         // canonical https://baike.baidu.com/item/<...>
  title: string
} | null>

export async function extractBaikeImages(opts: { entryUrl: string; fetcher?: typeof fetch }): Promise<Array<{
  url: string         // direct image URL (bkimg.cdn.bcebos.com / …)
  alt: string | null  // <img alt> or surrounding caption
  source: "infobox" | "gallery" | "body"
}>>
```

Implementation notes:
- Search via `https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?...` (returns JSON with cover image + summary + canonical URL — preferred path, no HTML parsing)
- Fallback: `https://baike.baidu.com/search?word=<query>` HTML scrape with `cheerio` if API is empty
- Entry page parse with `cheerio`: extract `og:image`, `.summary-pic img`, first 5 `.lemma-summary img`
- Cap candidates at 5 per entry to limit downstream LLM cost

### Source B: museum-site adapters

`src/services/museum-sites/`:

| File | Site | Strategy |
|---|---|---|
| `gugong.ts` | dpm.org.cn | Search `/collection/treasures.html?searchPhrase=<name>`, parse first card's `<img>` |
| `chnmuseum.ts` | chnmuseum.cn | Search collection page `/zh/portals/0/web/zlb/jpwx/...` |
| `shanghaimuseum.ts` | shanghaimuseum.net | Search `/mu/frontend/pg/article/list?word=<name>` |
| `njmuseum.ts` | njmuseum.com | Search `/Web/Search.aspx?q=<name>` |
| `sxhm.com` | sxhm.com | Search `/sygk/...` |

Each adapter exports:
```ts
export async function find(opts: { artifactName: string; period?: string | null; fetcher?: typeof fetch }): Promise<Array<{
  url: string
  title: string
  pageUrl: string
}>>
```

Adapter is invoked only when the museum's row is one of the five whitelisted IDs. Mapping lives in `src/services/museum-sites/index.ts`.

### Source C: existing Wikimedia URL

If `image_license` already starts with `CC`/`PD` and `image_url` starts with `https://upload.wikimedia.org`, include it as a candidate (label `"existing-wikimedia"`, license preserved). The comparator can keep it.

### Image comparator (LLM)

`src/services/image-comparator.ts` mirrors `runImageEnricher` shape:

```ts
export async function compareAndChoose(opts: {
  artifact: { name: string; period?: string | null }
  candidates: Array<{ url: string; source: string; license: string; attribution: string; pageUrl: string }>
  gatewayUrl: string
  gatewayKey: string
  gatewayFetcher?: typeof fetch
}): Promise<{ chosen: number | null; reason: string }>
```

System prompt key rules:
- 必须从候选 0..N-1 中选一个，或返回 "none" 表示全部不合适
- 优先选 license 为 CC/PD 的（许可清晰）
- 候选不应是周边图（朝代场景、电影海报、同名异物）
- 单一工具 `submit_choice({sourceIdx, reason})`，5 iter 上限

Candidates are passed as image content blocks (Anthropic vision input). The Worker gateway already supports `image` blocks in `/v1/messages`.

### R2 bucket + image proxy

`wrangler.toml`:
```toml
[[r2_buckets]]
binding = "IMAGES"
bucket_name = "museum-images"
```

`src/index.ts` `Env` adds `IMAGES: R2Bucket`.

`src/routes/image-proxy.ts` exports an Elysia plugin:
```ts
GET /img/:hash
  obj = env.IMAGES.get(hash)
  if !obj: 404
  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "etag": obj.etag,
    },
  })
```

Mounted in `src/index.ts` alongside other route files.

### Orchestrator script

`scripts/scrape-images.ts`:
- CLI flags: `--museum=<id>` (single), `--all`, `--dry-run` (no R2/D1 writes), `--concurrency=4`
- Reads target museums via D1 REST adapter (same pattern as `scripts/enrich-all.ts`)
- For each artifact:
  1. Gather candidates from Sources A + B (parallel) + C
  2. If 0 candidates: skip, log
  3. If 1 candidate: pick it (no LLM)
  4. If ≥2: call comparator
  5. Download chosen → R2 put → D1 update → field_provenance row
- Concurrency window of 4 artifacts at a time; per-host backoff on HTTP 429 / 503
- Resumable: skips artifact if `image_license = 'fair-use'` (treat existing fair-use rows as already processed; user can `--force` to retry)
- Final summary: per-museum delta + total coverage %

### License normalization

| Source | image_license value |
|---|---|
| Wikimedia (preserved) | `CC-BY-SA-4.0` etc. (existing values) |
| Baidu Baike | `fair-use` |
| Museum official site | `fair-use` |

Caption format (built into UI's existing `artifact-image-caption` div):
- `Photo: Daderot · CC-BY-SA-4.0` (Wikimedia, unchanged)
- `来源：百度百科 · https://baike.baidu.com/item/...` (Baidu)
- `来源：故宫博物院 · https://dpm.org.cn/...` (museum site)

UI builder in `src/ui/client/app.ts` (around `buildMuseumSections`) needs no changes — already concatenates `image_attribution` and `image_license` if present, but for fair-use rows the attribution string already contains the source label so we render attribution alone when license=`fair-use`.

## Files

### New
- `migrations/0008_baidu_image_pipeline.sql` — empty / doc-only migration noting field semantics expansion (no DDL change)
- `src/services/baidu-baike.ts`
- `src/services/museum-sites/index.ts` (registry)
- `src/services/museum-sites/{gugong,chnmuseum,shanghaimuseum,njmuseum,sxhm}.ts`
- `src/services/image-comparator.ts`
- `src/routes/image-proxy.ts`
- `scripts/scrape-images.ts`
- `tests/baidu-baike.test.ts`
- `tests/museum-sites.test.ts` (one fixture per adapter, miniflare fakeFetcher)
- `tests/image-comparator.test.ts`
- `tests/image-proxy.test.ts`

### Modified
- `wrangler.toml` — add `IMAGES` R2 binding
- `src/index.ts` — `Env` type adds `IMAGES: R2Bucket`; mount image-proxy route
- `src/ui/client/app.ts` — caption rendering: when `image_license === "fair-use"`, render attribution only (skip license suffix)

### Untouched
- All existing `image-enricher.ts` (Wikimedia path stays as a still-callable enricher; new pipeline is the orchestrator above it)
- D1 schema (column types unchanged)
- All existing tests

## Verification

1. **Local R2 binding**: `wrangler dev` → `curl localhost:8787/img/nonexistent` returns 404; manual `wrangler r2 object put museum-images/test.jpg --local --file=…` then GET returns bytes
2. **Adapter unit tests**: each scraper called with a captured HTML fixture (Bun fixture file under `tests/fixtures/`) returns expected candidate URLs
3. **Comparator unit test**: fake gateway returns `{tool_use: submit_choice, input: {sourceIdx: 1}}` → orchestrator picks index 1
4. **Dry run**: `bun run scripts/scrape-images.ts -- --museum=palace-museum --dry-run` lists candidates, no DB/R2 writes
5. **Single museum live**: `--museum=palace-museum` → `curl /api/museums/palace-museum | jq '.artifacts[].image'` shows `/img/<hash>` URLs; open drawer, images render
6. **Full run**: `--all --concurrency=4`; expect coverage ≥80% (target: from 51.4% → 80%+)
7. **Caption sampling**: random 10 fair-use rows in browser → confirm `来源：…` caption with original URL link
8. **Backward compat**: existing Wikimedia rows untouched (license still `CC-BY-SA-4.0`); pre-comparator artifacts with no candidates remain `image=NULL`

## Rollback

- **Code**: `git revert` removes routes, scrapers, comparator
- **Data**: `UPDATE museum_artifacts SET image_url=NULL, image_license=NULL, image_attribution=NULL WHERE image_license='fair-use'`
- **R2**: `wrangler r2 bucket delete museum-images --confirm` (or selective `r2 object delete --prefix=`)
- **Provenance**: `DELETE FROM field_provenance WHERE field_path LIKE '%.image' AND authority IN ('encyclopedia','official') AND source_url LIKE 'https://baike.baidu.com/%'` (and similar per-domain)

## Risks

- **Baidu anti-bot upgrade**: API endpoint may move or add captcha. Mitigation: per-host adaptive delay, log failures, fall back to HTML scrape; if fully blocked, manual headless-browser pass with Playwright (out of scope for now)
- **R2 cost spike**: monitored at run end; current estimate is well within free tier
- **Fair-use legal exposure**: site is non-commercial educational. Caption mandatory; root README adds disclaimer ("图片用于非商业教育用途，版权归原网站；如有侵权请联系删除")
- **LLM mis-selection**: ~5-10% expected. Existing `/enrich-images <id>` chat command lets admin re-run; future override UI deferred

## Out of scope (future)

- Phase B.3: admin override UI for manual image pick
- Phase B.4: extend to small/local museum sites (per-site adapters as needed)
- Phase B.5: image deduplication across artifacts (multiple artifacts may share a source image)
- Phase B.6: video / interactive 3D viewer integration
