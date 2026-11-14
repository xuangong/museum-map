export interface ToolCall {
  id: string
  name: string
  input: any
}

export interface ToolResult {
  tool_use_id: string
  content: string
  is_error?: boolean
}

export interface AgentLoopOpts {
  gatewayUrl: string
  gatewayKey: string
  model: string
  maxTokens: number
  system: string
  tools: any[]
  messages: any[]
  /** Execute one tool call. Return text content to feed back. May throw to abort. */
  executeTool: (call: ToolCall) => Promise<ToolResult>
  /** Called for any text emitted by the assistant. */
  onText?: (text: string) => void | Promise<void>
  /** Called before executing a tool call. */
  onTool?: (call: ToolCall) => void | Promise<void>
  /** Called when the loop should stop early (e.g. final tool fired). */
  shouldStop?: () => boolean
  maxIters?: number
  wallMs?: number
  fetcher?: typeof fetch
  now?: () => number
}

export interface AgentLoopResult {
  iterations: number
  stopReason: "end_turn" | "shouldStop" | "max_iters" | "wall" | "gateway_error" | "no_tool"
  lastError?: string
  text: string
}

export async function runToolLoop(opts: AgentLoopOpts): Promise<AgentLoopResult> {
  const fetcher = opts.fetcher ?? fetch
  const now = opts.now ?? Date.now
  const maxIters = opts.maxIters ?? 8
  const wallMs = opts.wallMs ?? 60_000
  const startedAt = now()
  let collectedText = ""

  for (let iter = 0; iter < maxIters; iter++) {
    if (now() - startedAt > wallMs) {
      return { iterations: iter, stopReason: "wall", text: collectedText }
    }

    let upstream: Response
    try {
      upstream = await fetcher(opts.gatewayUrl.replace(/\/$/, "") + "/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.gatewayKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: opts.maxTokens,
          stream: false,
          system: opts.system,
          tools: opts.tools,
          messages: opts.messages,
        }),
      })
    } catch (e: any) {
      return { iterations: iter, stopReason: "gateway_error", lastError: e?.message || "fetch failed", text: collectedText }
    }

    if (upstream.status >= 400) {
      const text = await upstream.text().catch(() => "")
      return {
        iterations: iter,
        stopReason: "gateway_error",
        lastError: `gateway ${upstream.status}: ${text.slice(0, 200)}`,
        text: collectedText,
      }
    }

    const reply: any = await upstream.json()
    const content: any[] = Array.isArray(reply?.content) ? reply.content : []
    opts.messages.push({ role: "assistant", content })

    const textBlocks = content.filter((b) => b?.type === "text").map((b) => b.text).filter(Boolean)
    if (textBlocks.length) {
      const t = textBlocks.join("\n")
      collectedText += (collectedText ? "\n" : "") + t
      if (opts.onText) await opts.onText(t)
    }

    const toolUses = content.filter((b) => b?.type === "tool_use") as ToolCall[]
    if (!toolUses.length) {
      return { iterations: iter + 1, stopReason: reply.stop_reason === "end_turn" ? "end_turn" : "no_tool", text: collectedText }
    }

    const results: any[] = []
    for (const tu of toolUses) {
      if (opts.onTool) await opts.onTool(tu)
      const r = await opts.executeTool(tu)
      results.push({
        type: "tool_result",
        tool_use_id: r.tool_use_id,
        content: r.content,
        is_error: r.is_error || undefined,
      })
    }
    opts.messages.push({ role: "user", content: results })

    if (opts.shouldStop && opts.shouldStop()) {
      return { iterations: iter + 1, stopReason: "shouldStop", text: collectedText }
    }
  }

  return { iterations: maxIters, stopReason: "max_iters", text: collectedText }
}

export interface StreamLoopOpts extends AgentLoopOpts {
  /** Each piece of assistant text as it arrives. */
  onDelta: (text: string) => void | Promise<void>
}

/** Anthropic-style SSE body → parsed `data:` events. */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  const parse = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n")
    if (!data || data === "[DONE]") return null
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n")
    let i: number
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = parse(buf.slice(0, i))
      buf = buf.slice(i + 2)
      if (ev) yield ev
    }
  }
  const tail = parse(buf.trim())
  if (tail) yield tail
}

/**
 * runToolLoop, but every model turn is streamed: text reaches `onDelta` as it is written,
 * so the reader sees the answer form instead of waiting for the whole loop. Tool turns
 * work as before (their input JSON is assembled from the stream).
 */
