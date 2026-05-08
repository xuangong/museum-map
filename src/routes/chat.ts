import { Elysia } from "elysia"
import type { Env } from "~/index"
import { ChatGuardError, forwardChat, runRateLimits, sanitizeChatRequest, MODEL, MAX_TOKENS } from "~/services/chat"
import { runToolLoop } from "~/services/agent-loop"
import { CHAT_TOOLS, CHAT_AGENT_SYSTEM, executeChatTool } from "~/services/chat-tools"
import { getClientIp } from "~/lib/getClientIp"

interface RouteContext {
  env: Env
  request: Request
  body: any
  set: any
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

  // Tool-augmented path: AI can query our DB before answering.
  if (body && body.useTools !== false) {
    try {
      const sanitized = sanitizeChatRequest({ ...body, stream: false })
      const messages = sanitized.messages.map((m) => ({ role: m.role, content: m.content }))
      const result = await runToolLoop({
        gatewayUrl: env.COPILOT_GATEWAY_URL,
        gatewayKey: env.COPILOT_GATEWAY_KEY,
        model: MODEL,
        maxTokens: MAX_TOKENS,
        system: CHAT_AGENT_SYSTEM + (sanitized.system ? "\n\n" + sanitized.system : ""),
        tools: CHAT_TOOLS as any,
        messages,
        executeTool: (call) => executeChatTool(env.DB, call),
        maxIters: 6,
        wallMs: 45_000,
      })
      if (result.stopReason === "gateway_error") {
        set.status = 502
        return { error: "upstream_error", detail: result.lastError }
      }
      // Return Anthropic-style envelope so the existing client renders the text.
      return {
        content: [{ type: "text", text: result.text || "（无回复）" }],
        stop_reason: result.stopReason,
        iterations: result.iterations,
      }
    } catch (e) {
      if (e instanceof ChatGuardError) {
        set.status = e.status
        return { error: e.message }
      }
      set.status = 500
      return { error: "internal_error" }
    }
  }

  try {
    const upstream = await forwardChat(body, {
      gatewayUrl: env.COPILOT_GATEWAY_URL,
      gatewayKey: env.COPILOT_GATEWAY_KEY,
    })
    // Stream responses (SSE) must be returned as Response so Elysia doesn't buffer/JSON-parse.
    const ct = upstream.headers.get("content-type") || ""
    if (ct.startsWith("text/event-stream")) {
      return upstream
    }
    set.status = upstream.status
    return await upstream.json()
  } catch (e) {
    if (e instanceof ChatGuardError) {
      set.status = e.status
      return { error: e.message }
    }
    set.status = 500
    return { error: "internal_error" }
  }
})
