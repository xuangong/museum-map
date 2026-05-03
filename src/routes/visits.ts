import { Elysia } from "elysia"
import type { Env } from "~/index"
import { VisitsRepo } from "~/repo/visits"
import { MuseumsRepo } from "~/repo/museums"
import { ReviewCacheRepo } from "~/repo/review-cache"
import { normalizeLevel, LEVEL_TIERS } from "~/services/level-tiers"

interface RouteContext {
  env: Env
  request: Request
  body: any
  params: any
  set: any
}

export const visitsRoute = new Elysia()
  .get("/api/visits", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new VisitsRepo(env.DB)
    const rows = await repo.list()
    return {
      items: rows.map((r) => ({ museumId: r.museum_id, visitedAt: r.visited_at, note: r.note })),
    }
  })
  .post("/api/visits/:id", async (ctx) => {
    const { env, params, body, set } = ctx as unknown as RouteContext
    const museums = new MuseumsRepo(env.DB)
    const m = await museums.get(params.id)
    if (!m) {
      set.status = 404
      return { error: "museum not found" }
    }
    const repo = new VisitsRepo(env.DB)
    const note = typeof body?.note === "string" ? body.note.slice(0, 500) : undefined
    await repo.checkIn(params.id, "me", note)
    return { ok: true, museumId: params.id }
  })
  .delete("/api/visits/:id", async (ctx) => {
    const { env, params, set } = ctx as unknown as RouteContext
    const repo = new VisitsRepo(env.DB)
    const ok = await repo.remove(params.id)
    if (!ok) {
      set.status = 404
      return { error: "not found" }
    }
    return { ok: true }
  })
  .post("/api/visits/review", async (ctx) => {
    const { env, body, set } = ctx as unknown as RouteContext
    if (!env.COPILOT_GATEWAY_URL || !env.COPILOT_GATEWAY_KEY) {
      set.status = 503
      return { error: "gateway not configured" }
    }
    const visits = new VisitsRepo(env.DB)
    const museums = new MuseumsRepo(env.DB)
    const rows = await visits.list()
    if (rows.length === 0) return { summary: "", count: 0 }

    const fulls = await Promise.all(rows.map((r) => museums.get(r.museum_id)))
    const items = fulls
      .map((m, i) => (m ? { m, visitedAt: rows[i]!.visited_at, note: rows[i]!.note } : null))
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const compact = items.map(({ m, note }) => ({
      name: m.name,
      level: m.level || "",
      coverage: m.dynastyCoverage || m.corePeriod || "",
      specialty: m.specialty || "",
      treasures: (m.treasures || []).slice(0, 5),
      dynasties: (m.dynastyConnections || []).map((c) => c.dynasty).slice(0, 8),
      note: note || undefined,
    }))

    // Provide a candidate list of museums NOT yet visited so the model can recommend real institutions.
    const visitedIds = new Set(items.map((x) => x.m.id))
    const allList = await museums.list()
    const candidates = allList
      .filter((m) => !visitedIds.has(m.id))
      .slice(0, 30)
      .map((m) => ({ name: m.name, period: m.corePeriod || "", coverage: m.dynastyCoverage || "" }))

    // Optional chat history (last N turns) carried back from the chat panel so the
    // re-generated review reflects what the user said they want next.
    type ChatTurn = { role: "user" | "assistant"; content: string }
    const rawHistory = Array.isArray(body?.chatHistory) ? (body.chatHistory as any[]) : []
    const chatHistory: ChatTurn[] = rawHistory
      .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
      .slice(-12)
      .map((t) => ({ role: t.role, content: String(t.content).slice(0, 1500) }))

    // Compute achievement stats so the model can lean on concrete numbers.
    const totalMuseums = allList.length
    const visitedCount = items.length
    const pct = totalMuseums > 0 ? Math.round((visitedCount / totalMuseums) * 100) : 0
    const levelCounts: Record<string, number> = {}
    const tierLabel: Record<string, string> = {}
    LEVEL_TIERS.forEach((t) => {
      if (t.id !== "all") tierLabel[t.id] = t.label
    })
    items.forEach(({ m }) => {
      const tiers = normalizeLevel(m.level)
      tiers.forEach((tid) => {
        const key = tierLabel[tid] || tid
        levelCounts[key] = (levelCounts[key] || 0) + 1
      })
    })
    const dynastySet = new Set<string>()
    items.forEach(({ m }) => (m.dynastyConnections || []).forEach((c) => c.dynasty && dynastySet.add(c.dynasty)))
    const treasureCount = items.reduce((n, { m }) => n + ((m.treasures || []).length), 0)
    const provinceSet = new Set<string>()
    items.forEach(({ m }) => {
      const loc = (m.location || "").trim()
      const prov = loc.match(/^(北京|上海|天津|重庆|香港|澳门|台湾|.{2,3}?(?:省|自治区))/)
      if (prov && prov[1]) provinceSet.add(prov[1])
    })
    const achievements = {
      visited: visitedCount,
      totalInIndex: totalMuseums,
      coveragePct: pct,
      levelBreakdown: levelCounts,
      dynastiesCovered: dynastySet.size,
      treasuresEncountered: treasureCount,
      provincesCovered: provinceSet.size,
    }

    const sys = `你是一位中国历史与博物馆策展顾问，语气温暖、鼓励、像朋友给建议。基于用户已"打卡"的博物馆清单${chatHistory.length ? "以及最近与你的对话" : ""}，写一段**完整、自洽、可独立分享**的中文评价（用 Markdown 格式，可以使用 ## 二级标题、**加粗**、列表）。

⚠️ **重要**：评价的最终用途是导出长截图分享出去，所以必须是**完整成型的一篇**，不能像"补丁"或"接续上文"。即使是根据对话更新，也要重新组织成一篇完整评价，不要出现"刚才提到""上次说""根据你的反馈"这类只在对话里有意义的引用。

请严格按以下四段输出，每段都不能省略：

## 🏆 成就总结（2-3 句）
基于给定的 \`achievements\` 数字，用具体数字夸赞用户：已访 N 座 / 占索引 X% / 覆盖 N 个朝代 / N 个省份 / 邂逅 N 件镇馆之宝 等。要让用户读完有"我做到了"的成就感，但不要堆砌全部数字，挑 2-3 个最亮眼的说。

## 🎯 探索路径（1-2 句）
肯定他们的探索方向，点出他们走的是哪条线（朝代脉络？地理迁徙？某类文物？）。

## 🖼️ 品味画像（3-4 句）
总结偏好的朝代 / 文化主题 / 文物类别（青铜、瓷器、书画、佛造像、玉器、漆器等）和叙事倾向${chatHistory.length ? "。如果对话中流露出明确兴趣点（城市、主题、时间预算），自然融入到画像里——但表述要像独立观察，不要说'你刚说……'" : ""}。

## ✦ 下一步建议（2-3 个，列表）
- **必须**从给定的 \`candidates\` 候选列表中挑名字（不要瞎编）
- 每条 1-2 句说明为什么适合这位用户、能补足什么视角或扩展什么主题
${chatHistory.length ? "- 如果对话中暴露了城市/朝代/类别约束，优先匹配；但措辞要自然，不要直接引用对话" : ""}

直接给评，不要客套铺垫，不要写"以下是评价"。鼓励但不肉麻。**禁止使用 Markdown 表格**（\`|---|\` 之类），统一用列表呈现，避免在分享图里渲染异常。`

    const chatBlock = chatHistory.length
      ? `\n\n（仅供你理解用户偏好，不要在输出里直接引用）最近对话：\n${chatHistory.map((t) => `- ${t.role === "user" ? "用户" : "顾问"}：${t.content}`).join("\n")}`
      : ""

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
          max_tokens: 1800,
          stream: false,
          system: sys,
          messages: [
            {
              role: "user",
              content: `成就数字（用于"成就总结"段，挑亮点说，不要堆砌全部）：\n${JSON.stringify(achievements, null, 2)}\n\n已打卡 ${items.length} 座博物馆：\n${JSON.stringify(compact, null, 2)}\n\n候选下一站（仅从这里挑推荐）：\n${JSON.stringify(candidates, null, 2)}${chatBlock}`,
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
        const cache = new ReviewCacheRepo(env.DB)
        await cache.save(text, rows.length, chatHistory.length > 0)
      }
      return { summary: text, count: rows.length, withChatContext: chatHistory.length > 0, achievements }
    } catch (e: any) {
      set.status = 502
      return { error: e?.message || "ai call failed" }
    }
  })
  .get("/api/visits/review", async (ctx) => {
    // Returns the cached review (saved by POST). Does NOT regenerate — clients
    // call POST explicitly when they want a fresh one.
    const { env } = ctx as unknown as RouteContext
    const cache = new ReviewCacheRepo(env.DB)
    const visits = new VisitsRepo(env.DB)
    const [cached, rows] = await Promise.all([cache.get(), visits.list()])
    const currentCount = rows.length
    if (!cached) return { summary: "", count: currentCount, cached: false, stale: false }
    return {
      summary: cached.summary,
      count: cached.visit_count,
      currentCount,
      generatedAt: cached.generated_at,
      withChatContext: !!cached.with_chat_context,
      cached: true,
      stale: cached.visit_count !== currentCount,
    }
  })
