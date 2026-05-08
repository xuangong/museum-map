/**
 * Bulk-import Beijing 一/二级博物馆 + 世遗 + 重点国保 via /api/import → /api/pending/:id/approve
 *
 * Usage:
 *   ADMIN_TOKEN=... bun run scripts/import-beijing-museums.ts -- --dry-run
 *   ADMIN_TOKEN=... bun run scripts/import-beijing-museums.ts -- --only="首都博物馆" --confirm
 *   ADMIN_TOKEN=... bun run scripts/import-beijing-museums.ts -- --confirm
 */

const BASE = "https://museum.xianliao.de5.net"
const TOKEN = process.env.ADMIN_TOKEN || ""
const DRY = !process.argv.includes("--confirm")
const ONLY = (() => {
  const arg = process.argv.find((a) => a.startsWith("--only="))
  return arg ? arg.slice("--only=".length) : null
})()

if (!TOKEN) {
  console.error("Set ADMIN_TOKEN env var.")
  process.exit(1)
}

// 23 条目：14 一级 + 1 二级 + 5 世遗 + 3 国保
// 已在系统中跳过：故宫博物院、中国国家博物馆、颐和园、圆明园、明十三陵定陵、法源寺
const QUERIES = [
  // ── 一级博物馆 (14) ──
  "首都博物馆",
  "中国人民革命军事博物馆",
  "中国地质博物馆",
  "北京鲁迅博物馆",
  "北京自然博物馆（国家自然博物馆）",
  "北京天文馆",
  "中国古动物馆",
  "中国农业博物馆",
  "大钟寺古钟博物馆",
  "北京石刻艺术博物馆",
  "民族文化宫博物馆",
  "中国园林博物馆",
  "北京市古代建筑博物馆（先农坛）",
  "中国国家典籍博物馆",
  // ── 二级博物馆 (1) ──
  "北京民俗博物馆（东岳庙）",
  // ── 世界文化遗产 (5) ──
  "周口店北京人遗址博物馆",
  "八达岭长城",
  "天坛公园",
  "大运河北京段（白浮泉、燃灯塔、通州大运河遗址）",
  "北京中轴线（钟鼓楼、景山、正阳门、先农坛）",
  // ── 重点国保 (3) ──
  "北京智化寺（京音乐）",
  "北京孔庙和国子监博物馆",
  "妙应寺白塔（白塔寺）",
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
  const queries = ONLY ? QUERIES.filter((q) => q.includes(ONLY)) : QUERIES
  if (ONLY && queries.length === 0) {
    console.error(`No query matches --only=${ONLY}`)
    process.exit(1)
  }
  console.log(`Will import ${queries.length} museum(s) against ${BASE} ${DRY ? "(DRY — no confirm flag)" : "(LIVE)"}`)
  if (DRY) {
    for (const q of queries) console.log("  -", q)
    console.log("\n(Re-run with --confirm to actually import.)")
    return
  }

  const results: { query: string; pendingId: string | null; error?: string }[] = []
  for (const q of queries) {
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

  console.log(`\n=== Pending queue after imports ===`)
  const pending = await listPending()
  for (const p of pending) {
    console.log(`  ${p.id} [${p.verdict}] ${p.name} (${p.location || "?"})`)
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
