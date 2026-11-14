import { sseEvents, type ToolCall, type ToolResult } from "~/services/agent-loop"

/** The gateway in OpenAI chat-completions format — what the AI guide runs on. */

export const LLM_USER_AGENT = "museum-map/1.0 (+https://museum.xianliao.de5.net; ai-guide)"

export interface LlmLoopOpts {
  gatewayUrl: string
  gatewayKey: string
  model: string
  effort?: string
  maxTokens: number
  system: string
  /** Anthropic-style tool schemas ({ name, description, input_schema }); converted here. */
  tools: readonly any[]
  /** Plain { role, content } turns; the loop appends to this array. */
  messages: any[]
  executeTool: (call: ToolCall) => Promise<ToolResult>
  /** Streaming variant only: each piece of assistant text as it arrives. */
  onDelta?: (text: string) => void | Promise<void>
  onTool?: (call: ToolCall) => void | Promise<void>
  maxIters?: number
  wallMs?: number
  fetcher?: typeof fetch
  now?: () => number
}

export interface LlmLoopResult {
  iterations: number
  stopReason: "end_turn" | "max_iters" | "wall" | "gateway_error" | "no_tool"
  lastError?: string
  text: string
}

export function toOpenAiTools(tools: readonly any[]): any[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema ?? { type: "object", properties: {} } },
  }))
}

interface Turn {
  text: string
  calls: { id: string; name: string; args: string }[]
  finish: string
}

class TurnError extends Error {
  /** true when it is safe to ask again: nothing from this turn has been shown yet. */
  constructor(message: string, public retryable: boolean) {
    super(message)
  }
}

function parseArgs(s: string): any {
  try {
    return s ? JSON.parse(s) : {}
  } catch {
    return {}
  }
}

async function runLoop(opts: LlmLoopOpts, stream: boolean): Promise<LlmLoopResult> {
  const fetcher = opts.fetcher ?? fetch
  const now = opts.now ?? Date.now
  const maxIters = opts.maxIters ?? 8
  const wallMs = opts.wallMs ?? 60_000
  const startedAt = now()
  const url = opts.gatewayUrl.replace(/\/$/, "") + "/v1/chat/completions"
  const tools = toOpenAiTools(opts.tools)
  const history: any[] = [{ role: "system", content: opts.system }, ...opts.messages]
  let collected = ""

  const attempt = async (): Promise<Turn> => {
    // A text turn after an earlier one starts on a new paragraph.
    let started = false
    let emitted = false
    const emit = async (t: string) => {
      if (!t) return
      if (!started) {
        started = true
        if (collected) {
          collected += "\n\n"
          if (stream && opts.onDelta) await opts.onDelta("\n\n")
        }
      }
      collected += t
      emitted = true
      if (stream && opts.onDelta) await opts.onDelta(t)
    }

    const body: any = { model: opts.model, messages: history, max_completion_tokens: opts.maxTokens, stream }
    if (tools.length) body.tools = tools
    if (opts.effort) body.reasoning_effort = opts.effort
    let res: Response
    try {
      res = await fetcher(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + opts.gatewayKey,
          "user-agent": LLM_USER_AGENT,
          ...(stream ? { accept: "text/event-stream", "accept-encoding": "identity" } : {}),
        },
        body: JSON.stringify(body),
      })
    } catch (e: any) {
      throw new TurnError(e?.message || "fetch failed", true)
    }
    if (res.status >= 400) {
      const t = await res.text().catch(() => "")
      throw new TurnError(`gateway ${res.status}: ${t.slice(0, 200)}`, res.status >= 500)
    }

    const turn: Turn = { text: "", calls: [], finish: "" }
    const ct = res.headers.get("content-type") || ""
    if (!stream || ct.indexOf("text/event-stream") < 0 || !res.body) {
      // Whole reply (or a gateway that ignored stream:true).
      let reply: any
      try {
        reply = await res.json()
      } catch {
        throw new TurnError("bad gateway reply", true)
      }
      const ch = reply?.choices?.[0]
      const msg = ch?.message
      if (!msg) throw new TurnError(reply?.error?.message || "empty gateway reply", true)
      const text = typeof msg.content === "string" ? msg.content : ""
      await emit(text)
      turn.text = text
      for (const c of Array.isArray(msg.tool_calls) ? msg.tool_calls : []) {
        turn.calls.push({ id: c.id, name: c.function?.name || "", args: c.function?.arguments || "" })
      }
      turn.finish = ch.finish_reason || ""
      return turn
    }

    try {
      for await (const ev of sseEvents(res.body)) {
        if (ev?.error) throw new TurnError(ev.error.message || "stream error", !emitted && turn.calls.length === 0)
        const ch = ev?.choices?.[0]
        if (!ch) continue
        const d = ch.delta || {}
        if (typeof d.content === "string" && d.content) {
          turn.text += d.content
          await emit(d.content)
        }
        for (const tc of Array.isArray(d.tool_calls) ? d.tool_calls : []) {
          const i = typeof tc.index === "number" ? tc.index : turn.calls.length
          const cur = (turn.calls[i] ??= { id: "", name: "", args: "" })
          if (tc.id) cur.id = tc.id
          if (tc.function?.name) cur.name += tc.function.name
          if (typeof tc.function?.arguments === "string") cur.args += tc.function.arguments
        }
        if (ch.finish_reason) turn.finish = ch.finish_reason
      }
    } catch (e: any) {
      if (e instanceof TurnError) throw e
      throw new TurnError(e?.message || "stream read failed", !emitted && turn.calls.length === 0)
    }
    turn.calls = turn.calls.filter(Boolean)
    return turn
  }

  for (let iter = 0; iter < maxIters; iter++) {
    if (now() - startedAt > wallMs) return { iterations: iter, stopReason: "wall", text: collected }

    let turn: Turn
    try {
      try {
        turn = await attempt()
      } catch (e) {
        // DeepSeek-class models now and then abort: ask once more, as long as nothing was shown.
        if (e instanceof TurnError && e.retryable) turn = await attempt()
        else throw e
      }
    } catch (e: any) {
      return { iterations: iter, stopReason: "gateway_error", lastError: e?.message || "gateway error", text: collected }
    }

    const calls = turn.calls.filter((c) => c.name)
    const assistant: any = { role: "assistant", content: turn.text || null }
    if (calls.length) {
      calls.forEach((c, i) => {
        if (!c.id) c.id = "call_" + iter + "_" + i
      })
      assistant.tool_calls = calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } }))
    }
    history.push(assistant)
    opts.messages.push(assistant)

    if (!calls.length) {
      return { iterations: iter + 1, stopReason: turn.finish === "stop" ? "end_turn" : "no_tool", text: collected }
    }
    for (const c of calls) {
      const call: ToolCall = { id: c.id, name: c.name, input: parseArgs(c.args) }
      if (opts.onTool) await opts.onTool(call)
      const r = await opts.executeTool(call)
      const msg = { role: "tool", tool_call_id: c.id, content: r.content }
      history.push(msg)
      opts.messages.push(msg)
    }
  }
  return { iterations: maxIters, stopReason: "max_iters", text: collected }
}

export function runLlmLoop(opts: LlmLoopOpts): Promise<LlmLoopResult> {
  return runLoop(opts, false)
}

export function runLlmLoopStream(opts: LlmLoopOpts): Promise<LlmLoopResult> {
  return runLoop(opts, true)
}
