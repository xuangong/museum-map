import { runToolLoop } from "./agent-loop"
import { searchWikidataEntity, fetchWikidataImage, searchCommonsFile } from "./wikimedia"
import { MuseumsRepo } from "~/repo/museums"
import { FieldProvenanceRepo } from "~/repo/field-provenance"
import type { MuseumPayload } from "./import-schema"

export const ENRICHER_MODEL = "claude-haiku-4-5"
export const ENRICHER_MAX_TOKENS = 2048
export const ENRICHER_MAX_ITERS = 40
export const ENRICHER_WALL_MS = 180_000

export interface EnrichEvent {
  type: "thinking" | "tool" | "tool_result" | "done" | "error"
  message: string
  data?: unknown
}

export interface EnrichOpts {
  db: D1Database
  museumId: string
  gatewayUrl: string
  gatewayKey: string
  onEvent: (e: EnrichEvent) => void | Promise<void>
  /** Used for the LLM gateway calls (the agent loop). */
  gatewayFetcher?: typeof fetch
  /** Used for Wikimedia/Wikidata HTTP calls inside the tools. */
  wmFetcher?: typeof fetch
  now?: () => number
}

export interface EnrichResult {
  matched: number
  total: number
  error?: string
}

export interface ArtifactMatch {
  url?: string
  license?: string | null
  attribution?: string | null
  /** Provenance source URL (Commons file page or Wikidata entity page). */
  source?: string
  /** Legacy/alternate: if agent returns a QID, we'll synthesize the source URL. */
  qid?: string
}

const SYSTEM = `你是一名艺术品图片采编员。给定一个博物馆的代表文物列表，你要为每件文物从 Wikimedia 找一张可用的图片。

工作流程：
1. **优先 commons_search**：用文物名（可加馆名/年代/材质等关键词）直接在 Wikimedia Commons 搜索文件。绝大多数中国文物在 Commons 有图但在 Wikidata 没有单独条目。
2. 如果 commons_search 没有合理结果，可尝试 wikidata_search → wikidata_image。
3. 如果两条路都没有命中，**跳过该文物**，绝不编造。
4. **每件文物最多尝试 2 次搜索**——找不到就跳过，节约迭代。
5. 全部处理完后**必须**调用一次 submit_results 提交结果。**绝不能因为没找到任何图片就不调用 submit_results**——空 matches 也要提交（matches: {}）。
6. **不要做"汇总思考"**——直接调用 submit_results。已经在内部消息里梳理过的结果，提交时直接照抄。

**质量底线**（违反任意一条 → 跳过该文物，不要列入 matches）：
- 不接受 \`.djvu / .pdf / 古籍 / 詩集 / 文獻 / 縣誌\` 这类古籍数字化文件——这些是文献扫描，不是文物照片。
- **接受规则**（满足任意一条即可）：
  (a) Commons 文件标题**完整包含文物名**（例如文物 "绿松石龙形器" 对应 "File:绿松石龙形器.jpg" 或 "File:绿松石龙形器及铜铃.jpg"），这种命名说明上传者明确指代该件文物，可以接受；
  (b) 文件标题包含本馆名/所在地/同一遗址（例如 "二里头出土..."、"故宫博物院藏..."）；
  (c) 文物本身就是举世闻名的孤品（"四羊方尊"、"越王勾践剑"、"司母戊鼎"、"曾侯乙编钟" 等），并且文件标题至少含文物核心名。
- **拒绝规则**：
  - 文物名包含具体的纹饰/形制（如 "乳钉纹青铜爵"、"网格纹青铜鼎"），但文件只是泛泛 "青铜爵" / "青铜鼎"——纹饰是辨识依据，缺失就算泛化匹配，跳过。
  - 类型相同但具体形制不同（如 "龙形牙璋" vs 文件 "玉璋"——牙璋和玉璋是不同形制），跳过。
  - 同一时代/类型但不同地域、不同出土地（如本馆是定州，文件来自正定龙兴寺），跳过。
- 宁可少匹配，也不要错匹配。

submit_results.matches 是一个对象：键是文物名（与输入完全一致），值是 { url, license, attribution, source }，其中 source 是用于 provenance 的来源 URL：
- 来自 commons_search：填 \`https://commons.wikimedia.org/wiki/<title>\`（title 即返回的文件标题）
- 来自 wikidata_image：填 \`https://www.wikidata.org/wiki/<QID>\`

只列入找到图片的文物，未找到的不要列出。最多 24 轮工具调用。`

