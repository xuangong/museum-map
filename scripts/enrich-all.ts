/** Sequentially run /enrich-images for every museum, print a match histogram.
 *
 * Usage:
 *   ADMIN_TOKEN=xxx BASE=https://museummap.xianliao.de5.net bun run scripts/enrich-all.ts
 *   ADMIN_TOKEN=xxx bun run scripts/enrich-all.ts -- --only=erlitou,sanxingdui
 *   ADMIN_TOKEN=xxx bun run scripts/enrich-all.ts -- --skip-existing  (skip museums that already have ≥1 image)
 */

const BASE = process.env.BASE ?? "https://museum.xianliao.de5.net"
const TOKEN = process.env.ADMIN_TOKEN
if (!TOKEN) {
  console.error("ADMIN_TOKEN env required")
  process.exit(1)
}

const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length).split(",").filter(Boolean) ?? null
const skipExisting = args.includes("--skip-existing")

interface MuseumLite { id: string; name: string }

async function listMuseums(): Promise<MuseumLite[]> {
  const r = await fetch(`${BASE}/api/museums`)
  if (!r.ok) throw new Error(`list failed: ${r.status}`)
  const j: any = await r.json()
  const arr: any[] = j.museums ?? j ?? []
  return arr.map((m) => ({ id: m.id, name: m.name }))
}

async function museumImageCount(id: string): Promise<{ matched: number; total: number }> {
  const r = await fetch(`${BASE}/api/museums/${encodeURIComponent(id)}`)
  if (!r.ok) return { matched: 0, total: 0 }
  const j: any = await r.json()
  const arts: any[] = j.artifacts ?? []
  return { matched: arts.filter((a) => a.image).length, total: arts.length }
}

async function enrich(id: string): Promise<{ matched: number; total: number; error?: string }> {
  const r = await fetch(`${BASE}/api/museums/${encodeURIComponent(id)}/enrich-images`, {
    method: "POST",
    headers: { "x-admin-token": TOKEN! },
  })
  if (!r.ok || !r.body) return { matched: 0, total: 0, error: `http ${r.status}` }
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  let lastDone = ""
  let lastError = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line) continue
      try {
        const ev = JSON.parse(line)
        if (ev.type === "done") lastDone = String(ev.message ?? "")
        else if (ev.type === "error") lastError = String(ev.message ?? "")
      } catch {}
    }
  }
  if (lastError) return { matched: 0, total: 0, error: lastError }
  // "✅ N/M matched" or "N/M matched" or "no artifacts to enrich"
  const m = lastDone.match(/(\d+)\s*\/\s*(\d+)/)
  if (m) return { matched: Number(m[1]), total: Number(m[2]) }
  return { matched: 0, total: 0 }
}

async function main() {
  const all = await listMuseums()
  const targets = only ? all.filter((m) => only.includes(m.id)) : all
  console.log(`Will enrich ${targets.length} museum(s) against ${BASE}`)

  const rows: { id: string; name: string; matched: number; total: number; error?: string; skipped?: boolean }[] = []
  for (const m of targets) {
    if (skipExisting) {
      const cur = await museumImageCount(m.id)
      if (cur.matched > 0) {
        console.log(`⏭  ${m.id} (${m.name}) — already ${cur.matched}/${cur.total}`)
        rows.push({ id: m.id, name: m.name, matched: cur.matched, total: cur.total, skipped: true })
        continue
      }
    }
    process.stdout.write(`▶  ${m.id} (${m.name}) ... `)
    const t0 = Date.now()
    const res = await enrich(m.id)
    const dt = ((Date.now() - t0) / 1000).toFixed(1)
    if (res.error) console.log(`✗ ${res.error} [${dt}s]`)
    else console.log(`${res.matched}/${res.total} [${dt}s]`)
    rows.push({ id: m.id, name: m.name, ...res })
  }

  console.log("\n=== Summary ===")
  const totalMatched = rows.reduce((s, r) => s + r.matched, 0)
  const totalArtifacts = rows.reduce((s, r) => s + r.total, 0)
  const errored = rows.filter((r) => r.error).length
  const fullyMatched = rows.filter((r) => !r.skipped && r.total > 0 && r.matched === r.total).length
  const partial = rows.filter((r) => !r.skipped && r.matched > 0 && r.matched < r.total).length
  const zero = rows.filter((r) => !r.skipped && r.matched === 0 && !r.error && r.total > 0).length
  console.log(`Museums:    ${rows.length} (full=${fullyMatched}, partial=${partial}, zero=${zero}, error=${errored})`)
  console.log(`Artifacts:  ${totalMatched}/${totalArtifacts} matched (${totalArtifacts ? ((totalMatched / totalArtifacts) * 100).toFixed(1) : 0}%)`)
  if (errored > 0) {
    console.log("\nErrored:")
    for (const r of rows.filter((r) => r.error)) console.log(`  ${r.id}: ${r.error}`)
  }
}

await main()
export {}
