import { Elysia } from "elysia"
import { DynastiesRepo } from "~/repo/dynasties"
import { VisitsRepo } from "~/repo/visits"
import { MuseumsRepo } from "~/repo/museums"
import { DynastyReviewCacheRepo } from "~/repo/dynasty-review-cache"
import { buildEvidence, type ArtifactSignal, type MuseumSignal } from "~/services/dynasty-museum-match"
import { generateReason } from "~/services/dynasty-reason"
import { normalizeLevel } from "~/services/level-tiers"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
  request: Request
  set: any
  body: any
  params: any
}

function checkAdmin(env: Env, request: Request) {
  if (!env.ADMIN_TOKEN) return { ok: false, status: 503, body: { error: "admin disabled" } }
  if ((request.headers.get("x-admin-token") || "") !== env.ADMIN_TOKEN)
    return { ok: false, status: 401, body: { error: "unauthorized" } }
  return { ok: true as const }
}

export const dynastiesRoute = new Elysia()
  .get("/api/dynasties", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new DynastiesRepo(env.DB)
    return await repo.listFull()
  })
  .get("/api/dynasties/:id", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new DynastiesRepo(env.DB)
    const d = await repo.get((ctx as any).params.id)
    if (!d) {
      ctx.set.status = 404
      return { error: "not_found" }
    }
    return d
  })
  .post("/api/admin/generate-dynasty-reasons", async (ctx) => {
    const { env, request, set, body } = ctx as unknown as RouteContext
    const auth = checkAdmin(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    if (!env.COPILOT_GATEWAY_URL || !env.COPILOT_GATEWAY_KEY) {
      set.status = 503
      return { error: "gateway not configured" }
    }
    const onlyDynasty: string | undefined = body?.dynastyId
    const force = !!body?.force
    const limit = Math.max(1, Math.min(200, Number(body?.limit) || 60))

    // Load dynasties
    const { results: dynRows } = await env.DB
      .prepare("SELECT id, name FROM dynasties ORDER BY order_index")
      .all<{ id: string; name: string }>()
    // Load museums (signals only)
    const { results: museums } = await env.DB
      .prepare(
        "SELECT id, name, core_period AS corePeriod, dynasty_coverage AS dynastyCoverage FROM museums",
      )
      .all<MuseumSignal>()
    const { results: artifacts } = await env.DB
      .prepare("SELECT museum_id, name, period FROM museum_artifacts")
      .all<ArtifactSignal>()
    const { results: existing } = await env.DB
      .prepare("SELECT dynasty_id, museum_id FROM dynasty_museum_reasons")
      .all<{ dynasty_id: string; museum_id: string }>()
    const have = new Set(existing.map((r) => `${r.dynasty_id}|${r.museum_id}`))

    let generated = 0
    let skipped = 0
    let failed = 0
    const log: string[] = []
    for (const d of dynRows) {
      if (onlyDynasty && d.id !== onlyDynasty) continue
      const evidences = buildEvidence({ id: d.id, name: d.name }, museums, artifacts)
      for (const ev of evidences) {
        if (generated >= limit) break
        const key = `${d.id}|${ev.museumId}`
        if (have.has(key) && !force) {
          skipped++
          continue
        }
        try {
          const reason = await generateReason({
            dynastyName: d.name,
            museumName: ev.museumName,
            evidence: ev,
            gatewayUrl: env.COPILOT_GATEWAY_URL,
            gatewayKey: env.COPILOT_GATEWAY_KEY,
          })
          if (!reason) {
            failed++
            continue
          }
          await env.DB
            .prepare(
              "INSERT INTO dynasty_museum_reasons (dynasty_id, museum_id, reason, evidence_json, generated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(dynasty_id, museum_id) DO UPDATE SET reason=excluded.reason, evidence_json=excluded.evidence_json, generated_at=excluded.generated_at",
            )
            .bind(d.id, ev.museumId, reason, JSON.stringify(ev), Date.now())
            .run()
          generated++
          log.push(`✓ ${d.name} × ${ev.museumName}: ${reason}`)
        } catch (e: any) {
          failed++
          log.push(`✗ ${d.name} × ${ev.museumName}: ${e?.message || "err"}`)
        }
      }
      if (generated >= limit) break
    }
    return { generated, skipped, failed, limit, log }
  })
  .get("/api/dynasties/:id/review", async (ctx) => {
    const { env, params } = ctx as unknown as RouteContext
    const cache = new DynastyReviewCacheRepo(env.DB)
    const dynastyId = params.id
    const cached = await cache.get(dynastyId)
    // Compute current visit count for this dynasty so client knows if cache is stale.
    const stats = await computeDynastyVisitStats(env, dynastyId)
    if (!cached) {
      return { summary: "", count: stats.relevantVisitCount, totalRelevant: stats.totalRelevant, cached: false, stale: false }
    }
    return {
      summary: cached.summary,
      count: cached.visit_count,
      currentCount: stats.relevantVisitCount,
      totalRelevant: stats.totalRelevant,
      generatedAt: cached.generated_at,
      cached: true,
      stale: cached.visit_count !== stats.relevantVisitCount,
    }
  })
  .post("/api/dynasties/:id/review", async (ctx) => {
    const { env, set, params } = ctx as unknown as RouteContext
    if (!env.COPILOT_GATEWAY_URL || !env.COPILOT_GATEWAY_KEY) {
      set.status = 503
      return { error: "gateway not configured" }
    }
    const dynastyId = params.id
    const repo = new DynastiesRepo(env.DB)
    const dynasty = await repo.get(dynastyId)
    if (!dynasty) {
      set.status = 404
      return { error: "dynasty not found" }
    }
    const stats = await computeDynastyVisitStats(env, dynastyId)
    if (stats.relevantVisitCount === 0) {
      return { summary: "", count: 0, totalRelevant: stats.totalRelevant }
    }

    const visitedSection = stats.visitedItems.map((v) => ({
      name: v.name,
      level: v.level,
      role: v.role, // 'curated' | 'tier1-related' | 'related'
      reason: v.reason,
      treasures: v.treasures.slice(0, 4),
      note: v.note,
    }))
    const candidates = stats.unvisitedRelevant.slice(0, 12).map((c) => ({
      name: c.name,
      role: c.role,
      reason: c.reason,
    }))

    const sys = `你是一位中国历史与博物馆策展顾问，面向**青年用户**——他们愿意走进博物馆、愿意理解中国历史，这件事本身就值得被看见和肯定。

任务：基于用户在【${dynasty.name}】这个朝代下已"打卡"的博物馆清单，写一段**完整、自洽、可分享**的中文评价（Markdown 格式：## 二级标题、**加粗**、列表）。

⚠️ 重要：
- 只评价该朝代相关的足迹，不要扯到别的朝代
- 不要冷冰冰罗列事实，要有**故事钩子**和情绪温度
- 不要"小朋友/家长/孩子"这类亲子腔，是同好之间的分享
- 鼓励但不肉麻；史实保真，叙事点燃
- 输出可独立成图分享，不要"上次说""根据反馈"这种引用

请严格按以下四段输出：

## 🏆 这一程
2-3 句，结合数字（已访 ${stats.relevantVisitCount} / ${stats.totalRelevant} 座该朝代相关馆）肯定他们的探索深度。点出"加权深度"——curated 推荐馆、一级馆/世遗他们各看了几座，让用户读完有"我真的走进了这个朝代"的具体感受。

## 🔍 你看到了什么
3-4 句，从他们打卡的博物馆里抽出 2-3 个**该朝代的具体面向**（比如某类文物、某段历史侧切面、某个地理脉络）。要具体到馆名/文物名，让用户看到"原来我已经触到了这些"。

## 🌌 还有什么在等你
2-3 句，从 candidates 里挑 1-2 座尚未打卡的馆，**讲清楚为什么这一站会让他对这个朝代的理解更立体**——补哪个视角、能见到什么不可替代的东西。措辞像朋友推荐，不要 PR 稿。

## ✦ 一句话
一句，作为收尾的诗意金句——把他和这个朝代的关系凝结成一行（不要 emoji，不要套路化的"愿你继续……"）。

直接给评，不要客套铺垫。**禁止 Markdown 表格**。`

    try {
      const res = await fetch(env.COPILOT_GATEWAY_URL.replace(/\/$/, "") + "/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.COPILOT_GATEWAY_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1500,
          stream: false,
          system: sys,
          messages: [
            {
              role: "user",
              content: `朝代：${dynasty.name}\n${dynasty.period ? `时段：${dynasty.period}\n` : ""}${dynasty.overview ? `朝代概述：${dynasty.overview}\n` : ""}\n该朝代相关馆共 ${stats.totalRelevant} 座，其中你已打卡 ${stats.relevantVisitCount} 座。\n\n已打卡（按角色）：\n${JSON.stringify(visitedSection, null, 2)}\n\n候选下一站（仅从这里挑推荐）：\n${JSON.stringify(candidates, null, 2)}`,
            },
          ],
        }),
      })
      if (!res.ok) {
        set.status = 502
        return { error: "ai gateway error", status: res.status }
      }
      const j: any = await res.json()
      const text = (j?.content || [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim()
      if (text) {
        const cache = new DynastyReviewCacheRepo(env.DB)
        await cache.save(dynastyId, text, stats.relevantVisitCount)
      }
      return { summary: text, count: stats.relevantVisitCount, totalRelevant: stats.totalRelevant }
    } catch (e: any) {
      set.status = 502
      return { error: e?.message || "ai call failed" }
    }
  })