export async function runToolLoopStream(opts: StreamLoopOpts): Promise<AgentLoopResult> {
  const fetcher = opts.fetcher ?? fetch
  const now = opts.now ?? Date.now
  const maxIters = opts.maxIters ?? 8
  const wallMs = opts.wallMs ?? 60_000
  const startedAt = now()
  let collectedText = ""

  for (let iter = 0; iter < maxIters; iter++) {
    if (now() - startedAt > wallMs) {
      return { iterations: iter, stopReason: "wall", text: collectedText }
    }

    let upstream: Response
    try {
      upstream = await fetcher(opts.gatewayUrl.replace(/\/$/, "") + "/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": opts.gatewayKey,
          "anthropic-version": "2023-06-01",
          accept: "text/event-stream",
          "accept-encoding": "identity",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: opts.maxTokens,
          stream: true,
          system: opts.system,
          tools: opts.tools,
          messages: opts.messages,
        }),
      })
    } catch (e: any) {
      return { iterations: iter, stopReason: "gateway_error", lastError: e?.message || "fetch failed", text: collectedText }
    }
    if (upstream.status >= 400 || !upstream.body) {
      const text = await upstream.text().catch(() => "")
      return {
        iterations: iter,
        stopReason: "gateway_error",
        lastError: `gateway ${upstream.status}: ${text.slice(0, 200)}`,
        text: collectedText,
      }
    }

    // A text turn after an earlier one starts on a new paragraph.
    let started = false
    const emit = async (t: string) => {
      if (!t) return
      if (!started) {
        started = true
        if (collectedText) {
          collectedText += "\n\n"
          await opts.onDelta("\n\n")
        }
      }
      collectedText += t
      await opts.onDelta(t)
    }

    const blocks: any[] = []
    let stopReason = ""
    const ct = upstream.headers.get("content-type") || ""
    if (ct.indexOf("text/event-stream") < 0) {
      // Gateway ignored stream:true — same turn, delivered whole.
      const reply: any = await upstream.json().catch(() => ({}))
      for (const b of Array.isArray(reply?.content) ? reply.content : []) {
        blocks.push(b)
        if (b?.type === "text") await emit(b.text || "")
      }
      stopReason = reply?.stop_reason || ""
    } else {
      try {
        for await (const ev of sseEvents(upstream.body)) {
          if (ev.type === "content_block_start") {
            const cb = ev.content_block || {}
            blocks[ev.index] =
              cb.type === "tool_use"
                ? { type: "tool_use", id: cb.id, name: cb.name, input: {}, json: "" }
                : cb.type === "thinking"
                  ? { type: "thinking", thinking: cb.thinking || "", signature: cb.signature || "" }
                  : cb.type === "text"
                    ? { ...cb, text: cb.text || "" }
                    : { ...cb } // redacted_thinking etc.: kept exactly as sent
            if (cb.type === "text" && cb.text) await emit(cb.text)
          } else if (ev.type === "content_block_delta") {
            const b = blocks[ev.index]
            const d = ev.delta || {}
            if (!b) continue
            if (d.type === "text_delta" && typeof d.text === "string") {
              b.text += d.text
              await emit(d.text)
            } else if (d.type === "input_json_delta" && typeof d.partial_json === "string") {
              b.json += d.partial_json
            } else if (d.type === "thinking_delta" && typeof d.thinking === "string") {
              b.thinking += d.thinking
            } else if (d.type === "signature_delta" && typeof d.signature === "string") {
              b.signature += d.signature
            }
          } else if (ev.type === "content_block_stop") {
            const b = blocks[ev.index]
            if (b && b.type === "tool_use") {
              try {
                b.input = b.json ? JSON.parse(b.json) : {}
              } catch {
                b.input = {}
              }
            }
          } else if (ev.type === "message_delta") {
            stopReason = ev.delta?.stop_reason || stopReason
          } else if (ev.type === "error") {
            return {
              iterations: iter,
              stopReason: "gateway_error",
              lastError: ev.error?.message || "stream error",
              text: collectedText,
            }
          }
        }
      } catch (e: any) {
        return { iterations: iter, stopReason: "gateway_error", lastError: e?.message || "stream read failed", text: collectedText }
      }
    }

    // The turn goes back as the model wrote it — thinking blocks (with their signatures)
    // included, so the next turn after a tool call keeps its reasoning. Only empty text
    // blocks are dropped (the API rejects them).
    const content: any[] = blocks
      .filter(Boolean)
      .map((b) =>
        b.type === "tool_use"
          ? { type: "tool_use", id: b.id, name: b.name, input: b.input }
          : b.type === "text"
            ? { type: "text", text: b.text }
            : b,
      )
      .filter((b) => b.type !== "text" || b.text)
    opts.messages.push({ role: "assistant", content })

    const toolUses = content.filter((b) => b.type === "tool_use") as ToolCall[]
    if (!toolUses.length) {
      return { iterations: iter + 1, stopReason: stopReason === "end_turn" ? "end_turn" : "no_tool", text: collectedText }
    }

    const results: any[] = []
    for (const tu of toolUses) {
      if (opts.onTool) await opts.onTool(tu)
      const r = await opts.executeTool(tu)
      results.push({ type: "tool_result", tool_use_id: r.tool_use_id, content: r.content, is_error: r.is_error || undefined })
    }
    opts.messages.push({ role: "user", content: results })

    if (opts.shouldStop && opts.shouldStop()) {
      return { iterations: iter + 1, stopReason: "shouldStop", text: collectedText }
    }
  }

  return { iterations: maxIters, stopReason: "max_iters", text: collectedText }
}
