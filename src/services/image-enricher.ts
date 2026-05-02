import { runToolLoop } from "./agent-loop"
import { searchWikidataEntity, fetchWikidataImage } from "./wikimedia"
import { MuseumsRepo } from "~/repo/museums"
import { FieldProvenanceRepo } from "~/repo/field-provenance"
import type { MuseumPayload } from "./import-schema"

export const ENRICHER_MODEL = "claude-haiku-4-5"
export const ENRICHER_MAX_TOKENS = 2048
export const ENRICHER_MAX_ITERS = 12
export const ENRICHER_WALL_MS = 60_000

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
  qid?: string
  url?: string
  license?: string | null
  attribution?: string | null
}

const SYSTEM = `你是一名艺术品图片采编员。给定一个博物馆的代表文物列表，你要为每件文物从 Wikidata + Wikimedia Commons 找一张可用的图片。

工作流程：
1. 对每件文物，先用 wikidata_search 在中文 Wikidata 搜索；从候选中挑出最匹配该文物（注意区分文物本身 vs 同名博物馆/电影/人物等）。
2. 选定一个 QID 后，调用 wikidata_image 获取图片 URL + 许可证 + 作者。
3. 如果搜索没有合理候选，或目标实体没有 P18 图片，**跳过该文物**，绝不编造。
4. 全部处理完后，调用一次 submit_results 提交结果。

submit_results.matches 是一个对象：键是文物名（与输入完全一致），值是 { qid, url, license, attribution }。只列入找到图片的文物，未找到的不要列出。

最多 12 轮工具调用。`

function buildTools(): any[] {
  return [
    {
      name: "wikidata_search",
      description: "在 Wikidata 用中文搜索实体。返回最匹配的 QID + 标签 + 描述。",
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
              properties: {
                qid: { type: "string" },
                url: { type: "string" },
                license: { type: "string" },
                attribution: { type: "string" },
              },
            },
          },
        },
      },
    },
  ]
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
    `博物馆：${m.name}\n请为以下文物逐一查找 Wikimedia Commons 图片：\n` +
    m.artifacts
      .map((a, i) => `${i + 1}. ${a.name}${a.period ? ` (${a.period})` : ""}`)
      .join("\n")
  const messages: any[] = [{ role: "user", content: userMsg }]

  let submitted: Record<string, ArtifactMatch> | null = null

  const result = await runToolLoop({
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
    executeTool: async (call) => {
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
        if (submitted) return { tool_use_id: call.id, content: "already submitted", is_error: true }
        const matches = call.input?.matches
        if (!matches || typeof matches !== "object") {
          return { tool_use_id: call.id, content: "matches must be an object", is_error: true }
        }
        submitted = matches as Record<string, ArtifactMatch>
        return { tool_use_id: call.id, content: JSON.stringify({ ok: true, count: Object.keys(submitted).length }) }
      }
      return { tool_use_id: call.id, content: `unknown tool: ${call.name}`, is_error: true }
    },
  })

  if (!submitted) {
    if (result.stopReason === "gateway_error") {
      await opts.onEvent({ type: "error", message: result.lastError || "gateway error" })
      return { matched: 0, total, error: result.lastError || "gateway error" }
    }
    await opts.onEvent({ type: "done", message: "agent finished with no matches" })
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
    const sourceUrl = hit.qid ? `https://www.wikidata.org/wiki/${hit.qid}` : a.image
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
