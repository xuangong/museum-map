import type { ToolCall, ToolResult } from "~/services/agent-loop"

/** Anthropic tool schemas exposed to the chat agent. */
export const CHAT_TOOLS = [
  {
    name: "search_museums",
    description:
      "搜索本系统数据库中的博物馆/古迹。可按地点（含省/市/区，模糊匹配）、朝代（在 corePeriod 或 dynastyCoverage 中模糊匹配）、等级（如 '一级'/'二级'）、或自由关键词（匹配馆名 / 简介 / 朝代覆盖）筛选。**默认只返回 id/name/location/level**——这对"列出 X 地有哪些馆"这类问题已足够。仅当用户明确问到朝代/时间跨度时，传 fields=['period','coverage'] 取额外字段。可重复调用以缩小范围。",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "地点关键词，如 '北京' '杭州' '陕西'。" },
        dynasty: { type: "string", description: "朝代/时期关键词，如 '商' '唐' '明清' '良渚' '红山'。" },
        level: { type: "string", description: "国家级别，如 '一级' '二级' '三级'。" },
        keyword: { type: "string", description: "自由关键词（匹配馆名 / 朝代覆盖 / 时间线）。" },
        limit: { type: "number", description: "返回上限，默认 100，最大 200。" },
        fields: {
          type: "array",
          items: { type: "string", enum: ["period", "coverage"] },
          description: "可选附加字段。默认不返回 period/coverage 以节省 tokens。",
        },
      },
    },
  },
  {
    name: "get_museum",
    description:
      "获取一个博物馆的详细信息（藏品/展厅/朝代连接/镇馆之宝）。仅在用户问到具体馆的内部细节时调用。先用 search_museums 拿到 id 再调用本工具。",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "博物馆 id。" } },
      required: ["id"],
    },
  },
] as const

interface MuseumRow {
  id: string
  name: string
  location: string | null
  level: string | null
  core_period: string | null
  dynasty_coverage: string | null
  timeline: string | null
}

interface ArtifactRow {
  name: string
  period: string | null
  description: string | null
}

interface ConnRow {
  dynasty: string
  description: string | null
}

interface NameRow { name: string }

const MAX_TOOL_BYTES = 128 * 1024

function clip(s: string): string {
  if (new TextEncoder().encode(s).length <= MAX_TOOL_BYTES) return s
  // Trim by codepoints until under budget.
  const arr = Array.from(s)
  while (arr.length && new TextEncoder().encode(arr.join("") + "\n…(truncated)").length > MAX_TOOL_BYTES) {
    arr.pop()
  }
  return arr.join("") + "\n…(truncated)"
}

