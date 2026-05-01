import type { MuseumPayload, Provenance } from "./import-schema"

export const REVIEW_MODEL = "claude-haiku-4-5"
export const REVIEW_MAX_TOKENS = 1024

export interface ReviewScore {
  overall: number // 0-100
  completeness: number // 0-100
  richness: number // 0-100
  sourceAuthority: number // 0-100
  verdict: "excellent" | "good" | "acceptable" | "needs_work" | "reject"
  comment: string
  missing: string[]
  officialSources: string[]
  weakSources: string[]
  /** Field labels whose source URL is "other" (weak/unknown). Empty when no provenance provided. */
  weakSourcedFields: string[]
}

const FIELD_WEIGHTS: { key: keyof MuseumPayload; w: number; label: string }[] = [
  { key: "name", w: 5, label: "name" },
  { key: "lat", w: 8, label: "lat" },
  { key: "lng", w: 8, label: "lng" },
  { key: "location", w: 8, label: "location" },
  { key: "level", w: 6, label: "level" },
  { key: "corePeriod", w: 4, label: "corePeriod" },
  { key: "specialty", w: 6, label: "specialty" },
  { key: "dynastyCoverage", w: 4, label: "dynastyCoverage" },
  { key: "timeline", w: 4, label: "timeline" },
  { key: "treasures", w: 12, label: "treasures" },
  { key: "halls", w: 8, label: "halls" },
  { key: "artifacts", w: 12, label: "artifacts" },
  { key: "dynastyConnections", w: 10, label: "dynastyConnections" },
  { key: "sources", w: 5, label: "sources" },
]

function isFilled(payload: MuseumPayload, k: keyof MuseumPayload): boolean {
  const v: any = (payload as any)[k]
  if (v == null) return false
  if (typeof v === "string") return v.trim().length > 0
  if (typeof v === "number") return Number.isFinite(v)
  if (Array.isArray(v)) return v.length > 0
  return true
}

export function classifySource(url: string): "official" | "government" | "association" | "encyclopedia" | "other" {
  const u = url.toLowerCase()
  if (u.includes(".gov.")) return "government"
  if (u.includes("museumschina.cn") || u.includes("ncha.gov.cn")) return "association"
  if (u.includes("baike.baidu.com") || u.includes("wikipedia.org") || u.includes("wikimedia.")) return "encyclopedia"
  // Heuristic for "official": .org/.org.cn or domain literally contains "museum"
  if (/\.org(\.cn)?\b/.test(u) || u.includes("museum")) return "official"
  return "other"
}