function buildTools(): any[] {
  return [
    {
      name: "commons_search",
      description:
        "在 Wikimedia Commons 直接搜索图片文件。返回第一张宽度≥200px 的候选 { title, url, license, attribution }。最适合具体文物。",
      input_schema: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
    },
    {
      name: "wikidata_search",
      description: "在 Wikidata 用中文搜索实体。返回最匹配的 QID + 标签 + 描述。仅在 commons_search 无结果时使用。",
      input_schema: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
    },
    {
      name: "wikidata_image",
      description: "给定 QID，返回该实体的图片 URL + 许可证 + 作者（取自 Wikimedia Commons）。",
      input_schema: {
        type: "object",
        required: ["qid"],
        properties: { qid: { type: "string" } },
      },
    },
    {
      name: "submit_results",
      description: "提交本次匹配结果。本次任务只能调用一次。",
      input_schema: {
        type: "object",
        required: ["matches"],
        properties: {
          matches: {
            type: "object",
            additionalProperties: {
              type: "object",
              required: ["url", "source"],
              properties: {
                url: { type: "string" },
                license: { type: "string" },
                attribution: { type: "string" },
                source: { type: "string" },
              },
            },
          },
        },
      },
    },
  ]
}

function makeExecuteTool(
  opts: EnrichOpts,
  wmFetcher: typeof fetch,
  getSubmitted: () => Record<string, ArtifactMatch> | null,
  setSubmitted: (s: Record<string, ArtifactMatch>) => void,
) {
  return async (call: { id: string; name: string; input: any }) => {
    if (call.name === "commons_search") {
      const q = String(call.input?.query || "").trim()
      if (!q) return { tool_use_id: call.id, content: "query required", is_error: true }
      await opts.onEvent({ type: "tool", message: `🖼️ Commons: ${q}` })
      try {
        const hit = await searchCommonsFile({ query: q, fetcher: wmFetcher })
        await opts.onEvent({
          type: "tool_result",
          message: hit ? `✅ ${hit.title}` : `— 无结果`,
        })
        return { tool_use_id: call.id, content: JSON.stringify(hit ?? { hit: null }) }
      } catch (e: any) {
        return { tool_use_id: call.id, content: `error: ${e?.message}`, is_error: true }
      }
    }
    if (call.name === "wikidata_search") {
      const q = String(call.input?.query || "").trim()
      if (!q) return { tool_use_id: call.id, content: "query required", is_error: true }
      await opts.onEvent({ type: "tool", message: `🔍 Wikidata: ${q}` })
      try {
        const hit = await searchWikidataEntity({ query: q, fetcher: wmFetcher })
        await opts.onEvent({
          type: "tool_result",
          message: hit ? `✅ ${hit.qid} ${hit.label}` : `— 无结果`,
        })
        return { tool_use_id: call.id, content: JSON.stringify(hit ?? { hit: null }) }
      } catch (e: any) {
        return { tool_use_id: call.id, content: `error: ${e?.message}`, is_error: true }
      }
    }
    if (call.name === "wikidata_image") {
      const qid = String(call.input?.qid || "").trim()
      if (!/^Q\d+$/.test(qid)) return { tool_use_id: call.id, content: "qid required (Q123)", is_error: true }
      await opts.onEvent({ type: "tool", message: `🖼️ ${qid}` })
      try {
        const img = await fetchWikidataImage({ qid, fetcher: wmFetcher })
        await opts.onEvent({
          type: "tool_result",
          message: img ? `✅ ${img.license || ""} ${img.attribution || ""}`.trim() : `— 无图片`,
        })
        return { tool_use_id: call.id, content: JSON.stringify(img ?? { image: null }) }
      } catch (e: any) {
        return { tool_use_id: call.id, content: `error: ${e?.message}`, is_error: true }
      }
    }
    if (call.name === "submit_results") {
      if (getSubmitted()) return { tool_use_id: call.id, content: "already submitted", is_error: true }
      const matches = call.input?.matches
      if (!matches || typeof matches !== "object") {
        return { tool_use_id: call.id, content: "matches must be an object", is_error: true }
      }
      setSubmitted(matches as Record<string, ArtifactMatch>)
      return { tool_use_id: call.id, content: JSON.stringify({ ok: true, count: Object.keys(matches).length }) }
    }
    return { tool_use_id: call.id, content: `unknown tool: ${call.name}`, is_error: true }
  }
}

