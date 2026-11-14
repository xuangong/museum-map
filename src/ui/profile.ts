import type { MuseumListItem, DynastyFull } from "~/repo/types"
import { Layout } from "./layout"
import { icon } from "./icons"
import { PageTop } from "./plaza"
import { collectorRank, sealMarkup, sealSpec } from "~/services/museum-meta"

export interface ProfileData {
  user: { handle: string | null; displayName: string | null }
  visits: Array<{ museumId: string; visitedAt: number; note: string | null }>
  review: { summary: string; count: number; generatedAt: number } | null
  dynastyReviews: Array<{ dynastyId: string; summary: string; count: number; generatedAt: number }>
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function fmtDate(ts: number): string {
  if (!ts) return ""
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
}

// Server-side Markdown → HTML. Mirrors the client renderer in chat.ts feature
// set: headings, bold/italic, links, lists (ul/ol), blockquotes, code, hr,
// paragraphs. Zero deps.
function renderMd(s: string): string {
  if (!s) return ""
  let src = esc(String(s))
  // Fenced code
  src = src.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.replace(/^\n/, "")}</code></pre>`)
  // Inline code
  src = src.replace(/`([^`\n]+)`/g, "<code>$1</code>")
  // Headings
  src = src.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
  src = src.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
  src = src.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>")
  // Horizontal rule
  src = src.replace(/^\s*---+\s*$/gm, "<hr>")
  // Blockquote (single line)
  src = src.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>")
  // Bold + italic
  src = src.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
  src = src.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
  // Links
  src = src.replace(/\[([^\]]+)]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  // Lists: group consecutive lines
  const lines = src.split("\n")
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(`<li>${lines[i]!.replace(/^\s*[-*]\s+/, "")}</li>`)
        i++
      }
      out.push(`<ul>${items.join("")}</ul>`)
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(`<li>${lines[i]!.replace(/^\s*\d+\.\s+/, "")}</li>`)
        i++
      }
      out.push(`<ol>${items.join("")}</ol>`)
    } else {
      out.push(line)
      i++
    }
  }
  src = out.join("\n")
  // Paragraphs
  return src
    .split(/\n{2,}/)
    .map((b) => {
      const t = b.trim()
      if (!t) return ""
      if (/^<(?:h[1-6]|ul|ol|pre|blockquote|hr)/.test(t)) return t
      return `<p>${t.replace(/\n/g, "<br>")}</p>`
    })
    .join("")
}

