import type { ToolCall, ToolResult } from "~/services/agent-loop"

/** Anthropic tool schemas exposed to the chat agent. */
export const CHAT_TOOLS = [
  {
    name: "search_museums",
    description:
      "搜索本系统数据库中的博物馆/古迹。可按地点（含省/市/区，模糊匹配）、朝代（在 corePeriod 或 dynastyCoverage 中模糊匹配）、等级（如 '一级'/'二级'）、或自由关键词（匹配馆名 / 简介 / 朝代覆盖）筛选。返回轻量条目列表。可重复调用以缩小范围。如果一次返回过多，提示用户细化条件。",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "地点关键词，如 '北京' '杭州' '陕西'。" },
        dynasty: { type: "string", description: "朝代/时期关键词，如 '商' '唐' '明清' '良渚' '红山'。" },
        level: { type: "string", description: "国家级别，如 '一级' '二级' '三级'。" },
        keyword: { type: "string", description: "自由关键词（匹配馆名 / 朝代覆盖 / 时间线）。" },
        limit: { type: "number", description: "返回上限，默认 30，最大 100。" },
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

const MAX_TOOL_BYTES = 4 * 1024

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
  const limit = Math.max(1, Math.min(100, Number(input?.limit) || 30))
  const sql =
    "SELECT id, name, location, level, core_period, dynasty_coverage, timeline FROM museums" +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY name LIMIT ${limit}`
  const { results } = await db.prepare(sql).bind(...binds).all<MuseumRow>()
  if (!results.length) return JSON.stringify({ count: 0, items: [], note: "no matches" })
  const items = results.map((r) => ({
    id: r.id,
    name: r.name,
    location: r.location,
    level: r.level,
    period: r.core_period,
    coverage: r.dynasty_coverage,
  }))
  return clip(JSON.stringify({ count: items.length, items }))
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
  "你是「中国博物馆地图」站内 AI 助手。回答必须基于本系统数据库（用 search_museums / get_museum 工具查询），不要凭训练记忆罗列馆名。",
  "工作流：① 用 search_museums 找到符合用户问题的条目；② 必要时再用 get_museum 拿细节；③ 综合后用中文简短作答。",
  "如果数据库结果为空，明确告诉用户「本系统暂未收录」，不要编造。",
  "回答格式：用项目列表 (- )，每条最多一行。**禁止使用 Markdown 表格**。每条注明地点+等级（如有）。",
].join("\n")
