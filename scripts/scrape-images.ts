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

  // Source B: museum-site adapter (returns 0 candidates today — JS-rendered SPAs)
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

async function processMuseum(m: Museum): Promise<number> {
  const targets = m.artifacts.filter((a) => {
    if (force) return true
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
  return await persistImage(museumId, art, winner)
}

async function persistImage(museumId: string, art: Artifact, winner: Cand): Promise<boolean> {
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
  const hash = createHash("sha256").update(winner.url).digest("hex").slice(0, 16)
  const ext = pickExt(contentType, winner.url)
  const key = `${hash}${ext}`
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
  const m = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)
  if (m) return "." + m[1]!.toLowerCase().replace("jpeg", "jpg")
  return ".jpg"
}

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
