import { MuseumsPendingRepo } from "~/repo/museums-pending"
import { runToolLoop } from "./agent-loop"
import {
  MUSEUM_PAYLOAD_SCHEMA,
  validateMuseumPayload,
  mergeFragmentWithProvenance,
  type MuseumPayload,
  type Provenance,
} from "./import-schema"
import { runExtractor, type ExtractorResult } from "./extractor"

export const ORCHESTRATOR_MODEL = "claude-sonnet-4-6"
export const ORCHESTRATOR_MAX_TOKENS = 4096
export const ORCHESTRATOR_MAX_ITERS = 8
export const ORCHESTRATOR_WALL_MS = 90_000
export const MAX_EXTRACTORS_PER_DISPATCH = 4

// Re-export for callers/tests
export { validateMuseumPayload }

export interface ImportEvent {
  type: "thinking" | "tool" | "tool_result" | "saved" | "done" | "error"
  message: string
  data?: unknown
}

export interface ImportOpts {
  db: D1Database
  query: string
  gatewayUrl: string
  gatewayKey: string
  onEvent: (e: ImportEvent) => void | Promise<void>
  fetcher?: typeof fetch
  now?: () => number
  idGen?: () => string
  /** Override extractor (for tests). Defaults to runExtractor. */
  runExtractor?: typeof runExtractor
}

const SYSTEM = `你是一名中国历史与博物馆研究主管。用户给你一个博物馆名称或描述，你的任务是产出一份基于**官方权威信源**的高质量结构化记录。

🛑 信源原则（最高优先级，违反将被拒绝）：
- **宁缺毋滥**：所有字段必须能追溯到官方/权威信源。没有可靠信源宁可省略，绝不编造。
- **官方信源白名单**（按权威性排序）：
  1. 博物馆官方网站（官网域名 / .org / .org.cn / 馆名拼音域名）
  2. 政府机构（.gov.cn、文物局、文化和旅游局）
  3. 中国博物馆协会（museumschina.cn）/ 国家文物局
  4. 百度百科 / 维基百科（仅作为补充交叉验证）
- **禁止**使用：博客、自媒体、旅游攻略 UGC（马蜂窝/小红书等）、商业 OTA（携程/去哪儿）作为唯一信源。
- 至少 **1 个**信源必须来自第 1 或第 2 类（官网或政府）。否则放弃保存，并解释原因。

工作流程：
1. 用 web_search 搜索 1-2 次，重点找官方网站和政府/协会页面，凑齐 2-4 个权威 URL。
2. 调用 dispatch_extractors 一次性派发并行抽取。
3. 综合片段，调用 save_museum 保存。**save_museum 只能调用一次。**
4. save_museum 的 sources 字段必须**完整列出所有用过的官方/权威 URL**；不要漏。

其他要求：
- 不要自己调用 web_fetch；抓取统一交给 dispatch_extractors。
- 经纬度使用 WGS-84 十进制度数。所有文本字段使用简体中文。
- 综合时优先采用官网说法；冲突时官方 > 政府 > 协会 > 百科。
- 如果搜不到任何官方/政府信源，**不要保存**，向用户说明"未能找到官方信源"。`

function buildTools(): any[] {
  return [
    {
      name: "web_search",
      description: "搜索网络，返回链接列表。",
      input_schema: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
    },
    {
      name: "dispatch_extractors",
      description:
        "把一组 URL 派发给并行抽取员。每个抽取员独立抓取一个 URL 并返回 JSON 片段。最多 4 个 URL。",
      input_schema: {
        type: "object",
        required: ["urls"],
        properties: {
          urls: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: MAX_EXTRACTORS_PER_DISPATCH,
          },
        },
      },
    },
    {
      name: "save_museum",
      description: "保存最终的结构化博物馆数据。本次请求只能调用一次。",
      input_schema: MUSEUM_PAYLOAD_SCHEMA,
    },
  ]
}

