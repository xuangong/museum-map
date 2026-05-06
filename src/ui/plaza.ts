import { Layout } from "./layout"
import type { PlazaEntry } from "~/services/plaza"

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function fmtAgo(ts: number | null): string {
  if (!ts) return "—"
  const diff = Date.now() - ts
  const day = 86400000
  if (diff < day) return "今天"
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} 周前`
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} 个月前`
  return `${Math.floor(diff / (365 * day))} 年前`
}

export function PlazaPage(opts: {
  entries: PlazaEntry[]
  total: number
  sort: "visits" | "recent" | "newest"
  page: number
  pageSize: number
  selfHandle?: string | null
}): string {
  const { entries, total, sort, page, pageSize, selfHandle } = opts
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const sortLink = (s: string, label: string) => {
    const active = sort === s
    const url = `/plaza?sort=${s}`
    return `<a href="${url}" class="${active ? "active" : ""}">${label}</a>`
  }

  const css = `
  body { background: var(--paper); margin: 0; }
  .plaza-wrap { max-width: 960px; margin: 0 auto; padding: 56px 32px 96px; color: var(--ink); font-family: var(--display); }
  .plaza-head { padding-bottom: 28px; border-bottom: 0.5px solid var(--rule); }
  .plaza-eyebrow { font-family: var(--sans); font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--vermilion); }
  .plaza-title { font-family: var(--display); font-weight: 700; font-size: 44px; line-height: 1.05; margin: 6px 0 8px; }
  .plaza-sub { font-family: var(--display); font-style: italic; color: var(--ink-mid); font-size: 16px; }
  .plaza-sub .en { display: block; }
  .plaza-sub .zh { display: block; font-style: normal; font-size: 13px; color: var(--ink-mute); margin-top: 4px; letter-spacing: 0.04em; }
  @media (max-width: 600px) {
    .plaza-wrap { padding: 40px 20px 80px; }
    .plaza-title { font-size: 34px; }
    .plaza-sub { font-size: 14px; }
    .plaza-sub .zh { font-size: 12px; }
  }
  .plaza-meta { font-family: var(--mono); font-size: 12px; color: var(--ink-mid); margin-top: 14px; font-variant-numeric: lining-nums; }
  .plaza-tabs { display: flex; gap: 18px; margin: 22px 0 26px; border-bottom: 0.5px solid var(--rule-soft); padding-bottom: 12px; }
  .plaza-tabs a { font-family: var(--sans); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-mid); text-decoration: none; padding-bottom: 4px; }
  .plaza-tabs a.active { color: var(--vermilion); border-bottom: 1.5px solid var(--vermilion); }
  .plaza-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 700px) { .plaza-grid { grid-template-columns: 1fr; } }
  .plaza-card { display: flex; gap: 14px; align-items: center; border: 0.5px solid var(--rule); padding: 14px 16px; background: var(--paper-elev); text-decoration: none; color: var(--ink); transition: border-color 0.12s; }
  .plaza-card:hover { border-color: var(--vermilion); }
  .plaza-card.self { border-color: var(--vermilion); border-width: 1px; }
  .plaza-rank { font-family: var(--mono); font-variant-numeric: lining-nums; font-size: 13px; color: var(--ink-mid); min-width: 28px; }
  .plaza-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--vermilion); color: var(--paper); display: flex; align-items: center; justify-content: center; font-family: var(--display); font-weight: 700; font-size: 20px; flex: 0 0 auto; }
  .plaza-info { flex: 1; min-width: 0; }
  .plaza-name { font-family: var(--display); font-weight: 600; font-size: 16px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .plaza-handle { font-family: var(--mono); font-size: 11px; color: var(--ink-mid); }
  .plaza-stats { display: flex; gap: 12px; margin-top: 6px; font-family: var(--sans); font-size: 11px; color: var(--ink-mid); letter-spacing: 0.04em; }
  .plaza-stats strong { color: var(--vermilion); font-variant-numeric: lining-nums; }
  .plaza-empty { font-family: var(--display); font-style: italic; color: var(--ink-mid); padding: 40px 0; text-align: center; }
  .plaza-pager { display: flex; gap: 14px; justify-content: center; margin-top: 36px; font-family: var(--sans); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; }
  .plaza-pager a { color: var(--vermilion); text-decoration: none; border-bottom: 0.5px solid var(--vermilion); padding-bottom: 2px; }
  .plaza-pager span { color: var(--ink-mid); }
  .plaza-back { display: inline-block; margin-top: 36px; font-family: var(--sans); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--vermilion); text-decoration: none; border-bottom: 0.5px solid var(--vermilion); padding-bottom: 2px; }
  `

  const cards = entries
    .map((e, i) => {
      const isSelf = !!(selfHandle && selfHandle === e.handle)
      const initial = ((e.displayName || e.handle || "·").trim().charAt(0))
      const rank = (page - 1) * pageSize + i + 1
      const name = e.displayName || `@${e.handle}`
      return `<a class="plaza-card${isSelf ? " self" : ""}" href="/u/${encodeURIComponent(e.handle)}">
        <span class="plaza-rank">${String(rank).padStart(2, "0")}</span>
        <div class="plaza-avatar">${esc(initial)}</div>
        <div class="plaza-info">
          <div class="plaza-name">${esc(name)}${isSelf ? " · 你" : ""}</div>
          <div class="plaza-handle">@${esc(e.handle)} · 最近活动 ${esc(fmtAgo(e.lastVisitAt))}</div>
          <div class="plaza-stats">
            <span><strong>${e.visitCount}</strong> 馆</span>
            <span><strong>${e.dynastyCount}</strong> 朝</span>
            <span><strong>${e.reviewCount}</strong> AI 评</span>
          </div>
        </div>
      </a>`
    })
    .join("")

  const pager = (() => {
    if (totalPages <= 1) return ""
    const prev = page > 1 ? `<a href="/plaza?sort=${sort}&page=${page - 1}">← 上一页</a>` : `<span>← 上一页</span>`
    const next = page < totalPages ? `<a href="/plaza?sort=${sort}&page=${page + 1}">下一页 →</a>` : `<span>下一页 →</span>`
    return `<div class="plaza-pager">${prev}<span>${page} / ${totalPages}</span>${next}</div>`
  })()

  return Layout({
    title: "广场 · 中国博物馆地图",
    head: `<style>${css}</style>`,
    children: `<div class="plaza-wrap">
      <header class="plaza-head">
        <div class="plaza-eyebrow">Plaza · 广场</div>
        <h1 class="plaza-title">同好之径</h1>
        <div class="plaza-sub">
          <span class="en">Footprints of fellow museum-goers</span>
          <span class="zh">公开打卡用户列表</span>
        </div>
        <div class="plaza-meta">共 ${total} 位 · 按${sort === "visits" ? "打卡数" : sort === "recent" ? "最近活动" : "加入时间"}排序</div>
      </header>

      <nav class="plaza-tabs">
        ${sortLink("visits", "打卡王")}
        ${sortLink("recent", "最近活跃")}
        ${sortLink("newest", "最新加入")}
      </nav>

      ${entries.length === 0
        ? `<div class="plaza-empty">还没有公开的足迹。注册账号、开始打卡，让这里热闹起来。</div>`
        : `<div class="plaza-grid">${cards}</div>${pager}`}

      <a class="plaza-back" href="/">← 回到地图</a>
    </div>`,
  })
}
