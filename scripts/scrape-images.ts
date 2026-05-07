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

async function processMuseum(_m: Museum): Promise<number> { return 0 }

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