async function searchMuseums(db: D1Database, input: any): Promise<string> {
  const where: string[] = []
  const binds: any[] = []
  const loc = typeof input?.location === "string" ? input.location.trim() : ""
  const dyn = typeof input?.dynasty === "string" ? input.dynasty.trim() : ""
  const lvl = typeof input?.level === "string" ? input.level.trim() : ""
  const kw = typeof input?.keyword === "string" ? input.keyword.trim() : ""
  if (loc) { where.push("location LIKE ?"); binds.push(`%${loc}%`) }
  if (lvl) { where.push("level LIKE ?"); binds.push(`%${lvl}%`) }
  if (dyn) {
    where.push("(core_period LIKE ? OR dynasty_coverage LIKE ? OR timeline LIKE ?)")
    binds.push(`%${dyn}%`, `%${dyn}%`, `%${dyn}%`)
  }
  if (kw) {
    where.push("(name LIKE ? OR dynasty_coverage LIKE ? OR specialty LIKE ?)")
    binds.push(`%${kw}%`, `%${kw}%`, `%${kw}%`)
  }
  const limit = Math.max(1, Math.min(200, Number(input?.limit) || 100))
  const wantPeriod = Array.isArray(input?.fields) && input.fields.includes("period")
  const wantCoverage = Array.isArray(input?.fields) && input.fields.includes("coverage")
  const cols = ["id", "name", "location", "level"]
  if (wantPeriod) cols.push("core_period")
  if (wantCoverage) cols.push("dynasty_coverage")
  const sql =
    `SELECT ${cols.join(", ")} FROM museums` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY name LIMIT ${limit + 1}`
  const rows = (await db.prepare(sql).bind(...binds).all<MuseumRow>()).results
  const truncated = rows.length > limit
  const results = truncated ? rows.slice(0, limit) : rows
  if (!results.length) return JSON.stringify({ count: 0, items: [], note: "本系统暂未收录任何匹配条目；请如实告知用户，不要编造。" })
  const items = results.map((r) => {
    const o: any = { id: r.id, name: r.name, location: r.location, level: r.level }
    if (wantPeriod) o.period = r.core_period
    if (wantCoverage) o.coverage = r.dynasty_coverage
    return o
  })
  return clip(JSON.stringify({
    count: items.length,
    truncated,
    note: truncated
      ? `已截取前 ${limit} 条，还有更多。请请用户细化筛选条件。**严禁**在回答中列出 items 之外的任何馆名。`
      : `本次查询命中 ${items.length} 条，**这就是数据库的全部结果**——不存在「还有别的」。\n` +
        `回答前请逐条核对：你将要写的每一个馆名/景点名，必须能在上面 items[].name 里**完全字面**找到（不允许同义词、别名、'(主馆/分馆)' 变体）。\n` +
        `如果数字看起来不"圆"（比如 28 / 17），那就是真实的 28 / 17，**绝不能凑成 30 / 20**。\n` +
        `如果用户问的某个著名地标（如长城分段、某陵墓、某寺）不在 items 里，必须明说「本系统暂未收录」，绝不能补上去。`,
    items,
  }))
}

async function getMuseum(db: D1Database, input: any): Promise<string> {
  const id = typeof input?.id === "string" ? input.id.trim() : ""
  if (!id) return JSON.stringify({ error: "id required" })
  const head = await db
    .prepare(
      "SELECT id, name, location, level, core_period, dynasty_coverage, timeline FROM museums WHERE id = ?",
    )
    .bind(id)
    .first<MuseumRow>()
  if (!head) return JSON.stringify({ error: "not_found", id })
  const [treasures, artifacts, conns] = await Promise.all([
    db.prepare("SELECT name FROM museum_treasures WHERE museum_id = ? ORDER BY order_index").bind(id).all<NameRow>(),
    db
      .prepare(
        "SELECT name, period, description FROM museum_artifacts WHERE museum_id = ? ORDER BY order_index LIMIT 20",
      )
      .bind(id)
      .all<ArtifactRow>(),
    db
      .prepare("SELECT dynasty, description FROM museum_dynasty_connections WHERE museum_id = ? ORDER BY order_index")
      .bind(id)
      .all<ConnRow>(),
  ])
  const out = {
    id: head.id,
    name: head.name,
    location: head.location,
    level: head.level,
    period: head.core_period,
    coverage: head.dynasty_coverage,
    timeline: head.timeline,
    treasures: treasures.results.map((r) => r.name),
    artifacts: artifacts.results.map((a) => ({
      name: a.name,
      period: a.period,
      description: a.description ? a.description.slice(0, 120) : null,
    })),
    dynastyConnections: conns.results.map((c) => ({
      dynasty: c.dynasty,
      note: c.description ? c.description.slice(0, 120) : null,
    })),
  }
  return clip(JSON.stringify(out))
}

export async function executeChatTool(db: D1Database, call: ToolCall): Promise<ToolResult> {
  try {
    let content: string
    if (call.name === "search_museums") {
      content = await searchMuseums(db, call.input || {})
    } else if (call.name === "get_museum") {
      content = await getMuseum(db, call.input || {})
    } else {
      return { tool_use_id: call.id, content: JSON.stringify({ error: "unknown_tool" }), is_error: true }
    }
    return { tool_use_id: call.id, content }
  } catch (e: any) {
    return {
      tool_use_id: call.id,
      content: JSON.stringify({ error: "exec_failed", message: e?.message || String(e) }),
      is_error: true,
    }
  }
}

export const CHAT_AGENT_SYSTEM = [
  "你是「中国博物馆地图」站内 AI 助手。本系统只收录了**部分**博物馆/古迹，远不是中国所有著名地标的完整目录。",
  "回答必须**完全基于 search_museums / get_museum 工具返回的内容**——你的训练数据只是参考背景，**不能作为答案来源**。",
  "",
  "工作流：",
  "① 用 search_museums 查询；",
  "② 收到结果后，**逐条**只复述 items[].name 里出现过的条目；",
  "③ 需要细节再调用 get_museum；",
  "④ 不要补充任何工具未返回的项。",
  "",
  "**反幻觉硬规则（违反即严重错误）**：",
  "- 在写出每个馆名/景点名之前，**先在脑内确认它就在最近一次 search_museums 返回的 items[] 里**。如果不确定，宁可省略。",
  "- 工具返回 N 条 = 答案就是 N 条。不要凑整数——28 就是 28，不能补成 30；17 就是 17，不能补成 20。",
  "- 禁止使用「其他还包括」「等」「及…」「另有…」等开放式收尾。",
  "- 用户问「北京有哪些X」≠「中国有哪些X」。如果用户期待某个著名地标（八达岭/居庸关/慕田峪/十三陵/恭王府……）但 items[] 里没有，**直接说「本系统暂未收录」**，不要把它列上去。",
  "- 当 items[] 与你印象中应该有的不一致时，**永远以 items[] 为准**。本系统是策展数据库，不是百科全书。",
  "",
  "格式：",
  "- 用 - 项目列表，每条一行：**馆名** · 地点 · 等级。",
  "- 禁止 Markdown 表格。",
  "- 列完后写一句「以上为本系统当前收录的全部 N 条」，N 必须等于 items.length。",
  "- 如返回 >40 条，提示用户按朝代/区/等级细化。",
].join("\n")
