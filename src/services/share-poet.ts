// Share-poster copywriter. Calls Sonnet 4.6 via the gateway to produce a
// magazine-style headline + a real classical Chinese poem line for the user's
// share poster. No fallback — caller decides what to do on failure.

export const POET_MODEL = "claude-sonnet-4-6"
export const POET_MAX_TOKENS = 768

export interface PoetInput {
  displayName: string
  handle: string
  visitCount: number
  dynastyCount: number
  recentMuseums: string[]
  reviewSummary: string | null
  dynastyReviews: Array<{ dynastyName: string; count: number; summary: string }>
  /** Poster style key — nudges the poem mood. */
  style?: string
}

export interface PoetCopy {
  themeWord: string // 2 chars, 浓缩气质（如「行旅」「拾遗」「游目」「叩问」）
  headline: string[] // 2 lines, each 8-14 chars
  poem: string[] // 1 or 2 columns; each 4-7 chars
  poemSource: string // 朝代·作者《篇名》
}

export interface PoetOpts {
  input: PoetInput
  gatewayUrl: string
  gatewayKey: string
  fetcher?: typeof fetch
}

const SYSTEM_PROMPT = `你是一位为「个人博物馆足迹海报」撰文的杂志编辑。气质参考：Pentagram + Kinfolk + 旧式藏书票 + 中式杂志感。读者是青年。

你的任务：基于用户的足迹信息，输出三段文字
1. theme_word — **两个汉字**，浓缩 ta 的足迹气质（如「行旅」「拾遗」「游目」「叩问」「望气」「访古」「踏雪」「寻碑」），将作为海报巨字主视觉
2. headline   — 一段原创短句（两行），作为海报副位金句
3. poem       — 一句真实存在的中国古典诗词，作为海报正中视觉主体

风格底线：
- 不要"传承/瑰宝/震撼/家国/亲子/孩子/家长"等字眼
- 不要客套、不要总结、不要鸡汤、不要"让我们…"
- 克制、有画面、青年向、像编辑随手写在扉页的话
- theme_word 必须是 2 个汉字（不是 1 字也不是 3 字），且非现代造词
- headline 必须呼应用户的真实足迹气质（从 AI 评里抽取关键意象）
- poem 的意境也要呼应 ta 的足迹特质

poem 规则：
- 必须是流传的古典诗词原句（唐宋元明清及更早），不要近现代
- **必须是同一首诗里的同一句**，不能拼接两首不同的诗
- 单句总长 4-14 字
- 若 ≤7 字，输出 1 个元素（单列）
- 若 8-14 字，按自然停顿断为 2 个元素（双列对称）
  例："雲山蒼蒼，江水泱泱" → ["雲山蒼蒼", "江水泱泱"]
- 优先意境清远、空、淡的句子；避开"江山/天下/万古/千秋"等大词
- poem_source 必须是单一出处「朝代·作者《篇名》」，不可使用斜杠/逗号列出多个

输出严格 JSON，不要任何解释、不要 markdown 代码块：
{
  "theme_word": "兩字",
  "headline":   ["第一行 8-14 字", "第二行 8-14 字"],
  "poem":       ["竖列 1（4-7 字）", "（可选）竖列 2（4-7 字）"],
  "poem_source": "朝代·作者《篇名》"
}`

function buildUserPrompt(input: PoetInput): string {
  const parts: string[] = []
  parts.push(`用户：${input.displayName}（@${input.handle}）`)
  parts.push(`足迹：打卡 ${input.visitCount} 馆，跨越 ${input.dynastyCount} 朝`)
  if (input.recentMuseums.length > 0) {
    parts.push(`近访博物馆：${input.recentMuseums.slice(0, 8).join("、")}`)
  }
  const moodHint = STYLE_MOOD[input.style ?? ""]
  if (moodHint) {
    parts.push("")
    parts.push(`本次海报版式：${moodHint.label} —— ${moodHint.mood}`)
    parts.push("请挑一句**与该版式气质相称**的诗（不必与上次相同）。")
  }
  parts.push("")
  parts.push("—— AI 总评 ——")
  parts.push(input.reviewSummary ? input.reviewSummary.slice(0, 800) : "（无）")
  if (input.dynastyReviews.length > 0) {
    parts.push("")
    parts.push("—— 各朝代 AI 评（top 8）——")
    const top = [...input.dynastyReviews].sort((a, b) => b.count - a.count).slice(0, 8)
    for (const dr of top) {
      parts.push(`「${dr.dynastyName}」（${dr.count} 馆）`)
      parts.push(dr.summary.slice(0, 300))
      parts.push("")
    }
  }
  return parts.join("\n")
}

/** Per-style mood hints — let Sonnet pick a poem in the matching key. */
const STYLE_MOOD: Record<string, { label: string; mood: string }> = {
  grid:    { label: "窗格 / 编辑部杂志页",    mood: "克制、留白、文人随手记下的一句；意象偏静物、桌上、窗前" },
  scroll:  { label: "立轴 / 古卷",             mood: "悠远、空旷、山水之远；适合长境、远眺、独立的句子" },
  ticket:  { label: "门票 / 入场券",           mood: "出发、入场、片刻、轻盈；意象偏行旅初出、一程将启" },
  seal:    { label: "印谱 / 拓印册页",         mood: "金石感、古拙、铭刻；意象偏古碑、青铜、刻字、月下" },
  archive: { label: "档案卡 / 标本说明",       mood: "考据、冷静、博物学口吻；意象偏物、器、纹、古事的细节" },
}

function stripCodeFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
}

/** Extract first balanced JSON object from a possibly-noisy string. */
function extractFirstJson(s: string): string {
  const start = s.indexOf("{")
  if (start < 0) return s
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === "{") depth++
    else if (c === "}") {
      depth--
      if (depth === 0) return s.slice(start, i + 1)
    }
  }
  return s.slice(start)
}

export async function generatePoetCopy(opts: PoetOpts): Promise<PoetCopy> {
  const fetcher = opts.fetcher ?? fetch
  const userPrompt = buildUserPrompt(opts.input)
  const res = await fetcher(opts.gatewayUrl.replace(/\/$/, "") + "/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": opts.gatewayKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: POET_MODEL,
      max_tokens: POET_MAX_TOKENS,
      stream: false,
      temperature: 0.85,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })
  if (!res.ok) throw new Error(`gateway ${res.status}`)
  const j: any = await res.json()
  const text = (j?.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim()
  const cleaned = extractFirstJson(stripCodeFence(text))
  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    throw new Error(`poet JSON parse failed: ${(e as Error).message}; raw=${cleaned.slice(0, 200)}`)
  }
  const headline = Array.isArray(parsed.headline) ? parsed.headline.map((x: any) => String(x).trim()).filter(Boolean) : []
  const poem = Array.isArray(parsed.poem) ? parsed.poem.map((x: any) => String(x).trim()).filter(Boolean) : []
  const poemSource = String(parsed.poem_source ?? "").trim()
  const themeWord = String(parsed.theme_word ?? "").trim()
  if (headline.length === 0 || poem.length === 0 || !poemSource || Array.from(themeWord).length !== 2) {
    throw new Error(`poet output incomplete: ${cleaned.slice(0, 200)}`)
  }
  return { themeWord, headline, poem, poemSource }
}
