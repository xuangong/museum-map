import { Elysia } from "elysia"
import type { Env } from "~/index"
import { ChatGuardError, runRateLimits, sanitizeChatRequest } from "~/services/chat"
import { runToolLoop, runToolLoopStream, sourcesMarkdown, type ToolCall } from "~/services/agent-loop"
import { runLlmLoop, runLlmLoopStream } from "~/services/llm"
import { nativeProtocol, resolveAi } from "~/services/ai-models"
import { CHAT_TOOLS, CHAT_AGENT_SYSTEM, executeChatTool } from "~/services/chat-tools"
import { getClientIp } from "~/lib/getClientIp"

interface RouteContext {
  env: Env
  request: Request
  body: any
  set: any
}

/** Room for reasoning plus the answer. */
const LLM_MAX_TOKENS = 16_384

const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  "x-accel-buffering": "no",
  "content-encoding": "identity",
}

/** What the guide is doing while it looks something up, in the reader's words. */
async function toolLabel(db: D1Database, call: ToolCall): Promise<string> {
  const inp = call.input || {}
  if (call.name === "get_museum") {
    try {
      const row = await db.prepare("SELECT name FROM museums WHERE id = ?").bind(String(inp.id || "")).first<{ name: string }>()
      if (row?.name) return `正在翻阅「${row.name}」的资料`
    } catch {}
    return "正在翻阅馆藏资料"
  }
  if (call.name === "search_museums") {
    const what = [inp.location, inp.dynasty, inp.keyword].filter((x) => typeof x === "string" && x.trim()).join(" · ")
    return what ? `正在查「${what}」相关的博物馆` : "正在查博物馆目录"
  }
  return "正在查资料"
}

export const chatRoute = new Elysia().post("/api/chat", async (ctx) => {
  const { env, request, body, set } = ctx as unknown as RouteContext
  if (env.DISABLE_CHAT === "1") {
    set.status = 503
    return { error: "chat disabled in this mode, use `bun run dev` instead" }
  }
  if (env.COPILOT_GATEWAY_URL == null || env.COPILOT_GATEWAY_KEY == null) {
    set.status = 503
    return { error: "chat unavailable: gateway not configured" }
  }
  const ip = getClientIp(request)
  const limits = {
    perMin: Number(env.RATE_PER_MIN ?? "10"),
    perDay: Number(env.RATE_PER_DAY ?? "100"),
    globalPerDay: Number(env.GLOBAL_PER_DAY ?? "5000"),
  }
  const rl = await runRateLimits(env.RATE, ip, limits)
  if (!rl.ok) {
    set.status = rl.reason === "global_day" ? 503 : 429
    return { error: rl.reason }
  }

  let sanitized
  try {
    sanitized = sanitizeChatRequest({ ...body, stream: false })
  } catch (e) {
    if (e instanceof ChatGuardError) {
      set.status = e.status
      return { error: e.message }
    }
    set.status = 500
    return { error: "internal_error" }
  }
  const ai = resolveAi(body?.model, body?.effort)
  const useTools = body?.useTools !== false
  const messages: any[] = sanitized.messages.map((m) => ({ role: m.role, content: m.content }))
  const system = useTools ? CHAT_AGENT_SYSTEM + (sanitized.system ? "\n\n" + sanitized.system : "") : sanitized.system || ""
  const base = {
    gatewayUrl: env.COPILOT_GATEWAY_URL,
    gatewayKey: env.COPILOT_GATEWAY_KEY,
    model: ai.model,
    effort: ai.effort,
    maxTokens: LLM_MAX_TOKENS,
    system,
    tools: useTools ? CHAT_TOOLS : [],
    webSearch: useTools,
    messages,
    executeTool: (call: ToolCall) => executeChatTool(env.DB, call),
    maxIters: 6,
    wallMs: 45_000,
  }

  // Claude on Anthropic Messages, everything else on OpenAI chat completions.
  const native = nativeProtocol(ai.model) === "anthropic"

  if (body.stream === true) {
    const enc = new TextEncoder()
    // Anthropic-shaped events, so the existing client parser renders them; plus
    // `tool_progress` while the guide looks something up.
    // A TransformStream written from a detached task: each write leaves the Worker as
    // soon as it is made. (Enqueuing from an async ReadableStream start() let the runtime
    // hold the text and release it in one burst at the end.)
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
    const writer = writable.getWriter()
    const send = (obj: any) => writer.write(enc.encode("data: " + JSON.stringify(obj) + "\n\n")).catch(() => {})
    const text = (t: string) => send({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })
    // Not awaited: the Worker stays alive while the response body is still being written.
    void (async () => {
      try {
        const result = await (native ? runToolLoopStream : runLlmLoopStream)({
          ...base,
          onDelta: (t) => {
            text(t)
          },
          onSearch: async () => {
            await send({ type: "tool_progress", label: "正在联网搜索…" })
          },
          onTool: async (call) => {
            await send({ type: "tool_progress", label: await toolLabel(env.DB, call) })
          },
        })
        if (result.stopReason === "gateway_error" && !result.text) await send({ type: "error", error: { message: "upstream_error" } })
        else if (!result.text) await text("（无回复）")
        else if (result.sources?.length) await text(sourcesMarkdown(result.sources))
        await send({ type: "message_stop" })
      } catch {
        await send({ type: "error", error: { message: "internal_error" } })
      }
      await writer.close().catch(() => {})
    })()
    return new Response(readable, { status: 200, headers: SSE_HEADERS })
  }

  try {
    const result = await (native ? runToolLoop : runLlmLoop)(base)
    if (result.stopReason === "gateway_error") {
      set.status = 502
      return { error: "upstream_error", detail: result.lastError }
    }
    // Anthropic-style envelope so the existing client renders the text.
    const src = result.text && result.sources ? sourcesMarkdown(result.sources) : ""
    return {
      content: [{ type: "text", text: (result.text || "（无回复）") + src }],
      stop_reason: result.stopReason,
      iterations: result.iterations,
    }
  } catch {
    set.status = 500
    return { error: "internal_error" }
  }
})
