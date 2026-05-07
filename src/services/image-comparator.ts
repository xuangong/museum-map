import { runToolLoop } from "./agent-loop"

export const COMPARATOR_MODEL = "claude-haiku-4-5"
export const COMPARATOR_MAX_TOKENS = 1024
export const COMPARATOR_MAX_ITERS = 5
export const COMPARATOR_WALL_MS = 30_000

export interface ComparatorCandidate {
  url: string
  source: string
  license: string
  attribution: string
  pageUrl: string
}

export interface CompareOpts {
  artifact: { name: string; period?: string | null }
  candidates: ComparatorCandidate[]
  gatewayUrl: string
  gatewayKey: string
  gatewayFetcher?: typeof fetch
  now?: () => number
}

export interface CompareResult {
  chosen: number | null
  reason: string
}

const SYSTEM = `你是一名艺术品图片审核员。给定一件文物的名称（可选朝代）和 1..N 张候选图，请挑出**最能代表该件具体文物**的一张。

规则：
- **优先选 license 为 CC/PD 的候选**（许可证清晰，长期可用）。仅当 CC/PD 候选明显是无关图（如周边场景图、同名异物、电影海报、古籍数字化文件）时，才考虑 fair-use 候选。
- 拒绝同名异物（同名电影/书籍/朝代场景图）。
- 拒绝古籍/文献/縣誌/.djvu/.pdf。
- 文物名包含具体形制（如 "乳钉纹青铜爵"）时，泛指图（"青铜爵"）不算匹配。
- 全部不合格时返回 "none"。

完成判断后**必须**调用一次 submit_choice 工具：
- sourceIdx：选中候选的 0-indexed 数字，或字符串 "none"
- reason：一句话说明理由（10-40 字）`

function buildTools(): any[] {
  return [
    {
      name: "submit_choice",
      description: "提交挑选结果。本次任务必须且只能调用一次。",
      input_schema: {
        type: "object",
        required: ["sourceIdx", "reason"],
        properties: {
          sourceIdx: {
            description: "0-indexed 候选编号，或字符串 'none' 表示全部不合格",
          },
          reason: { type: "string" },
        },
      },
    },
  ]
}

function buildUserMessage(opts: CompareOpts): any[] {
  const header = `文物：**${opts.artifact.name}**${opts.artifact.period ? ` (${opts.artifact.period})` : ""}\n请按 SYSTEM 中的规则挑出最能代表该文物的一张候选图，调用 submit_choice 提交。\n\n候选：`
  const blocks: any[] = [{ type: "text", text: header }]
  opts.candidates.forEach((c, i) => {
    blocks.push({
      type: "text",
      text: `\n候选 ${i}：来源=${c.source} · license=${c.license}\n  attribution: ${c.attribution}\n  pageUrl: ${c.pageUrl}`,
    })
    blocks.push({ type: "image", source: { type: "url", url: c.url } })
  })
  return [{ role: "user", content: blocks }]
}

export async function compareAndChoose(opts: CompareOpts): Promise<CompareResult> {
  if (opts.candidates.length === 0) return { chosen: null, reason: "no candidates" }
  if (opts.candidates.length === 1) return { chosen: 0, reason: "single candidate auto-pick" }

  let chosen: number | null | undefined = undefined
  let reason = ""

  await runToolLoop({
    gatewayUrl: opts.gatewayUrl,
    gatewayKey: opts.gatewayKey,
    model: COMPARATOR_MODEL,
    maxTokens: COMPARATOR_MAX_TOKENS,
    system: SYSTEM,
    tools: buildTools(),
    messages: buildUserMessage(opts),
    maxIters: COMPARATOR_MAX_ITERS,
    wallMs: COMPARATOR_WALL_MS,
    fetcher: opts.gatewayFetcher,
    now: opts.now,
    shouldStop: () => chosen !== undefined,
    executeTool: async (call) => {
      if (call.name !== "submit_choice") {
        return { tool_use_id: call.id, content: `unknown tool: ${call.name}`, is_error: true }
      }
      const idx = call.input?.sourceIdx
      reason = String(call.input?.reason ?? "")
      if (idx === "none" || idx === null) {
        chosen = null
      } else if (typeof idx === "number" && idx >= 0 && idx < opts.candidates.length) {
        chosen = idx
      } else if (typeof idx === "string" && /^\d+$/.test(idx)) {
        const n = Number(idx)
        if (n >= 0 && n < opts.candidates.length) chosen = n
        else { chosen = null; reason = `invalid sourceIdx: ${idx}` }
      } else {
        chosen = null
        reason = `invalid sourceIdx: ${JSON.stringify(idx)}`
      }
      return { tool_use_id: call.id, content: JSON.stringify({ ok: true }) }
    },
  })

  if (chosen === undefined) return { chosen: null, reason: "agent did not submit" }
  return { chosen, reason }
}
