import { bucketKey, checkAndIncrement, type KVLike } from "~/lib/rateLimit"

export const MODEL = "claude-opus-4-6"
export const MAX_TOKENS = 8192
export const MAX_MESSAGES_BYTES = 64 * 1024
export const MAX_SYSTEM_BYTES = 16 * 1024
export const MAX_MESSAGES_LEN = 12

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatRequestIn {
  system?: string
  messages: ChatMessage[]
}

export interface ChatRequestOut {
  model: string
  max_tokens: number
  stream: boolean
  system?: string
  messages: ChatMessage[]
}

export class ChatGuardError extends Error {
  constructor(message: string, public status: 400 | 413) {
    super(message)
  }
}

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length
}

export function sanitizeChatRequest(input: any): ChatRequestOut {
  if (!input || !Array.isArray(input.messages)) {
    throw new ChatGuardError("messages required", 400)
  }
  if (input.messages.length > MAX_MESSAGES_LEN) {
    throw new ChatGuardError(`too many messages (max ${MAX_MESSAGES_LEN})`, 400)
  }
  const messages: ChatMessage[] = input.messages.map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content ?? ""),
  }))
  if (byteLen(JSON.stringify(messages)) > MAX_MESSAGES_BYTES) {
    throw new ChatGuardError("messages too large", 413)
  }
  const system = typeof input.system === "string" ? input.system : undefined
  if (system && byteLen(system) > MAX_SYSTEM_BYTES) {
    throw new ChatGuardError("system too large", 413)
  }
  const stream = input.stream === true
  const out: ChatRequestOut = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    stream,
    messages,
  }
  if (system !== undefined) out.system = system
  return out
}

export interface RateLimits {
  perMin: number
  perDay: number
  globalPerDay: number
}

export type RateDeny =
  | { ok: false; reason: "ip_min" | "ip_day" | "global_day" }
  | { ok: true }

export async function runRateLimits(kv: KVLike, ip: string, limits: RateLimits, when: Date = new Date()): Promise<RateDeny> {
  const minR = await checkAndIncrement(kv, bucketKey("min", ip, when), limits.perMin, 90)
  if (!minR.ok) return { ok: false, reason: "ip_min" }
  const dayR = await checkAndIncrement(kv, bucketKey("day", ip, when), limits.perDay, 86_400 + 60)
  if (!dayR.ok) return { ok: false, reason: "ip_day" }
  const globalR = await checkAndIncrement(kv, bucketKey("global-day", null, when), limits.globalPerDay, 86_400 + 60)
  if (!globalR.ok) return { ok: false, reason: "global_day" }
  return { ok: true }
}

export interface ForwardOpts {
  gatewayUrl: string
  gatewayKey: string
  fetcher?: typeof fetch
}

export async function forwardChat(input: any, opts: ForwardOpts): Promise<Response> {
  const sanitized = sanitizeChatRequest(input)
  const f = opts.fetcher ?? fetch
  let upstream: Response
  try {
    upstream = await f(opts.gatewayUrl.replace(/\/$/, "") + "/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.gatewayKey,
        "anthropic-version": "2023-06-01",
        // Avoid intermediate gzip on SSE — keeps deltas flowing immediately.
        ...(sanitized.stream ? { "accept": "text/event-stream", "accept-encoding": "identity" } : {}),
      },
      body: JSON.stringify(sanitized),
    })
  } catch {
    return new Response(JSON.stringify({ error: "upstream_error" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })
  }
  if (upstream.status >= 400) {
    return new Response(JSON.stringify({ error: "upstream_error" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    })
  }
  if (sanitized.stream) {
    // Pass through SSE stream verbatim so the client can parse Anthropic events.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
        "content-encoding": "identity",
      },
    })
  }
  const body = await upstream.text()
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
