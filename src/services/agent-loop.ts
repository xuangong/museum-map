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
