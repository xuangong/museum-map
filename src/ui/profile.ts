import type { MuseumListItem, DynastyFull } from "~/repo/types"
import { Layout } from "./layout"

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
    const line = lines[i]
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${lines[i].replace(/^\s*[-*]\s+/, "")}</li>`)
        i++
      }
      out.push(`<ul>${items.join("")}</ul>`)
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${lines[i].replace(/^\s*\d+\.\s+/, "")}</li>`)
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
  const initial = (displayName || "·").trim().charAt(0)

  // Group visits by dynasty using each museum's corePeriod → best-effort match.
  // (We keep it simple: count visits per dynasty by looking at dynasty.recommended_museums and connections.)
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

  // Sort dynasty review cards by visit count (richer first), then by order_index.
  const dynastyCards = profile.dynastyReviews
    .map((r) => {
      const d = dynastyById.get(r.dynastyId)
      return d ? { d, r, count: dynastyVisitCount.get(d.id) ?? r.count } : null
    })
    .filter((x): x is { d: DynastyFull; r: ProfileData["dynastyReviews"][number]; count: number } => !!x)
    .sort((a, b) => b.count - a.count)

  // Recent visits, newest first.
  const visitsSorted = [...profile.visits].sort((a, b) => b.visitedAt - a.visitedAt)
  const recentVisits = visitsSorted.slice(0, 12)

  const visitCount = profile.visits.length
  const dynastyCount = dynastyVisitCount.size

  const css = `
  body { background: var(--paper); margin: 0; }
  .profile-wrap {
    max-width: 760px; margin: 0 auto; padding: 56px 32px 96px;
    color: var(--ink); font-family: var(--display);
  }
  .profile-head { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; padding-bottom: 28px; border-bottom: 0.5px solid var(--rule); }
  .profile-avatar {
    width: 76px; height: 76px; border-radius: 50%;
    background: var(--vermilion); color: var(--paper);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--display); font-weight: 700; font-size: 36px; flex: 0 0 auto;
  }
  .profile-name { font-family: var(--display); font-weight: 700; font-size: 32px; line-height: 1.1; margin: 0 0 6px; }
  .profile-handle { font-family: var(--mono); font-size: 13px; color: var(--ink-mid); }
  .profile-stats { display: flex; gap: 28px; margin-top: 12px; font-family: var(--sans); font-size: 12px; letter-spacing: 0.06em; color: var(--ink-mid); }
  .profile-stats strong { color: var(--vermilion); font-variant-numeric: lining-nums; font-weight: 600; }
  .profile-section { margin-top: 36px; }
  .profile-section-eyebrow { font-family: var(--sans); font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--vermilion); margin-bottom: 12px; }
  .profile-review { font-family: var(--display); font-size: 18px; line-height: 1.65; }
  .profile-review p { margin: 0 0 14px; }
  .profile-review strong { color: var(--vermilion); }
  .profile-review em { color: var(--ink-mid); }
  .profile-review ul, .profile-review ol { padding-left: 22px; margin: 8px 0 14px; }
  .profile-review h1, .profile-review h2, .profile-review h3 { font-family: var(--display); font-weight: 700; margin: 18px 0 8px; }
  .profile-review h1 { font-size: 24px; }
  .profile-review h2 { font-size: 21px; }
  .profile-review h3 { font-size: 18px; color: var(--vermilion); }
  .profile-review blockquote { border-left: 3px solid var(--vermilion); margin: 12px 0; padding: 4px 0 4px 16px; color: var(--ink-mid); font-style: italic; }
  .profile-review code { font-family: var(--mono); font-size: 14px; background: var(--paper-deep); padding: 1px 5px; }
  .profile-review pre { background: var(--paper-deep); padding: 10px 14px; overflow-x: auto; }
  .profile-review hr { border: none; border-top: 0.5px solid var(--rule-soft); margin: 16px 0; }
  .profile-review a { color: var(--vermilion); }
  .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 600px) { .profile-grid { grid-template-columns: 1fr; } }
  .dyn-card { display: block; border: 0.5px solid var(--rule); padding: 16px 18px; background: var(--paper-elev); color: var(--ink); text-decoration: none; transition: border-color 0.12s; }
  .dyn-card:hover { border-color: var(--vermilion); }
  .dyn-card .name { font-family: var(--display); font-weight: 600; font-size: 19px; }
  .dyn-card .period { font-family: var(--mono); font-size: 11px; color: var(--ink-mid); margin: 2px 0 8px; }
  .dyn-card .count { font-family: var(--sans); font-size: 11px; color: var(--vermilion); letter-spacing: 0.08em; margin-bottom: 8px; }
  .dyn-card .body { font-family: var(--display); font-size: 14px; line-height: 1.6; color: var(--ink); }
  .dyn-card .body p { margin: 0 0 8px; }
  .dyn-card .body p:last-child { margin-bottom: 0; }
  .dyn-card .body strong { color: var(--vermilion); }
  .dyn-card .body em { color: var(--ink-mid); }
  .dyn-card .body ul, .dyn-card .body ol { padding-left: 18px; margin: 6px 0 8px; }
  .dyn-card .body h1, .dyn-card .body h2, .dyn-card .body h3 { font-family: var(--display); font-weight: 600; margin: 10px 0 6px; }
  .dyn-card .body h1 { font-size: 18px; }
  .dyn-card .body h2 { font-size: 16px; }
  .dyn-card .body h3 { font-size: 14px; color: var(--vermilion); }
  .dyn-card .body blockquote { border-left: 2px solid var(--vermilion); margin: 8px 0; padding: 2px 0 2px 12px; color: var(--ink-mid); font-style: italic; }
  .dyn-card .body code { font-family: var(--mono); font-size: 12px; background: var(--paper-deep); padding: 1px 4px; }
  .dyn-card .body hr { border: none; border-top: 0.5px solid var(--rule-soft); margin: 10px 0; }
  /* Expand/collapse for long reviews via <details>/<summary>.
     Default = 10 lines with a fade mask + a small "展开全文" hint at bottom.
     The whole summary (including body preview area) is clickable. */
  .dyn-card details { margin: 0; }
  .dyn-card details > summary { list-style: none; cursor: pointer; display: block; position: relative; }
  .dyn-card details > summary::-webkit-details-marker { display: none; }
  .dyn-card details .body-clip { max-height: 16em; overflow: hidden; position: relative; transition: max-height 0.18s ease; }
  .dyn-card details[open] .body-clip { max-height: none; overflow: visible; }
  .dyn-card details .body-clip::after {
    content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4em;
    background: linear-gradient(to bottom, transparent, var(--paper-elev) 80%);
    pointer-events: none; transition: opacity 0.18s ease;
  }
  .dyn-card details[open] .body-clip::after { opacity: 0; }
  .dyn-card .toggle-hint {
    display: block; margin-top: 8px;
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--vermilion); text-align: center;
    border-top: 0.5px dashed var(--vermilion-soft); padding-top: 8px;
  }
  .dyn-card details[open] .toggle-hint .more-text { display: none; }
  .dyn-card details:not([open]) .toggle-hint .less-text { display: none; }
  .dyn-card .more { display: inline-block; margin-top: 12px; font-family: var(--sans); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-mid); border-bottom: 0.5px solid var(--ink-mid); padding-bottom: 1px; }
  .visit-list { list-style: none; padding: 0; margin: 0; }
  .visit-item { display: grid; grid-template-columns: 88px 1fr; gap: 14px; padding: 10px 0; border-bottom: 0.5px solid var(--rule-soft); align-items: baseline; }
  .visit-item:last-child { border-bottom: none; }
  .visit-date { font-family: var(--mono); font-size: 12px; color: var(--ink-mid); font-variant-numeric: lining-nums; }
  .visit-name { font-family: var(--display); font-size: 16px; font-weight: 500; }
  .visit-note { font-family: var(--display); font-style: italic; color: var(--ink-mid); font-size: 13px; margin-top: 2px; }
  .cta-row { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; padding-top: 28px; border-top: 0.5px solid var(--rule); }
  .cta-primary { background: var(--vermilion); color: var(--paper); padding: 12px 22px; font-family: var(--sans); font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; text-decoration: none; }
  .cta-secondary { background: transparent; color: var(--vermilion); padding: 12px 0; font-family: var(--sans); font-size: 12px; letter-spacing: 0.22em; text-transform: uppercase; text-decoration: none; border-bottom: 0.5px solid var(--vermilion); }
  .footer-meta { margin-top: 56px; padding-top: 18px; border-top: 0.5px solid var(--rule); font-family: var(--sans); font-size: 11px; letter-spacing: 0.08em; color: var(--ink-mid); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .footer-meta a { color: var(--vermilion); text-decoration: none; }
  .empty { font-family: var(--display); font-style: italic; color: var(--ink-mid); padding: 16px 0; }
  `

  const reviewBlock = profile.review
    ? `<section class="profile-section">
        <div class="profile-section-eyebrow">AI 总评 · ${esc(fmtDate(profile.review.generatedAt))} · 基于 ${profile.review.count} 馆</div>
        <div class="profile-review">${renderMd(profile.review.summary)}</div>
      </section>`
    : ""

  const dynastyBlock = dynastyCards.length
    ? `<section class="profile-section">
        <div class="profile-section-eyebrow">朝代品鉴 · ${dynastyCards.length} 朝</div>
        <div class="profile-grid">
          ${dynastyCards
            .map(({ d, r, count }) => {
              const html = renderMd(r.summary)
              const long = (r.summary || "").length > 280
              const mapHref = `/u/${encodeURIComponent(handle)}/map#/d/${encodeURIComponent(d.id)}`
              const bodyBlock = long
                ? `<details>
                    <summary>
                      <div class="body-clip">${html}</div>
                      <span class="toggle-hint"><span class="more-text">展开全文 ↓</span><span class="less-text">收起 ↑</span></span>
                    </summary>
                  </details>`
                : html
              return `<div class="dyn-card">
                <div class="name">${esc(d.name)}</div>
                <div class="period">${esc(d.period || "")}</div>
                <div class="count">打卡 ${count} 馆 · ${esc(fmtDate(r.generatedAt))}</div>
                <div class="body">${bodyBlock}</div>
                <a class="more" href="${mapHref}" title="在地图上查看 ${esc(d.name)}">在地图上查看 →</a>
              </div>`
            })
            .join("")}
        </div>
      </section>`
    : ""

  const visitsBlock = recentVisits.length
    ? `<section class="profile-section">
        <div class="profile-section-eyebrow">最近足迹 · 共 ${visitCount} 馆</div>
        <ul class="visit-list">
          ${recentVisits
            .map((v) => {
              const m = museumById.get(v.museumId)
              const name = m?.name || v.museumId
              return `<li class="visit-item">
                <span class="visit-date">${esc(fmtDate(v.visitedAt))}</span>
                <div>
                  <div class="visit-name">${esc(name)}</div>
                  ${v.note ? `<div class="visit-note">${esc(v.note)}</div>` : ""}
                </div>
              </li>`
            })
            .join("")}
        </ul>
      </section>`
    : `<section class="profile-section">
        <div class="profile-section-eyebrow">足迹</div>
        <div class="empty">还没有公开的打卡记录。</div>
      </section>`

  const isOwn = !!(selfUser && selfUser.handle && selfUser.handle === handle)
  const selfLink = selfUser?.handle && !isOwn
    ? `<a href="/u/${encodeURIComponent(selfUser.handle)}">我的主页 →</a>`
    : ``

  return Layout({
    title: `${displayName} 的足迹 · 中国博物馆地图`,
    head: `<style>${css}</style>`,
    children: `<div class="profile-wrap">
      <header class="profile-head">
        <div class="profile-avatar">${esc(initial)}</div>
        <div>
          <h1 class="profile-name">${esc(displayName)}</h1>
          <div class="profile-handle">@${esc(handle)}</div>
          <div class="profile-stats">
            <span>打卡 <strong>${visitCount}</strong> 馆</span>
            <span>跨越 <strong>${dynastyCount}</strong> 朝</span>
            ${profile.review ? `<span>AI 评 <strong>${profile.review.count}</strong></span>` : ""}
          </div>
        </div>
      </header>

      ${reviewBlock}
      ${dynastyBlock}
      ${visitsBlock}

      <div class="cta-row">
        <a class="cta-primary" href="/u/${encodeURIComponent(handle)}/map">在地图上查看 →</a>
        ${isOwn ? `<a class="cta-secondary" href="/">← 我的地图</a>` : `<a class="cta-secondary" href="/">访问中国博物馆地图</a>`}
      </div>

      <div class="footer-meta">
        <span>中国博物馆地图 · An Atlas of Chinese Museums</span>
        ${selfLink}
      </div>
    </div>`,
  })
}
