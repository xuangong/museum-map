# Phase B.2 — Plan 05: Orchestrator script

**Files:**
- Create: `scripts/scrape-images.ts`
- Modify: `package.json` (add `scrape-images` npm script)

This is a **local-only** Bun script that:
1. Reads museums from D1 via the REST adapter (or direct API).
2. For each artifact, runs candidate hunts in parallel (Baidu Baike + 5 museum-site adapters + existing Wikimedia URL).
3. Calls the comparator to pick a winner.
4. Downloads the winner, hashes the URL, uploads to R2.
5. Writes back to D1 via existing admin endpoints.

> The orchestrator does **not** run inside the Worker. R2 is written via `wrangler r2 object put`. D1 is written via the existing `/api/import/upsert-museum` admin endpoint (or a new `/api/admin/set-artifact-image` route — see Task 5 below).

---

## Task 1: Add a small admin write endpoint

> A dedicated single-purpose endpoint avoids reconstructing the entire museum payload for one image.

**Files:**
- Create: `src/routes/admin-image.ts`
- Modify: `src/index.ts` (mount)
- Create: `tests/admin-image.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/admin-image.test.ts
import { describe, it, expect, beforeAll } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"
import { readFileSync } from "node:fs"

describe("POST /api/admin/set-artifact-image", () => {
  let mf: Miniflare
  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {}",
      r2Buckets: ["IMAGES"],
      d1Databases: ["DB"],
      kvNamespaces: ["RATE"],
      bindings: { ADMIN_TOKEN: "test-token" },
    })
    const db = await mf.getD1Database("DB")
    const sql = readFileSync("migrations/0001_init.sql", "utf-8")
    for (const stmt of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run()
    }
    await db.prepare(
      `INSERT INTO museums (id, name, lat, lng) VALUES ('m1', 'Test', 0, 0)`,
    ).run()
    await db.prepare(
      `INSERT INTO museum_artifacts (museum_id, idx, name) VALUES ('m1', 0, '玉璧')`,
    ).run()
  })

  const buildEnv = async () => ({
    DB: await mf.getD1Database("DB"),
    RATE: await mf.getKVNamespace("RATE"),
    IMAGES: await mf.getR2Bucket("IMAGES"),
    ADMIN_TOKEN: "test-token",
  } as any)

  it("rejects without admin token", async () => {
    const env = await buildEnv()
    const res = await createApp(env).handle(
      new Request("http://x/api/admin/set-artifact-image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ museumId: "m1", artifactIdx: 0, imageUrl: "/img/abc.jpg", license: "fair-use", attribution: "test" }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it("updates artifact image fields", async () => {
    const env = await buildEnv()
    const res = await createApp(env).handle(
      new Request("http://x/api/admin/set-artifact-image", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": "test-token" },
        body: JSON.stringify({
          museumId: "m1",
          artifactIdx: 0,
          imageUrl: "/img/abc.jpg",
          license: "fair-use",
          attribution: "来源：百度百科 · https://baike.baidu.com/item/x",
          sourceUrl: "https://baike.baidu.com/item/x",
          authority: "encyclopedia",
        }),
      }),
    )
    expect(res.status).toBe(200)
    const row: any = await env.DB.prepare(
      `SELECT image_url, image_license, image_attribution FROM museum_artifacts WHERE museum_id='m1' AND idx=0`,
    ).first()
    expect(row.image_url).toBe("/img/abc.jpg")
    expect(row.image_license).toBe("fair-use")
    expect(row.image_attribution).toContain("百度百科")
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
bun test tests/admin-image.test.ts
```

Expected: FAIL — route 404.

- [ ] **Step 3: Implement `src/routes/admin-image.ts`**

