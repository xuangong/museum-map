import type { MatchEvidence } from "./dynasty-museum-match"

export const REASON_MODEL = "claude-haiku-4-5"
export const REASON_MAX_TOKENS = 200

export interface ReasonOpts {
  dynastyName: string
  museumName: string
  evidence: MatchEvidence
  gatewayUrl: string
  gatewayKey: string
  fetcher?: typeof fetch
}

/** Generate a ≤40-char Chinese sentence explaining why this museum is relevant to this dynasty. */
export async function generateReason(opts: ReasonOpts): Promise<string> {
  const fetcher = opts.fetcher ?? fetch
  const sys = `给一句话「这家馆能看到 X 朝代的什么」给亲子游客。
要求：
- 中文，**严格 ≤40 字**，单句陈述，不要换行/分段。
- 必须基于给出的"匹配证据"写，不要发挥。
- 写出具体看点：依托遗址、馆藏文物、复原场景等。
- 不要客套/不要"推荐"/不要重复馆名/朝代名/不要解释逻辑。
- 输出**仅一行文字**，不要任何前缀、引号、备注、字数说明。`
  const ev = opts.evidence
  const sigLines: string[] = []
  for (const s of ev.signals) {
    if (s.type === "core_period") sigLines.push(`核心朝代：${s.text}`)
    else if (s.type === "dynasty_coverage") sigLines.push(`朝代覆盖：${s.text}`)
    else if (s.type === "artifact_period") sigLines.push(`命中文物：${s.text}`)
  }
  const arts = ev.artifactHits.map((a) => `《${a.name}》(${a.period})`).join("、")
  const user = `朝代：${opts.dynastyName}
博物馆：${opts.museumName}
匹配证据：
${sigLines.join("\n") || "（仅元信息匹配）"}
${arts ? "代表文物：" + arts : ""}`

  const res = await fetcher(opts.gatewayUrl.replace(/\/$/, "") + "/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.gatewayKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: REASON_MODEL,
      max_tokens: REASON_MAX_TOKENS,
      stream: false,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  })
  if (!res.ok) throw new Error(`gateway ${res.status}`)
  const j: any = await res.json()
  const text = (j?.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim()
  // Strip trailing period & truncate hard
  let out = text.replace(/^["「『]+|["」』]+$/g, "").replace(/[。.\s]+$/, "")
  // Keep only first line and drop any "（共 N 字）" / parenthetical字数 notes
  out = out.split(/\n+/)[0]?.trim() ?? ""
  out = out.replace(/[（(]\s*共?\s*\d+\s*字\s*[)）]\s*$/g, "").trim()
  // Allow up to 60 chars to absorb LLM overruns; UI can truncate further if needed
  if (out.length > 60) out = out.slice(0, 60)
  return out
}
