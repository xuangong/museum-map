/**
 * Bulk-import the 13 missing museums via /api/import → auto-approve via /api/pending/:id/approve
 *
 * Usage:
 *   ADMIN_TOKEN=... bun run scripts/import-missing-museums.ts
 *   ADMIN_TOKEN=... bun run scripts/import-missing-museums.ts -- --dry-run
 */

const BASE = "https://museummap.xianliao.de5.net"
const TOKEN = process.env.ADMIN_TOKEN || ""
const DRY = process.argv.includes("--dry-run")

if (!TOKEN) {
  console.error("Set ADMIN_TOKEN env var.")
  process.exit(1)
}

// Queries to run. Use specific names that the import agent can search for.
const QUERIES = [
  "洛阳古代艺术博物馆（洛阳古墓博物馆）",
  "荆州博物馆",
  "曲阜孔子博物馆",
  "宝鸡青铜器博物院",
  "随州博物馆",
  "明十三陵定陵博物馆",
  "咸阳博物院",
  "承德避暑山庄博物馆",
  "汉景帝阳陵博物院（汉阳陵）",
  "茂陵博物馆",
  "宝鸡周原博物馆",
  "唐乾陵博物馆",
  "杭州南宋官窑博物馆",
]

interface ImportEvent {
  type: string
  message?: string
  payload?: any
  pendingId?: string
}

async function streamImport(query: string): Promise<{ pendingId: string | null; events: ImportEvent[] }> {
  const res = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "x-admin-token": TOKEN, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`import http ${res.status}: ${await res.text()}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  const events: ImportEvent[] = []
  let pendingId: string | null = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      try {
        const e = JSON.parse(line) as ImportEvent
        events.push(e)
        if (e.type === "saved" && (e as any).pendingId) pendingId = (e as any).pendingId
        if ((e as any).id && e.type === "done") pendingId = pendingId || (e as any).id
      } catch (_) {}
    }
  }
  return { pendingId, events }
}

async function listPending(): Promise<any[]> {
  const res = await fetch(`${BASE}/api/pending?status=pending`, { headers: { "x-admin-token": TOKEN } })
  if (!res.ok) throw new Error(`list pending ${res.status}`)
  const j = (await res.json()) as { items: any[] }
  return j.items
}

async function approve(id: string): Promise<{ ok: boolean; museumId?: string; error?: string }> {
  const res = await fetch(`${BASE}/api/pending/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { "x-admin-token": TOKEN },
  })
  const text = await res.text()
  if (!res.ok) return { ok: false, error: `${res.status} ${text}` }
  try {
    const j = JSON.parse(text) as any
    return { ok: true, museumId: j.museumId || j.id }
  } catch (_) {
    return { ok: true }
  }
}

async function main() {
  console.log(`Will import ${QUERIES.length} museum(s) against ${BASE} ${DRY ? "(DRY)" : ""}`)

  const results: { query: string; pendingId: string | null; museumId?: string; error?: string }[] = []
  for (const q of QUERIES) {
    const t0 = Date.now()
    process.stdout.write(`▶  ${q} ... `)
    try {
      const { pendingId, events } = await streamImport(q)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      const last = events[events.length - 1]
      console.log(`pending=${pendingId || "(none)"} [${elapsed}s] last=${last?.type || "?"}`)
      results.push({ query: q, pendingId })
    } catch (e: any) {
      console.log(`ERR: ${e.message}`)
      results.push({ query: q, pendingId: null, error: e.message })
    }
  }

  // After import, find pending IDs (in case streaming missed them)
  console.log(`\n=== Pending queue after imports ===`)
  const pending = await listPending()
  for (const p of pending) {
    console.log(`  ${p.id} [${p.verdict}] ${p.name} (${p.location || "?"})`)
  }

  if (DRY) {
    console.log("\n(Dry run. Skipping approve.)")
    return
  }

  console.log(`\n=== Approving ${pending.length} pending entries ===`)
  let ok = 0, fail = 0
  for (const p of pending) {
    const r = await approve(p.id)
    if (r.ok) {
      ok++
      console.log(`  ✓ ${p.name} → museumId=${r.museumId || "?"}`)
    } else {
      fail++
      console.log(`  ✗ ${p.name}: ${r.error}`)
    }
  }
  console.log(`\nDone: ${ok} approved, ${fail} failed.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