interface DynastyVisitStats {
  relevantVisitCount: number
  totalRelevant: number
  visitedItems: Array<{
    museumId: string
    name: string
    level: string
    role: "curated" | "tier1-related" | "related"
    reason: string
    treasures: string[]
    note?: string
  }>
  unvisitedRelevant: Array<{
    museumId: string
    name: string
    role: "curated" | "tier1-related" | "related"
    reason: string
  }>
}

async function computeDynastyVisitStats(env: Env, dynastyId: string): Promise<DynastyVisitStats> {
  const repo = new DynastiesRepo(env.DB)
  const visits = new VisitsRepo(env.DB)
  const museums = new MuseumsRepo(env.DB)
  const dynasty = await repo.get(dynastyId)
  if (!dynasty) return { relevantVisitCount: 0, totalRelevant: 0, visitedItems: [], unvisitedRelevant: [] }
  const visitRows = await visits.list()
  const visitedIds = new Set(visitRows.map((v) => v.museum_id))
  const noteByMuseum: Record<string, string> = {}
  visitRows.forEach((v) => { if (v.note) noteByMuseum[v.museum_id] = v.note })

  type Entry = { museumId: string; name: string; role: "curated" | "tier1-related" | "related"; reason: string }
  const entries: Entry[] = []
  const seen = new Set<string>()
  for (const r of dynasty.recommendedMuseums) {
    if (!r.museumId || seen.has(r.museumId)) continue
    seen.add(r.museumId)
    entries.push({ museumId: r.museumId, name: r.name, role: "curated", reason: r.reason || "" })
  }
  // Need museum tier info for related ones
  const allMuseums = await museums.list()
  const museumById = new Map(allMuseums.map((m) => [m.id, m]))
  for (const r of dynasty.relatedMuseums) {
    if (!r.museumId || seen.has(r.museumId)) continue
    seen.add(r.museumId)
    const m = museumById.get(r.museumId)
    const tiers = m ? normalizeLevel(m.level) : []
    const role = tiers.includes("tier1") || tiers.includes("heritage-site") ? "tier1-related" : "related"
    entries.push({ museumId: r.museumId, name: r.name, role, reason: r.reason || "" })
  }

  const visitedItems: DynastyVisitStats["visitedItems"] = []
  const unvisitedRelevant: DynastyVisitStats["unvisitedRelevant"] = []
  for (const e of entries) {
    if (visitedIds.has(e.museumId)) {
      const m = museumById.get(e.museumId)
      visitedItems.push({
        museumId: e.museumId,
        name: e.name,
        level: m?.level || "",
        role: e.role,
        reason: e.reason,
        treasures: [],
        note: noteByMuseum[e.museumId],
      })
    } else {
      unvisitedRelevant.push({ museumId: e.museumId, name: e.name, role: e.role, reason: e.reason })
    }
  }
  // Fetch treasures for visited museums in this dynasty (single query).
  if (visitedItems.length > 0) {
    const placeholders = visitedItems.map(() => "?").join(",")
    const { results } = await env.DB
      .prepare(`SELECT museum_id, name FROM museum_treasures WHERE museum_id IN (${placeholders}) ORDER BY museum_id, order_index`)
      .bind(...visitedItems.map((v) => v.museumId))
      .all<{ museum_id: string; name: string }>()
    const byMuseum = new Map<string, string[]>()
    for (const r of results) {
      const arr = byMuseum.get(r.museum_id) ?? []
      arr.push(r.name)
      byMuseum.set(r.museum_id, arr)
    }
    visitedItems.forEach((v) => { v.treasures = (byMuseum.get(v.museumId) || []).slice(0, 5) })
  }
  return {
    relevantVisitCount: visitedItems.length,
    totalRelevant: entries.length,
    visitedItems,
    unvisitedRelevant,
  }
}