/** Cheap deterministic scoring; can be enriched by an AI comment afterwards. */
export function scorePayload(payload: MuseumPayload, provenance?: Provenance): ReviewScore {
  // completeness = weighted fill rate
  let totalW = 0
  let gotW = 0
  const missing: string[] = []
  for (const { key, w, label } of FIELD_WEIGHTS) {
    totalW += w
    if (isFilled(payload, key)) gotW += w
    else missing.push(label)
  }
  const completeness = Math.round((gotW / totalW) * 100)

  // richness = depth of array fields
  const arrayDepth = [
    Math.min(5, payload.treasures?.length ?? 0) / 5,
    Math.min(5, payload.halls?.length ?? 0) / 5,
    Math.min(5, payload.artifacts?.length ?? 0) / 5,
    Math.min(4, payload.dynastyConnections?.length ?? 0) / 4,
  ]
  const avgTextLen =
    [payload.specialty, payload.timeline, payload.dynastyCoverage]
      .filter((s): s is string => typeof s === "string")
      .reduce((a, s) => a + s.length, 0) / 3
  const textDepth = Math.min(1, avgTextLen / 80)
  const richness = Math.round(((arrayDepth.reduce((a, b) => a + b, 0) / 4) * 0.7 + textDepth * 0.3) * 100)

  // source authority
  const sources = payload.sources ?? []
  const buckets = sources.map(classifySource)
  const officialSources: string[] = []
  const weakSources: string[] = []
  for (let i = 0; i < sources.length; i++) {
    const b = buckets[i]
    if (b === "official" || b === "government" || b === "association") officialSources.push(sources[i]!)
    else if (b === "other") weakSources.push(sources[i]!)
  }
  const hasOfficialOrGov = buckets.some((b) => b === "official" || b === "government")
  let sourceAuthority = 0
  if (hasOfficialOrGov) sourceAuthority += 60
  sourceAuthority += Math.min(20, officialSources.length * 10)
  sourceAuthority += buckets.includes("association") ? 10 : 0
  sourceAuthority += buckets.includes("encyclopedia") ? 10 : 0
  sourceAuthority -= weakSources.length * 5
  sourceAuthority = Math.max(0, Math.min(100, sourceAuthority))

  const overall = Math.round(completeness * 0.35 + richness * 0.35 + sourceAuthority * 0.3)

  // Per-field provenance check: which filled fields trace back to a non-authoritative URL?
  const weakSourcedFields: string[] = []
  if (provenance) {
    const scalarKeys = ["name", "lat", "lng", "location", "level", "corePeriod", "specialty", "dynastyCoverage", "timeline"] as const
    for (const k of scalarKeys) {
      const url = (provenance as any)[k] as string | undefined
      if (url && classifySource(url) === "other") weakSourcedFields.push(k)
    }
    const arrKeys = ["treasures", "halls", "artifacts", "dynastyConnections"] as const
    for (const k of arrKeys) {
      const urls = (provenance as any)[k] as string[] | undefined
      if (Array.isArray(urls) && urls.some((u) => u && classifySource(u) === "other")) {
        weakSourcedFields.push(k)
      }
    }
  }

  let verdict: ReviewScore["verdict"]
  if (!hasOfficialOrGov) verdict = "reject"
  else if (overall >= 85) verdict = "excellent"
  else if (overall >= 70) verdict = "good"
  else if (overall >= 55) verdict = "acceptable"
  else verdict = "needs_work"

  return {
    overall,
    completeness,
    richness,
    sourceAuthority,
    verdict,
    comment: "",
    missing,
    officialSources,
    weakSources,
    weakSourcedFields,
  }
}

export interface AiCommentOpts {
  payload: MuseumPayload
  score: ReviewScore
  gatewayUrl: string
  gatewayKey: string
  fetcher?: typeof fetch
}

/** Optional: ask Haiku for a one-paragraph qualitative comment. Falls back to template on failure. */
export async function generateAiComment(opts: AiCommentOpts): Promise<string> {
  const fetcher = opts.fetcher ?? fetch
  const sys = `你是博物馆资料审核员。给出一段 2-3 句的简洁中文评价，覆盖：完整度、丰富度、信源权威性、主要缺失。直接给评价，不要客套。`
  const user = `字段评分（0-100）：完整度=${opts.score.completeness}，丰富度=${opts.score.richness}，信源=${opts.score.sourceAuthority}，综合=${opts.score.overall}，结论=${opts.score.verdict}。
缺失字段：${opts.score.missing.join("、") || "无"}
官方/政府/协会信源数：${opts.score.officialSources.length}
弱信源（非权威）：${opts.score.weakSources.length}

数据摘要：
- 名称：${opts.payload.name}
- 镇馆之宝：${opts.payload.treasures?.length ?? 0} 项
- 文物：${opts.payload.artifacts?.length ?? 0} 项
- 朝代关联：${opts.payload.dynastyConnections?.length ?? 0} 项
- 信源数量：${opts.payload.sources?.length ?? 0}`

  try {
    const res = await fetcher(opts.gatewayUrl.replace(/\/$/, "") + "/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.gatewayKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: REVIEW_MODEL,
        max_tokens: REVIEW_MAX_TOKENS,
        stream: false,
        system: sys,
        messages: [{ role: "user", content: user }],
      }),
    })
    if (!res.ok) return templateComment(opts.score)
    const j: any = await res.json()
    const text = (j?.content || []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n").trim()
    return text || templateComment(opts.score)
  } catch {
    return templateComment(opts.score)
  }
}

function templateComment(s: ReviewScore): string {
  const verdictText = {
    excellent: "数据完整、丰富，信源权威可靠。",
    good: "整体质量良好，可入正库。",
    acceptable: "基本可用，建议人工补全个别字段。",
    needs_work: "信息偏单薄，建议补充更多权威来源。",
    reject: "缺少官方/政府信源，不建议入库。",
  }[s.verdict]
  return `${verdictText} 缺失：${s.missing.join("、") || "无"}。`
}
