import { Elysia } from "elysia"
import type { Env } from "~/index"
import { ChatGuardError, forwardChat, runRateLimits } from "~/services/chat"
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
  try {
    const upstream = await forwardChat(body, {
      gatewayUrl: env.COPILOT_GATEWAY_URL,
      gatewayKey: env.COPILOT_GATEWAY_KEY,
    })
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