```ts
import { Elysia } from "elysia"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
  body: any
  headers: Record<string, string | undefined>
  set: { status?: number }
}

export const adminImageRoute = new Elysia().post("/api/admin/set-artifact-image", async (ctx) => {
  const { env, body, headers, set } = ctx as unknown as RouteContext
  const token = headers["x-admin-token"]
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    set.status = 401
    return { error: "unauthorized" }
  }
  const museumId = String(body?.museumId ?? "")
  const artifactIdx = Number(body?.artifactIdx ?? -1)
  const imageUrl = String(body?.imageUrl ?? "")
  const license = body?.license == null ? null : String(body.license)
  const attribution = body?.attribution == null ? null : String(body.attribution)
  const sourceUrl = body?.sourceUrl == null ? null : String(body.sourceUrl)
  const authority = body?.authority == null ? null : String(body.authority)
  if (!museumId || artifactIdx < 0 || !imageUrl) {
    set.status = 400
    return { error: "museumId, artifactIdx, imageUrl required" }
  }
  await env.DB.prepare(
    `UPDATE museum_artifacts SET image_url=?, image_license=?, image_attribution=? WHERE museum_id=? AND idx=?`,
  )
    .bind(imageUrl, license, attribution, museumId, artifactIdx)
    .run()
  if (sourceUrl && authority) {
    await env.DB.prepare(
      `INSERT INTO field_provenance (museum_id, field_path, source_url, authority, recorded_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(museum_id, field_path) DO UPDATE SET source_url=excluded.source_url, authority=excluded.authority, recorded_at=excluded.recorded_at`,
    )
      .bind(museumId, `artifacts[${artifactIdx}].image`, sourceUrl, authority, Date.now())
      .run()
  }
  return { ok: true }
})
```

- [ ] **Step 4: Mount in `src/index.ts`**

```ts
import { adminImageRoute } from "~/routes/admin-image"
// ...
    .use(plazaRoute)
    .use(adminImageRoute)
```

- [ ] **Step 5: Run tests to confirm pass**

```bash
bun test tests/admin-image.test.ts && bun run typecheck
```

Expected: 2/2 PASS, typecheck passes. If `field_provenance` schema lacks the assumed unique index, run `grep -n "field_provenance" migrations/*.sql` to confirm the actual conflict target and adjust the `ON CONFLICT` clause.

- [ ] **Step 6: Commit + deploy**

```bash
git add src/routes/admin-image.ts src/index.ts tests/admin-image.test.ts
git commit -m "feat(admin): POST /api/admin/set-artifact-image (single-artifact image upsert)"
bunx wrangler deploy
```

Expected: deploy succeeds. Verify:

```bash
curl -i -X POST https://museum.xianliao.de5.net/api/admin/set-artifact-image \
  -H "content-type: application/json" -d '{}'
```

Expected: `401 unauthorized`.

---

## Task 2: Write the orchestrator skeleton

- [ ] **Step 1: Create `scripts/scrape-images.ts`**

```ts
/** Phase B.2 image scraper.
 *
 * Usage:
 *   ADMIN_TOKEN=xxx COPILOT_GATEWAY_URL=... COPILOT_GATEWAY_KEY=... \
 *     bun run scripts/scrape-images.ts -- --museum=erlitou --dry-run
 *   ADMIN_TOKEN=xxx ... bun run scripts/scrape-images.ts -- --all
 *   bun run scripts/scrape-images.ts -- --museum=erlitou --concurrency=2
 *
 * Flags:
 *   --museum=<id>      restrict to one museum
 *   --all              run every museum
 *   --dry-run          do not write to R2/D1 — just log candidate decisions
 *   --concurrency=N    artifacts processed in parallel (default 3)
 *   --force            re-process artifacts that already have a fair-use image
 */

import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { searchBaikeEntry, extractBaikeImages } from "~/services/baidu-baike"
import { findAdapterFor } from "~/services/museum-sites"
import { compareAndChoose, type ComparatorCandidate } from "~/services/image-comparator"

const BASE = process.env.BASE ?? "https://museum.xianliao.de5.net"
const ADMIN_TOKEN = process.env.ADMIN_TOKEN
const GATEWAY_URL = process.env.COPILOT_GATEWAY_URL
const GATEWAY_KEY = process.env.COPILOT_GATEWAY_KEY

if (!ADMIN_TOKEN) { console.error("ADMIN_TOKEN env required"); process.exit(1) }
if (!GATEWAY_URL || !GATEWAY_KEY) { console.error("COPILOT_GATEWAY_URL/KEY env required"); process.exit(1) }

const args = process.argv.slice(2)
const museumArg = args.find((a) => a.startsWith("--museum="))?.slice("--museum=".length) ?? null
const all = args.includes("--all")
const dryRun = args.includes("--dry-run")
const force = args.includes("--force")
const concurrency = Number(args.find((a) => a.startsWith("--concurrency="))?.slice("--concurrency=".length) ?? "3")

if (!museumArg && !all) { console.error("provide --museum=<id> or --all"); process.exit(1) }

interface Artifact {
  idx: number
  name: string
  period: string | null
  image: string | null
  license: string | null
  attribution: string | null
}
interface Museum { id: string; name: string; artifacts: Artifact[] }

async function fetchMuseum(id: string): Promise<Museum> {
  const r = await fetch(`${BASE}/api/museums/${encodeURIComponent(id)}`)
  if (!r.ok) throw new Error(`fetch museum ${id}: ${r.status}`)
  const j: any = await r.json()
  return {
    id: j.id ?? id,
    name: j.name,
    artifacts: (j.artifacts ?? []).map((a: any, i: number) => ({
      idx: i,
      name: a.name,
      period: a.period ?? null,
      image: a.image ?? null,
      license: a.imageLicense ?? null,
      attribution: a.imageAttribution ?? null,
    })),
  }
}

async function listMuseumIds(): Promise<string[]> {
  const r = await fetch(`${BASE}/api/museums`)
  if (!r.ok) throw new Error(`list museums: ${r.status}`)
  const j: any = await r.json()
  const arr = Array.isArray(j) ? j : (j.museums ?? [])
  return arr.map((m: any) => m.id as string)
}

main().catch((e) => { console.error(e); process.exit(1) })

async function main() {
  const ids = museumArg ? [museumArg] : await listMuseumIds()
  console.log(`▶ ${ids.length} museum(s); concurrency=${concurrency}; dry=${dryRun}; force=${force}`)
  let totalArtifacts = 0
  let totalMatched = 0
  for (const id of ids) {
    const m = await fetchMuseum(id)
    const before = m.artifacts.filter((a) => a.image).length
    const matched = await processMuseum(m)
    totalArtifacts += m.artifacts.length
    totalMatched += matched
    console.log(`  ✓ ${m.name}: +${matched} (was ${before}/${m.artifacts.length})`)
  }
  console.log(`\nDONE: +${totalMatched} new across ${totalArtifacts} artifacts`)
}
```

> The body of `processMuseum`, candidate hunt, comparator, R2 upload, and D1 write are added in Tasks 3-6.

- [ ] **Step 2: Sanity check (no functional logic yet)**

```bash
bun run typecheck
```

Expected: passes (the missing `processMuseum` is referenced — declare it as a stub for now):

```ts
async function processMuseum(_m: Museum): Promise<number> { return 0 }
```

Add the stub above `main()`. Re-run typecheck.

- [ ] **Step 3: Commit skeleton**

```bash
git add scripts/scrape-images.ts
git commit -m "feat(scripts): scrape-images skeleton (CLI parsing + museum iteration)"
```

---

## Task 3: Implement candidate hunt

- [ ] **Step 1: Replace the `processMuseum` stub**

```ts
type Cand = ComparatorCandidate

async function huntCandidates(museumId: string, art: Artifact): Promise<Cand[]> {
  const out: Cand[] = []
  const seen = new Set<string>()
  const push = (c: Cand) => { if (seen.has(c.url)) return; seen.add(c.url); out.push(c) }

  // Source A: Baidu Baike
  const baidu = (async () => {
    try {
      const entry = await searchBaikeEntry({ query: art.name })
      if (!entry) return
      const imgs = await extractBaikeImages({ entryUrl: entry.url })
      for (const img of imgs.slice(0, 3)) {
        push({
          url: img.url,
          source: "baidu-baike",
          license: "fair-use",
          attribution: `来源：百度百科 · ${entry.url}`,
          pageUrl: entry.url,
        })
      }
    } catch (e) { console.warn(`    baidu err: ${(e as Error).message}`) }
  })()

  // Source B: museum-site adapter
  const adapter = findAdapterFor(museumId)
  const site = adapter
    ? (async () => {
        try {
          const cands = await adapter.find({ artifactName: art.name, period: art.period })
          for (const c of cands.slice(0, 3)) {
            push({
              url: c.url,
              source: adapter.sourceLabel,
              license: "fair-use",
              attribution: `来源：${adapter.sourceLabel} · ${c.pageUrl}`,
              pageUrl: c.pageUrl,
            })
          }
        } catch (e) { console.warn(`    adapter err: ${(e as Error).message}`) }
      })()
    : Promise.resolve()

  // Source C: existing Wikimedia URL (preserve CC/PD)
  if (art.image && art.license && /^(CC|PD)/i.test(art.license) && /upload\.wikimedia\.org/.test(art.image)) {
    push({
      url: art.image,
      source: "wikimedia",
      license: art.license,
      attribution: art.attribution ?? art.license,
      pageUrl: art.image,
    })
  }

  await Promise.all([baidu, site])
  return out
}
```

- [ ] **Step 2: Replace `processMuseum` body**

```ts
async function processMuseum(m: Museum): Promise<number> {
  const targets = m.artifacts.filter((a) => {
    if (force) return true
    // Skip if already has a fair-use image (treat as already processed by this pipeline)
    if (a.license === "fair-use") return false
    return true
  })
  if (targets.length === 0) return 0
  let matched = 0
  for (let i = 0; i < targets.length; i += concurrency) {
    const slice = targets.slice(i, i + concurrency)
    const results = await Promise.all(slice.map((a) => processArtifact(m.id, a)))
    matched += results.filter(Boolean).length
  }
  return matched
}

async function processArtifact(museumId: string, art: Artifact): Promise<boolean> {
  const cands = await huntCandidates(museumId, art)
  if (cands.length === 0) {
    console.log(`    · ${art.name}: 0 cands → skip`)
    return false
  }
  const choice = await compareAndChoose({
    artifact: { name: art.name, period: art.period },
    candidates: cands,
    gatewayUrl: GATEWAY_URL!,
    gatewayKey: GATEWAY_KEY!,
  })
  if (choice.chosen === null) {
    console.log(`    · ${art.name}: ${cands.length} cands, none accepted (${choice.reason})`)
    return false
  }
  const winner = cands[choice.chosen]!
  console.log(`    · ${art.name}: chose [${choice.chosen}] ${winner.source} — ${choice.reason}`)
  if (dryRun) return true
  // R2 upload + D1 write delegated to next tasks.
  return await persistImage(museumId, art, winner)
}

async function persistImage(_museumId: string, _art: Artifact, _winner: Cand): Promise<boolean> {
  // TODO Task 4 + Task 5
  return false
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
bun run typecheck
git add scripts/scrape-images.ts
git commit -m "feat(scripts): scrape-images candidate hunt + comparator wiring"
```

Expected: typecheck passes.

---

## Task 4: Download + R2 upload

- [ ] **Step 1: Replace `persistImage`**

```ts
async function persistImage(museumId: string, art: Artifact, winner: Cand): Promise<boolean> {
  // Download
  let bytes: Uint8Array
  let contentType: string
  try {
    const res = await fetch(winner.url, { headers: { "user-agent": "Mozilla/5.0 museum-map/0.1" } })
    if (!res.ok) {
      console.log(`      ✗ download ${winner.url}: ${res.status}`)
      return false
    }
    contentType = res.headers.get("content-type") ?? "image/jpeg"
    bytes = new Uint8Array(await res.arrayBuffer())
  } catch (e) {
    console.log(`      ✗ download err: ${(e as Error).message}`)
    return false
  }
  if (bytes.length < 1024) {
    console.log(`      ✗ image too small (${bytes.length} bytes) — likely placeholder`)
    return false
  }
  // Hash + ext
  const hash = createHash("sha256").update(winner.url).digest("hex").slice(0, 16)
  const ext = pickExt(contentType, winner.url)
  const key = `${hash}${ext}`
  // R2 upload via wrangler
  const tmp = `/tmp/scrape-${hash}${ext}`
  await Bun.write(tmp, bytes)
  const put = spawnSync("bunx", [
    "wrangler", "r2", "object", "put",
    `museum-images/${key}`,
    `--file=${tmp}`,
    `--content-type=${contentType}`,
    "--remote",
  ], { encoding: "utf-8" })
  if (put.status !== 0) {
    console.log(`      ✗ r2 put failed: ${put.stderr}`)
    return false
  }
  // D1 write via admin endpoint (next task)
  const ok = await writeArtifactImage({
    museumId,
    artifactIdx: art.idx,
    imageUrl: `/img/${key}`,
    license: winner.license,
    attribution: winner.attribution,
    sourceUrl: winner.pageUrl,
    authority: winner.source === "wikimedia" || winner.source === "baidu-baike" ? "encyclopedia" : "official",
  })
  if (!ok) console.log(`      ✗ d1 write failed`)
  return ok
}

function pickExt(contentType: string, url: string): string {
  const ct = contentType.toLowerCase()
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg"
  if (ct.includes("png")) return ".png"
  if (ct.includes("webp")) return ".webp"
  if (ct.includes("gif")) return ".gif"
  // fall back on URL extension
  const m = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)
  if (m) return "." + m[1]!.toLowerCase().replace("jpeg", "jpg")
  return ".jpg"
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
bun run typecheck
git add scripts/scrape-images.ts
git commit -m "feat(scripts): scrape-images downloads + uploads to R2"
```

---

## Task 5: D1 write via admin endpoint

- [ ] **Step 1: Add `writeArtifactImage`**

```ts
async function writeArtifactImage(opts: {
  museumId: string
  artifactIdx: number
  imageUrl: string
  license: string
  attribution: string
  sourceUrl: string
  authority: string
}): Promise<boolean> {
  const r = await fetch(`${BASE}/api/admin/set-artifact-image`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN! },
    body: JSON.stringify(opts),
  })
  if (!r.ok) {
    console.log(`      ✗ admin endpoint ${r.status}`)
    return false
  }
  return true
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
bun run typecheck
git add scripts/scrape-images.ts
git commit -m "feat(scripts): scrape-images writes to D1 via admin endpoint"
```

---

## Task 6: npm script alias

- [ ] **Step 1: Add to `package.json` `scripts`**

```json
"scrape-images": "bun run scripts/scrape-images.ts --"
```

- [ ] **Step 2: Smoke test (dry-run, single small museum, 1 artifact)**

```bash
ADMIN_TOKEN=$ADMIN_TOKEN \
  COPILOT_GATEWAY_URL=$COPILOT_GATEWAY_URL \
  COPILOT_GATEWAY_KEY=$COPILOT_GATEWAY_KEY \
  bun run scrape-images -- --museum=erlitou --dry-run --concurrency=1
```

Expected: prints `▶ 1 museum(s)`, then per-artifact lines `· <name>: <N> cands, chose [k] ...` or `0 cands → skip`. No R2/D1 writes.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(scripts): npm alias for scrape-images"
```

---

## Done when

- `bun test tests/admin-image.test.ts` — 2/2 pass
- `bun run scrape-images -- --museum=<id> --dry-run` runs end-to-end on at least one museum without crashing
- `bunx wrangler deploy` succeeded after Task 1
