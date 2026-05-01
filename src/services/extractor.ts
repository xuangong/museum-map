import { runToolLoop } from "./agent-loop"
import { MUSEUM_FRAGMENT_SCHEMA, type MuseumPayload } from "./import-schema"

export const EXTRACTOR_MODEL = "claude-haiku-4-5"
export const EXTRACTOR_MAX_TOKENS = 2048
export const EXTRACTOR_MAX_ITERS = 3
export const EXTRACTOR_WALL_MS = 20_000
export const FETCH_TIMEOUT_MS = 10_000
export const FETCH_MAX_BYTES = 200 * 1024

const SYSTEM = `你是博物馆资料抽取员。

工作流程（严格遵守，违反将导致失败）：
1. 调用一次 web_fetch 抓取给定 URL。
2. 立即调用 submit_fragment 提交结果。**这一步是强制的，不能省略。**

🛑 信源原则（最高优先级）：
- **宁缺毋滥**：所有字段必须直接来自抓取到的页面文本。**绝不**用你自己的世界知识补全。
- 页面里没有的字段必须省略；页面内容残缺/404/不相关时，submit_fragment 可以只填 sources。
- 不允许"推测"、"应该是"、"通常情况下"——只接受页面明确陈述的事实。

绝对规则：
- **禁止**用自然语言文字回复用户。所有产出必须通过 submit_fragment 工具调用。
- 经纬度使用 WGS-84 十进制度数，仅在页面明确给出时填写。
- 文本字段使用简体中文。
- sources 字段会自动加入本次 URL，无需手动填写。`

const TOOLS = [
  {
    name: "web_fetch",
    description: "抓取给定 URL 的正文（最多 200KB），只能调用一次。",
    input_schema: {
      type: "object",
      required: ["url"],
      properties: { url: { type: "string" } },
    },
  },
  {
    name: "submit_fragment",
    description: "提交抽取到的字段。调用后 extractor 结束。",
    input_schema: MUSEUM_FRAGMENT_SCHEMA,
  },
]

export interface ExtractorOpts {
  url: string
  query: string
  gatewayUrl: string
  gatewayKey: string
  fetcher?: typeof fetch
  now?: () => number
}

export interface ExtractorResult {
  url: string
  fragment: Partial<MuseumPayload>
  error?: string
}

export async function runExtractor(opts: ExtractorOpts): Promise<ExtractorResult> {
  const fetcher = opts.fetcher ?? fetch
  let fragment: Partial<MuseumPayload> | null = null
  let fetched = false

  const messages: any[] = [
    {
      role: "user",
      content: `目标博物馆：${opts.query}\n请用 web_fetch 抓取下面这个 URL，然后调用 submit_fragment 提交字段：\n${opts.url}`,
    },
  ]

  const result = await runToolLoop({
    gatewayUrl: opts.gatewayUrl,
    gatewayKey: opts.gatewayKey,
    model: EXTRACTOR_MODEL,
    maxTokens: EXTRACTOR_MAX_TOKENS,
    system: SYSTEM,
    tools: TOOLS,
    messages,
    maxIters: EXTRACTOR_MAX_ITERS,
    wallMs: EXTRACTOR_WALL_MS,
    fetcher,
    now: opts.now,
    shouldStop: () => fragment !== null,
    executeTool: async (call) => {
      if (call.name === "web_fetch") {
        if (fetched) {
          return { tool_use_id: call.id, content: "web_fetch already used; call submit_fragment now", is_error: true }
        }
        fetched = true
        const url = String(call.input?.url || "")
        if (!/^https?:\/\//.test(url)) {
          return { tool_use_id: call.id, content: "invalid url", is_error: true }
        }
        const text = await fetchUrlText(url, fetcher)
        return { tool_use_id: call.id, content: text }
      }
      if (call.name === "submit_fragment") {
        const input = call.input || {}
        // sanitize: drop required-but-missing scalars; ensure source URL recorded
        const sources = Array.isArray(input.sources) ? input.sources.filter((s: any) => typeof s === "string") : []
        if (!sources.includes(opts.url)) sources.push(opts.url)
        const cleaned: Partial<MuseumPayload> = { ...input, sources }
        if (typeof cleaned.lat !== "number" || !Number.isFinite(cleaned.lat)) delete cleaned.lat
        if (typeof cleaned.lng !== "number" || !Number.isFinite(cleaned.lng)) delete cleaned.lng
        fragment = cleaned
        return { tool_use_id: call.id, content: JSON.stringify({ ok: true }) }
      }
      return { tool_use_id: call.id, content: `unknown tool: ${call.name}`, is_error: true }
    },
  })

  // Retry: if model fetched but didn't submit, push an explicit reminder and let it try once more.
  if (!fragment && fetched && (result.stopReason === "end_turn" || result.stopReason === "no_tool")) {
    messages.push({
      role: "user",
      content:
        "你忘记调用 submit_fragment 了。请立即调用 submit_fragment 提交从上一步抓取到的信息。如果信息不足，至少调用 submit_fragment（可仅含 sources）。不要用文字回答。",
    })
    await runToolLoop({
      gatewayUrl: opts.gatewayUrl,
      gatewayKey: opts.gatewayKey,
      model: EXTRACTOR_MODEL,
      maxTokens: EXTRACTOR_MAX_TOKENS,
      system: SYSTEM,
      tools: TOOLS,
      messages,
      maxIters: 2,
      wallMs: 10_000,
      fetcher,
      now: opts.now,
      shouldStop: () => fragment !== null,
      executeTool: async (call) => {
        if (call.name === "submit_fragment") {
          const input = call.input || {}
          const sources = Array.isArray(input.sources) ? input.sources.filter((s: any) => typeof s === "string") : []
          if (!sources.includes(opts.url)) sources.push(opts.url)
          const cleaned: Partial<MuseumPayload> = { ...input, sources }
          if (typeof cleaned.lat !== "number" || !Number.isFinite(cleaned.lat)) delete cleaned.lat
          if (typeof cleaned.lng !== "number" || !Number.isFinite(cleaned.lng)) delete cleaned.lng
          fragment = cleaned
          return { tool_use_id: call.id, content: JSON.stringify({ ok: true }) }
        }
        return { tool_use_id: call.id, content: "only submit_fragment allowed now", is_error: true }
      },
    })
  }

  if (fragment) return { url: opts.url, fragment }
  return {
    url: opts.url,
    fragment: { sources: [opts.url] },
    error: result.lastError || `no fragment (${result.stopReason})`,
  }
}

async function fetchUrlText(url: string, fetcher: typeof fetch): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetcher(url, { signal: controller.signal, redirect: "follow" })
    if (!res.ok) return `HTTP ${res.status}`
    const reader = res.body?.getReader()
    if (!reader) return (await res.text()).slice(0, FETCH_MAX_BYTES)
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      chunks.push(value)
      if (total >= FETCH_MAX_BYTES) {
        controller.abort()
        break
      }
    }
    const merged = new Uint8Array(total)
    let off = 0
    for (const c of chunks) {
      merged.set(c, off)
      off += c.byteLength
    }
    return stripHtml(new TextDecoder("utf-8", { fatal: false }).decode(merged)).slice(0, FETCH_MAX_BYTES)
  } catch (e: any) {
    return `fetch_error: ${e?.message || "unknown"}`
  } finally {
    clearTimeout(timer)
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
