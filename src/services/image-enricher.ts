import { runToolLoop } from "./agent-loop"
import { searchWikidataEntity, fetchWikidataImage, searchCommonsFile } from "./wikimedia"
import { MuseumsRepo } from "~/repo/museums"
import { FieldProvenanceRepo } from "~/repo/field-provenance"
import type { MuseumPayload } from "./import-schema"

export const ENRICHER_MODEL = "claude-haiku-4-5"
export const ENRICHER_MAX_TOKENS = 2048
export const ENRICHER_MAX_ITERS = 24
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

const SYSTEM = `你是一名艺术品图片采编员。系统已为每件文物在 Wikimedia 预查到 0–3 个候选图片，你的工作是逐一判断接受哪一个，或全部跳过。

工作流程：
1. 用户消息会列出每件文物以及预查候选（标注 A/B/C 及来源 commons_search / wikidata_image）。
2. 你**优先在候选里挑选**。若候选齐全且有可接受的，按规则选择并照抄四个字段即可。
3. **当某文物预查候选为空（"无候选"）时**，主动发起 **1-2 次** 工具调用补搜：
   - 先 commons_search（用文物名 + 馆名/年代/材质等关键词重组查询，比如 "金沙遗址 太阳神鸟"、"清代瓷瓶 西湖"）；
   - 若 commons_search 无果，可再 wikidata_search → wikidata_image。
   - 若仍无果，**跳过该文物**。
4. 全部判完后**必须**调用一次 submit_results。即使 matches 为空 ({}) 也要提交。

**质量底线**（违反任意一条 → 跳过该文物，不要列入 matches）：
- 不接受 \`.djvu / .pdf / 古籍 / 詩集 / 文獻 / 縣誌\` 类古籍数字化文件。
- **接受规则**（满足任意一条即可）：
  (a) Commons 文件标题**完整包含文物中文名**（如 "File:绿松石龙形器.jpg"），明确指代该件文物；
  (b) 文件标题包含本馆名/所在地/同一遗址（如 "二里头出土..."、"故宫博物院藏..."）；
  (c) 文物本身就是举世闻名的孤品（"四羊方尊"、"越王勾践剑"、"司母戊鼎"、"曾侯乙编钟"、"史墙盘"、"长信宫灯" 等），并且文件标题至少含文物核心名（中文或对应英文，如 "Shi Qiang pan"）；
  (d) **来源是 wikidata_image**（即 Wikidata 实体的 P18 主图）——这通常是该文物的官方代表图，可以接受。
- **拒绝规则**：
  - 文物名包含具体的纹饰/形制（如 "乳钉纹青铜爵"），但文件只是泛泛 "青铜爵"——纹饰是辨识依据，缺失就算泛化匹配，跳过。
  - 类型相同但具体形制不同（如 "龙形牙璋" vs "玉璋"），跳过。
  - 同一时代/类型但不同地域、不同出土地，跳过。
- 宁可少匹配，也不要错匹配。

submit_results.matches 是一个对象：键是文物名（与输入完全一致），值是 { url, license, attribution, source }——直接从你选中的候选**原样照抄** url/license/attribution/source 四个字段即可。

只列入接受的文物，未接受的不要列出。最多 12 轮工具调用。`

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
  recordCandidate: (query: string, hit: { url: string; license: string | null; attribution: string | null; source: string }) => void,
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
        if (hit) {
          recordCandidate(q, {
            url: hit.url,
            license: hit.license,
            attribution: hit.attribution,
            source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(hit.title)}`,
          })
        }
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
        if (img) {
          recordCandidate(qid, {
            url: img.url,
            license: img.license,
            attribution: img.attribution,
            source: `https://www.wikidata.org/wiki/${qid}`,
          })
        }
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
  // Only ask the LLM about artifacts without an existing image (backfill).
  const pending = m.artifacts.filter((a) => !a.image)
  if (pending.length === 0) {
    await opts.onEvent({ type: "done", message: `0/${total} matched (all already have images)` })
    return { matched: 0, total: 0 }
  }

  // ── Server-side prefetch: for each pending artifact, run two independent
  //    candidate hunts in parallel (commons-zh + wikidata-zh→P18 + commons-en).
  //    The agent then only judges/disambiguates instead of issuing tool calls.
  await opts.onEvent({ type: "thinking", message: `预查 ${pending.length} 件文物的候选图…` })
  type Cand = { label: string; url: string; license: string | null; attribution: string | null; source: string; via: string }
  async function huntOne(name: string, period: string | null | undefined): Promise<Cand[]> {
    const out: Cand[] = []
    const seen = new Set<string>()
    const push = (c: Cand) => {
      if (seen.has(c.url)) return
      seen.add(c.url)
      out.push(c)
    }
    const queries = [name, period ? `${name} ${period}` : null].filter(Boolean) as string[]
    // Path 1: commons in chinese.
    const cTasks = queries.map((q) =>
      searchCommonsFile({ query: q, fetcher: wmFetcher })
        .then((hit) => {
          if (hit) {
            push({
              label: `commons-zh "${q}"`,
              url: hit.url,
              license: hit.license,
              attribution: hit.attribution,
              source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(hit.title)}`,
              via: "commons_search",
            })
          }
        })
        .catch(() => {}),
    )
    // Path 2: wikidata-zh → P18 → commons (uses english label too).
    const wTask = searchWikidataEntity({ query: name, fetcher: wmFetcher })
      .then(async (ent) => {
        if (!ent) return
        const img = await fetchWikidataImage({ qid: ent.qid, fetcher: wmFetcher }).catch(() => null)
        if (img) {
          push({
            label: `wikidata ${ent.qid} (${ent.label})`,
            url: img.url,
            license: img.license,
            attribution: img.attribution,
            source: `https://www.wikidata.org/wiki/${ent.qid}`,
            via: "wikidata_image",
          })
        }
        // Path 3: english label → commons (catches files like "Shi Qiang pan.jpg")
        if (ent.label && /[a-zA-Z]/.test(ent.label) && ent.label.toLowerCase() !== name.toLowerCase()) {
          const enHit = await searchCommonsFile({ query: ent.label, fetcher: wmFetcher }).catch(() => null)
          if (enHit) {
            push({
              label: `commons-en "${ent.label}"`,
              url: enHit.url,
              license: enHit.license,
              attribution: enHit.attribution,
              source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(enHit.title)}`,
              via: "commons_search",
            })
          }
        }
      })
      .catch(() => {})
    await Promise.all([...cTasks, wTask])
    return out
  }
  // Cap concurrency so wikidata doesn't 429 us.
  const CONCURRENCY = 4
  const candByName = new Map<string, Cand[]>()
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const slice = pending.slice(i, i + CONCURRENCY)
    const results = await Promise.all(slice.map((a) => huntOne(a.name, a.period)))
    slice.forEach((a, idx) => {
      candByName.set(a.name, results[idx]!)
    })
  }
  const totalCands = Array.from(candByName.values()).reduce((s, cs) => s + cs.length, 0)
  await opts.onEvent({ type: "thinking", message: `预查完成：${totalCands} 个候选 / ${pending.length} 件文物` })

  // Render candidates inline so the agent can judge without extra tool calls.
  const renderCands = (cs: Cand[]): string => {
    if (!cs.length) return "  （无候选——除非文物极有名，否则跳过）"
    return cs
      .map((c, i) => {
        const tag = String.fromCharCode(65 + i) // A/B/C
        return `  ${tag}. [${c.via}] ${c.label}\n     url: ${c.url}\n     source: ${c.source}\n     license: ${c.license || "?"} · attribution: ${c.attribution || "?"}`
      })
      .join("\n")
  }

  const userMsg =
    `当前博物馆：**${m.name}**\n下面每件文物已预查到候选图，请按 SYSTEM 中的接受/拒绝规则严格判断，挑出可接受的候选并调用 submit_results。直接照抄候选的 url/license/attribution/source 四个字段。\n\n` +
    pending
      .map((a, i) => {
        const cs = candByName.get(a.name) || []
        return `${i + 1}. **${a.name}**${a.period ? ` (${a.period})` : ""}\n${renderCands(cs)}`
      })
      .join("\n\n")
  const messages: any[] = [{ role: "user", content: userMsg }]

  let submitted: Record<string, ArtifactMatch> | null = null
  let nudged = false

  /** Server-side candidate tracker: every successful tool hit, keyed by query string.
   *  Used as a safety-net fallback when the agent submits an empty {} despite having
   *  successful tool_results — a known Haiku failure mode. */
  const candidates: { query: string; hit: { url: string; license: string | null; attribution: string | null; source: string } }[] = []
  // Seed candidates from prefetch so the existing fallback recovery path can use them.
  for (const [name, cs] of candByName.entries()) {
    for (const c of cs) {
      candidates.push({ query: name, hit: { url: c.url, license: c.license, attribution: c.attribution, source: c.source } })
    }
  }
  const recordCandidate = (query: string, hit: { url: string; license: string | null; attribution: string | null; source: string }) => {
    candidates.push({ query, hit })
  }

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
    executeTool: makeExecuteTool(opts, wmFetcher, () => submitted, (s) => { submitted = s }, recordCandidate),
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
      executeTool: makeExecuteTool(opts, wmFetcher, () => submitted, (s) => { submitted = s }, recordCandidate),
    })
  }

  // Safety net: agent submitted empty {} despite having successful tool hits.
  // Reconcile by matching artifact names against query strings (substring, case-insensitive).
  if (submitted && Object.keys(submitted).length === 0 && candidates.length > 0) {
    const recovered: Record<string, ArtifactMatch> = {}
    for (const a of m.artifacts) {
      const aname = a.name.trim()
      const akey = aname.toLowerCase()
      // Find first candidate whose query contains the artifact name (or vice versa).
      const c = candidates.find((c) => {
        const q = c.query.toLowerCase()
        return q.indexOf(akey) >= 0 || akey.indexOf(q) >= 0
      })
      if (c) {
        recovered[aname] = {
          url: c.hit.url,
          license: c.hit.license ?? null,
          attribution: c.hit.attribution ?? null,
          source: c.hit.source,
        }
      }
    }
    if (Object.keys(recovered).length > 0) {
      await opts.onEvent({
        type: "thinking",
        message: `(server fallback: agent submitted empty, recovered ${Object.keys(recovered).length} match(es) from tool history)`,
      })
      submitted = recovered
    }
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
    // Never overwrite an existing image — backfill mode only.
    if (a.image) return a
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
    await opts.onEvent({ type: "done", message: `0/${pending.length} matched` })
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

  // Existing provenance rows must be preserved; only drop image rows whose
  // artifact we just re-enriched in this run.
  const existing = await provRepo.listFor(opts.museumId)
  const ts = now()
  // Compute which artifact indexes got fresh hits this run.
  const refreshedIdx = new Set<number>()
  newArtifacts.forEach((a, i) => {
    if (!a.image) return
    const hit = matchByKey.get(a.name.trim().toLowerCase())
    if (hit) refreshedIdx.add(i)
  })
  const merged = existing.filter((r) => {
    const m = r.field_path.match(/^artifacts\[(\d+)\]\.image$/)
    if (!m) return true
    return !refreshedIdx.has(Number(m[1]))
  })
  newArtifacts.forEach((a, i) => {
    if (!a.image) return
    const hit = matchByKey.get(a.name.trim().toLowerCase())
    // Only write provenance for artifacts we just enriched in this run.
    // Pre-existing images keep whatever provenance row already exists.
    if (!hit) return
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

  await opts.onEvent({ type: "done", message: `✅ ${matched}/${pending.length} matched` })
  return { matched, total }
}