// The public 集章册: who they are, their collector title, every seal they've collected,
// the guide's notes on their collection, and per-dynasty notes.
export function ProfilePage(opts: {
  profile: ProfileData
  museums: MuseumListItem[]
  dynasties: DynastyFull[]
  selfUser?: { handle: string | null; displayName: string | null } | null
}): string {
  const { profile, museums, dynasties, selfUser } = opts
  const museumById = new Map(museums.map((m) => [m.id, m]))
  const dynastyById = new Map(dynasties.map((d) => [d.id, d]))

  const displayName = profile.user.displayName || `@${profile.user.handle ?? ""}`
  const handle = profile.user.handle ?? ""
  const initial = (displayName || "·").trim().replace(/^@/, "").charAt(0).toUpperCase()
  const mapBase = `/u/${encodeURIComponent(handle)}/map`

  // Dynasties touched = dynasties whose recommended / related museums include a visit.
  const visitedIds = new Set(profile.visits.map((v) => v.museumId))
  const dynastyVisitCount = new Map<string, number>()
  for (const d of dynasties) {
    let n = 0
    for (const r of d.recommendedMuseums || []) {
      if (r.museumId && visitedIds.has(r.museumId)) n++
    }
    for (const r of d.relatedMuseums || []) {
      if (r.museumId && visitedIds.has(r.museumId)) n++
    }
    if (n > 0) dynastyVisitCount.set(d.id, n)
  }

  // Richer dynasty notes first.
  const dynastyCards = profile.dynastyReviews
    .map((r) => {
      const d = dynastyById.get(r.dynastyId)
      return d ? { d, r, count: dynastyVisitCount.get(d.id) ?? r.count } : null
    })
    .filter((x): x is { d: DynastyFull; r: ProfileData["dynastyReviews"][number]; count: number } => !!x)
    .sort((a, b) => b.count - a.count)

  const visitsSorted = [...profile.visits].sort((a, b) => b.visitedAt - a.visitedAt)
  const visitCount = profile.visits.length
  const dynastyCount = dynastyVisitCount.size
  const cityCount = new Set(
    visitsSorted.map((v) => museumById.get(v.museumId)?.city).filter((c): c is string => !!c),
  ).size
  const rank = collectorRank(visitCount)

  let no = 0
  const secHead = (title: string, en: string, meta = "") => {
    no++
    return `<div class="page-sec-head"><span class="no">${String(no).padStart(2, "0")}</span><h2>${title}</h2><span class="en">${en}</span>${meta ? `<span class="meta">${meta}</span>` : ""}</div>`
  }

  const sealCells = visitsSorted
    .map((v) => {
      const m = museumById.get(v.museumId)
      if (!m) return ""
      const seal = m.seal ?? sealSpec(m.id, m.name, m.city)
      return `<a class="seal-cell" href="${mapBase}#/m/${encodeURIComponent(m.id)}" title="${esc(m.name)}">
        <span class="seal-cell-art">${sealMarkup(seal)}</span>
        <span class="seal-cell-name">${esc(m.name)}</span>
        <span class="seal-cell-date">${esc(fmtDate(v.visitedAt))}</span>
      </a>`
    })
    .join("")

  const wallBlock = `<section class="page-sec">
      ${secHead("馆印", "SEALS", `${visitCount} 枚`)}
      ${visitCount
        ? `<div class="seal-wall profile-wall">${sealCells}</div>`
        : `<div class="page-empty">${sealMarkup({ t: "待印", s: 0, y: 0, r: -6 })}<div>集章册还空着——下一座博物馆，就是第一枚印。</div></div>`}
    </section>`

  const reviewBlock = profile.review
    ? `<section class="page-sec">
        ${secHead("讲解员的读后感", "AI NOTES", `${esc(fmtDate(profile.review.generatedAt))} · 读了 ${profile.review.count} 枚`)}
        <div class="guide-card md-rich profile-review">${renderMd(profile.review.summary)}</div>
      </section>`
    : ""

  const dynastyBlock = dynastyCards.length
    ? `<section class="page-sec">
        ${secHead("朝代读后感", "BY DYNASTY", `${dynastyCards.length} 个朝代`)}
        <div class="dyn-notes">
          ${dynastyCards
            .map(({ d, r, count }) => {
              const html = renderMd(r.summary)
              const long = (r.summary || "").length > 280
              const body = long
                ? `<details><summary><div class="clip md-rich">${html}</div><span class="toggle"><span class="more-text">展开全文</span><span class="less-text">收起</span></span></summary></details>`
                : `<div class="md-rich">${html}</div>`
              return `<article class="dyn-note">
                <div class="dyn-note-head">
                  <span class="dyn-note-name">${esc(d.name.replace(/[（(][^)）]*[)）]\s*$/, "").trim())}</span>
                  <span class="dyn-note-period">${esc(d.period || "")}</span>
                  <span class="dyn-note-count"><b>${count}</b> 枚相关馆印 · ${esc(fmtDate(r.generatedAt))}</span>
                </div>
                ${body}
                <a class="dyn-note-go" href="${mapBase}#/d/${encodeURIComponent(d.id)}">${icon("layers", 14)}在时空里看这一层</a>
              </article>`
            })
            .join("")}
        </div>
      </section>`
    : ""

  const noted = visitsSorted.filter((v) => v.note && museumById.has(v.museumId))
  const notesBlock = noted.length
    ? `<section class="page-sec">
        ${secHead("手记", "NOTES", `${noted.length} 则`)}
        <ul class="note-list">
          ${noted
            .map((v) => {
              const m = museumById.get(v.museumId)!
              return `<li class="note-item">
                <span>${sealMarkup(m.seal ?? sealSpec(m.id, m.name, m.city), "seal-sm")}</span>
                <div>
                  <div><span class="note-name">${esc(m.name)}</span><span class="note-date">${esc(fmtDate(v.visitedAt))}</span></div>
                  <div class="note-text">${esc(v.note)}</div>
                </div>
              </li>`
            })
            .join("")}
        </ul>
      </section>`
    : ""

  const isOwn = !!(selfUser && selfUser.handle && selfUser.handle === handle)
  const topLinks =
    `<a class="btn btn-ghost" href="/plaza">${icon("users", 15)}广场</a>` +
    (selfUser?.handle && !isOwn
      ? `<a class="btn btn-ghost" href="/u/${encodeURIComponent(selfUser.handle)}">${icon("seal", 15)}我的</a>`
      : "")

  return Layout({
    title: `${displayName} 的集章册 · 中国博物馆地图`,
    children: `<div class="page"><div class="page-inner">
      ${PageTop(topLinks)}

      <header class="page-head">
        <div class="hero-kicker">${icon("seal", 15)}<span>${isOwn ? "我的集章册" : "集章册"}</span><span class="mono">PASSPORT · VOL.${visitCount}</span></div>
        <div class="profile-id">
          <span class="who-avatar">${esc(initial)}</span>
          <div style="min-width:0">
            <h1 class="hero-title">${esc(displayName)}</h1>
            <div class="profile-handle">@${esc(handle)}</div>
          </div>
        </div>
        <div class="rank-line">
          <span class="rank-badge">${esc(rank.title)}</span>
          <span class="rank-next">${rank.next ? `再集 ${rank.next.at - visitCount} 枚 → ${esc(rank.next.title)}` : "已是最高称号"}</span>
        </div>
        <div class="hero-stats">
          <div class="stat"><b>${visitCount}</b><span>枚馆印</span></div>
          <div class="stat"><b>${dynastyCount}/${dynasties.length}</b><span>朝代地层</span></div>
          <div class="stat"><b>${cityCount}</b><span>座城市</span></div>
        </div>
      </header>

      ${wallBlock}
      ${reviewBlock}
      ${dynastyBlock}
      ${notesBlock}

      <div class="page-actions">
        <a class="btn btn-primary" href="${mapBase}">${icon("layers", 16)}在时空里看${isOwn ? "我" : " TA "}的足迹</a>
        ${isOwn ? `<a class="btn btn-ghost" href="/">${icon("share", 16)}回到地图，寄一卷</a>` : ""}
        ${isOwn ? `<a class="btn btn-text" href="/">${icon("arrowLeft", 15)}回到我的地图</a>` : `<a class="btn btn-text" href="/">${icon("arrowUpRight", 15)}我也来集章</a>`}
      </div>
      <div class="page-foot">WHERE TIME MEETS PLACE</div>
    </div></div>`,
  })
}