export async function runImportAgent(opts: ImportOpts): Promise<{ savedId: string | null }> {
  const fetcher = opts.fetcher ?? fetch
  const now = opts.now ?? Date.now
  const idGen = opts.idGen ?? (() => crypto.randomUUID())
  const extractorImpl = opts.runExtractor ?? runExtractor
  const repo = new MuseumsPendingRepo(opts.db)
  let savedId: string | null = null
  let mergedFragments: Partial<MuseumPayload> = {}
  let mergedProv: Provenance = {}

  const messages: any[] = [{ role: "user", content: `请导入博物馆：${opts.query}` }]

  const result = await runToolLoop({
    gatewayUrl: opts.gatewayUrl,
    gatewayKey: opts.gatewayKey,
    model: ORCHESTRATOR_MODEL,
    maxTokens: ORCHESTRATOR_MAX_TOKENS,
    system: SYSTEM,
    tools: buildTools(),
    messages,
    maxIters: ORCHESTRATOR_MAX_ITERS,
    wallMs: ORCHESTRATOR_WALL_MS,
    fetcher,
    now,
    onText: async (t) => {
      await opts.onEvent({ type: "thinking", message: t })
    },
    shouldStop: () => savedId !== null,
    executeTool: async (call) => {
      if (call.name === "web_search") {
        await opts.onEvent({ type: "tool", message: `🔍 搜索: ${call.input?.query || ""}` })
        return {
          tool_use_id: call.id,
          content: "[gateway should have intercepted web_search; no results available]",
          is_error: true,
        }
      }

      if (call.name === "dispatch_extractors") {
        const rawUrls: any[] = Array.isArray(call.input?.urls) ? call.input.urls : []
        const urls = dedupeHttps(rawUrls).slice(0, MAX_EXTRACTORS_PER_DISPATCH)
        if (urls.length === 0) {
          return { tool_use_id: call.id, content: "no valid https urls provided", is_error: true }
        }
        if (rawUrls.length > MAX_EXTRACTORS_PER_DISPATCH) {
          await opts.onEvent({
            type: "tool_result",
            message: `⚠️ 只取前 ${MAX_EXTRACTORS_PER_DISPATCH} 个 URL`,
          })
        }
        await opts.onEvent({ type: "tool", message: `📚 抽取 ${urls.length} 个来源…` })

        const settled = await Promise.all(
          urls.map((u) =>
            extractorImpl({
              url: u,
              query: opts.query,
              gatewayUrl: opts.gatewayUrl,
              gatewayKey: opts.gatewayKey,
              fetcher,
              now,
            }).catch((e: any): ExtractorResult => ({ url: u, fragment: { sources: [u] }, error: e?.message || "extractor crashed" })),
          ),
        )

        for (const r of settled) {
          if (r.error) {
            await opts.onEvent({ type: "tool_result", message: `⚠️ ${r.url} — ${r.error}` })
          } else {
            const merged = mergeFragmentWithProvenance(
              { payload: mergedFragments, provenance: mergedProv },
              r.fragment,
              r.url,
            )
            mergedFragments = merged.payload
            mergedProv = merged.provenance
            await opts.onEvent({ type: "tool_result", message: `✅ ${r.url}` })
          }
        }

        return {
          tool_use_id: call.id,
          content: JSON.stringify({
            fragments: settled.map((r) => ({ url: r.url, fragment: r.fragment, error: r.error })),
            merged_preview: mergedFragments,
          }),
        }
      }

      if (call.name === "save_museum") {
        if (savedId) {
          return { tool_use_id: call.id, content: "already saved in this session", is_error: true }
        }
        const v = validateMuseumPayload(call.input)
        if (!v.ok) {
          await opts.onEvent({ type: "tool_result", message: `❌ save_museum 校验失败: ${v.error}` })
          return { tool_use_id: call.id, content: `validation_error: ${v.error}`, is_error: true }
        }
        const id = idGen()
        await repo.insert({ id, query: opts.query, payload: v.value, provenance: mergedProv, createdAt: now() })
        savedId = id
        await opts.onEvent({ type: "saved", message: `💾 已暂存: ${v.value.name}`, data: { id } })
        return { tool_use_id: call.id, content: JSON.stringify({ ok: true, id }) }
      }

      return { tool_use_id: call.id, content: `unknown tool: ${call.name}`, is_error: true }
    },
  })

  if (result.stopReason === "gateway_error") {
    await opts.onEvent({ type: "error", message: result.lastError || "网关错误" })
  } else if (result.stopReason === "wall") {
    await opts.onEvent({ type: "error", message: "超时" })
  } else if (result.stopReason === "max_iters" && !savedId) {
    await opts.onEvent({ type: "error", message: "已达迭代上限但未保存" })
  } else {
    await opts.onEvent({ type: "done", message: savedId ? "已完成" : "未保存任何数据" })
  }

  return { savedId }
}

function dedupeHttps(xs: any[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of xs) {
    if (typeof x !== "string") continue
    if (!/^https?:\/\//.test(x)) continue
    if (seen.has(x)) continue
    seen.add(x)
    out.push(x)
  }
  return out
}