export async function runImageEnricher(opts: EnrichOpts): Promise<EnrichResult> {
  const now = opts.now ?? Date.now
  const wmFetcher = opts.wmFetcher ?? fetch
  const museums = new MuseumsRepo(opts.db)
  const provRepo = new FieldProvenanceRepo(opts.db)

  const m = await museums.get(opts.museumId)
  if (!m) {
    await opts.onEvent({ type: "error", message: `museum not found: ${opts.museumId}` })
    return { matched: 0, total: 0, error: "not found" }
  }
  const total = m.artifacts.length
  if (total === 0) {
    await opts.onEvent({ type: "done", message: "no artifacts to enrich" })
    return { matched: 0, total: 0 }
  }

  const userMsg =
    `当前博物馆：**${m.name}**\n请为以下馆藏文物逐一查找 Wikimedia Commons 图片，按 SYSTEM 中的接受/拒绝规则严格判断。\n\n文物列表：\n` +
    m.artifacts
      .map((a, i) => `${i + 1}. ${a.name}${a.period ? ` (${a.period})` : ""}`)
      .join("\n")
  const messages: any[] = [{ role: "user", content: userMsg }]

  let submitted: Record<string, ArtifactMatch> | null = null
  let nudged = false

  let result = await runToolLoop({
    gatewayUrl: opts.gatewayUrl,
    gatewayKey: opts.gatewayKey,
    model: ENRICHER_MODEL,
    maxTokens: ENRICHER_MAX_TOKENS,
    system: SYSTEM,
    tools: buildTools(),
    messages,
    maxIters: ENRICHER_MAX_ITERS,
    wallMs: ENRICHER_WALL_MS,
    fetcher: opts.gatewayFetcher,
    now,
    onText: async (t) => {
      await opts.onEvent({ type: "thinking", message: t })
    },
    shouldStop: () => submitted !== null,
    executeTool: makeExecuteTool(opts, wmFetcher, () => submitted, (s) => { submitted = s }),
  })

  // If the model stopped without calling submit_results, push one explicit nudge.
  if (!submitted && (result.stopReason === "end_turn" || result.stopReason === "no_tool") && !nudged) {
    nudged = true
    messages.push({
      role: "user",
      content:
        "你还没有调用 submit_results。现在必须立即调用 submit_results，把已经找到的文物图片整理成 matches 对象提交。即使 matches 为空 ({}) 也要提交。",
    })
    result = await runToolLoop({
      gatewayUrl: opts.gatewayUrl,
      gatewayKey: opts.gatewayKey,
      model: ENRICHER_MODEL,
      maxTokens: ENRICHER_MAX_TOKENS,
      system: SYSTEM,
      tools: buildTools(),
      messages,
      maxIters: 4,
      wallMs: 30_000,
      fetcher: opts.gatewayFetcher,
      now,
      onText: async (t) => {
        await opts.onEvent({ type: "thinking", message: t })
      },
      shouldStop: () => submitted !== null,
      executeTool: makeExecuteTool(opts, wmFetcher, () => submitted, (s) => { submitted = s }),
    })
  }

  if (!submitted) {
    if (result.stopReason === "gateway_error") {
      await opts.onEvent({ type: "error", message: result.lastError || "gateway error" })
      return { matched: 0, total, error: result.lastError || "gateway error" }
    }
    await opts.onEvent({ type: "done", message: `agent finished without submit_results (stop=${result.stopReason}, iters=${result.iterations})` })
    return { matched: 0, total }
  }

  // Merge submitted matches into the artifacts (case-insensitive trim on name).
  const matchByKey = new Map<string, ArtifactMatch>()
  for (const k of Object.keys(submitted)) {
    matchByKey.set(k.trim().toLowerCase(), submitted[k]!)
  }

  let matched = 0
  const newArtifacts = m.artifacts.map((a) => {
    const hit = matchByKey.get(a.name.trim().toLowerCase())
    if (!hit?.url) return a
    matched++
    return {
      ...a,
      image: hit.url,
      imageLicense: hit.license ?? null,
      imageAttribution: hit.attribution ?? null,
    }
  })

  if (matched === 0) {
    await opts.onEvent({ type: "done", message: `0/${total} matched` })
    return { matched: 0, total }
  }

  // Reconstruct full payload + atomic batch (museums upsert + provenance image rows).
  const payload: MuseumPayload = {
    name: m.name,
    lat: m.lat,
    lng: m.lng,
    location: m.location ?? undefined,
    level: m.level ?? undefined,
    corePeriod: m.corePeriod ?? undefined,
    specialty: m.specialty ?? undefined,
    dynastyCoverage: m.dynastyCoverage ?? undefined,
    timeline: m.timeline ?? undefined,
    treasures: m.treasures,
    halls: m.halls,
    artifacts: newArtifacts.map((a) => ({
      name: a.name,
      period: a.period ?? undefined,
      description: a.description ?? undefined,
      image: a.image ?? undefined,
      imageLicense: a.imageLicense ?? undefined,
      imageAttribution: a.imageAttribution ?? undefined,
    })),
    dynastyConnections: m.dynastyConnections.map((c) => ({
      dynasty: c.dynasty,
      description: c.description ?? undefined,
    })),
    sources: m.sources,
  }

  // Existing provenance rows must be preserved; add per-image rows on top.
  const existing = await provRepo.listFor(opts.museumId)
  const ts = now()
  const merged = existing.filter((r) => !r.field_path.endsWith(".image"))
  newArtifacts.forEach((a, i) => {
    if (!a.image) return
    const hit = matchByKey.get(a.name.trim().toLowerCase())!
    let sourceUrl: string
    if (hit.source && /^https?:\/\//.test(hit.source)) {
      sourceUrl = hit.source
    } else if (hit.qid) {
      sourceUrl = `https://www.wikidata.org/wiki/${hit.qid}`
    } else {
      sourceUrl = a.image
    }
    merged.push({
      museum_id: opts.museumId,
      field_path: `artifacts[${i}].image`,
      source_url: sourceUrl,
      authority: "encyclopedia",
      recorded_at: ts,
    })
  })

  const stmts = museums.buildUpsertStatements(opts.museumId, payload)
  stmts.push(
    ...provRepo.buildReplaceStatements(
      opts.museumId,
      merged.map((r) => ({
        field_path: r.field_path,
        source_url: r.source_url,
        authority: r.authority,
        recorded_at: r.recorded_at,
      })),
    ),
  )
  await opts.db.batch(stmts)

  await opts.onEvent({ type: "done", message: `✅ ${matched}/${total} matched` })
  return { matched, total }
}
