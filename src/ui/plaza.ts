import { Layout } from "./layout"
import { icon } from "./icons"
import type { PlazaEntry } from "~/services/plaza"
import { collectorRank, sealMarkup } from "~/services/museum-meta"

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

/** Shared top strip for the standalone pages — brand back to the atlas + quick links. */
export function PageTop(links: string): string {
  return `<div class="page-top">
    <a class="page-brand brand" href="/"><span class="brand-seal">博</span><span class="brand-name">中国博物馆地图</span></a>
    <div class="page-top-links">${links}</div>
  </div>`
}

// 广场: people who opened their 集章册 to everyone. Each card is a passport cover —
// who they are, their collector title, and the latest seals they collected.
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

  const sortLink = (s: string, label: string) =>
    `<a href="/plaza?sort=${s}" class="seg-btn${sort === s ? " active" : ""}">${label}</a>`

  const cards = entries
    .map((e, i) => {
      const isSelf = !!(selfHandle && selfHandle === e.handle)
      const initial = (e.displayName || e.handle || "·").trim().charAt(0).toUpperCase()
      const rank = (page - 1) * pageSize + i + 1
      const name = e.displayName || `@${e.handle}`
      const seals = e.recentSeals ?? []
      const more = e.visitCount - seals.length
      return `<a class="plaza-card${isSelf ? " self" : ""}${rank <= 3 && sort === "visits" ? " top" : ""}" href="/u/${encodeURIComponent(e.handle)}">
        <div class="plaza-who">
          <span class="plaza-rank">${String(rank).padStart(2, "0")}</span>
          <span class="who-avatar">${esc(initial)}</span>
          <div class="plaza-info">
            <div class="plaza-name">${esc(name)}${isSelf ? `<span class="you">· 你</span>` : ""}</div>
            <div class="plaza-handle">@${esc(e.handle)} · ${esc(fmtAgo(e.lastVisitAt))}</div>
          </div>
          <span class="rank-badge plaza-title">${esc(collectorRank(e.visitCount).title)}</span>
        </div>
        <div class="plaza-seals">${seals.map((s) => sealMarkup(s)).join("")}${more > 0 ? `<span class="more">+${more}</span>` : ""}</div>
        <div class="plaza-stats">
          <span><b>${e.visitCount}</b>枚馆印</span>
          <span><b>${e.dynastyCount}</b>个朝代</span>
          ${e.reviewCount ? `<span><b>${e.reviewCount}</b>篇读后感</span>` : ""}
        </div>
      </a>`
    })
    .join("")

  const pager = (() => {
    if (totalPages <= 1) return ""
    const prev = page > 1
      ? `<a class="btn btn-ghost" href="/plaza?sort=${sort}&page=${page - 1}">${icon("arrowLeft", 15)}上一页</a>`
      : `<span class="btn btn-ghost" aria-disabled="true" style="opacity:.35">${icon("arrowLeft", 15)}上一页</span>`
    const next = page < totalPages
      ? `<a class="btn btn-ghost" href="/plaza?sort=${sort}&page=${page + 1}">下一页${icon("arrowRight", 15)}</a>`
      : `<span class="btn btn-ghost" aria-disabled="true" style="opacity:.35">下一页${icon("arrowRight", 15)}</span>`
    return `<div class="plaza-pager">${prev}<span>${page} / ${totalPages}</span>${next}</div>`
  })()

  const empty = `<div class="page-empty">
    ${sealMarkup({ t: "同好", s: 2, y: 0, r: -8 })}
    <div>广场还空着。<br>第一个把集章册公开的人，会站在这里。</div>
    <a class="btn btn-seal" href="/">${icon("seal", 16)}去集第一枚印</a>
  </div>`

  return Layout({
    title: "广场 · 中国博物馆地图",
    children: `<div class="page"><div class="page-inner">
      ${PageTop(`<a class="btn btn-ghost" href="/">${icon("layers", 15)}回到时空</a>`)}

      <header class="page-head">
        <div class="hero-kicker">${icon("users", 15)}<span>广场</span><span class="mono">PLAZA</span></div>
        <h1 class="hero-title">同好之径</h1>
        <p class="hero-lede">每一枚馆印，都是有人真的走到了那里。看看同好们把哪些时间和地点，收进了自己的集章册。</p>
      </header>

      <nav class="seg plaza-seg" aria-label="排序">
        ${sortLink("visits", "集印最多")}
        ${sortLink("recent", "最近活跃")}
        ${sortLink("newest", "新加入")}
      </nav>

      ${entries.length === 0 ? `<div style="margin-top:18px">${empty}</div>` : `<div class="plaza-grid">${cards}</div>${pager}`}

      <div class="page-foot">共 ${total} 位同好 · WHERE TIME MEETS PLACE</div>
    </div></div>`,
  })
}
