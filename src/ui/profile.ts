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
    max-width: 720px; margin: 0 auto; padding: 88px 36px 120px;
    color: var(--ink); font-family: var(--display);
  }
  @media (max-width: 600px) { .profile-wrap { padding: 56px 22px 88px; } }

  /* —— 刊头：编号 / 日期 —— */
  .profile-masthead {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--ink-mid);
    padding-bottom: 14px; border-bottom: 0.5px solid var(--rule);
    margin-bottom: 56px;
  }
  .profile-masthead .left { color: var(--vermilion); }

  /* —— 头部：头像 + 大字主标 —— */
  .profile-head { margin-bottom: 72px; }
  .profile-head-row {
    display: flex; align-items: center; gap: 22px; margin-bottom: 0;
  }
  .profile-head-text { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .profile-avatar {
    width: 88px; height: 88px; border-radius: 50%;
    background: var(--vermilion); color: var(--paper);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--display); font-weight: 600; font-size: 40px;
    letter-spacing: 0; flex: 0 0 auto;
  }
  .profile-name {
    font-family: var(--display); font-weight: 400; font-size: 56px;
    line-height: 1.04; letter-spacing: -0.015em; margin: 0;
  }
  @media (max-width: 600px) {
    .profile-name { font-size: 36px; }
    .profile-avatar { width: 68px; height: 68px; font-size: 30px; }
    .profile-head-row { gap: 16px; }
  }
  .profile-handle {
    font-family: var(--mono); font-size: 12px; color: var(--ink-mid);
    letter-spacing: 0.02em;
  }
  .profile-stats {
    display: flex; gap: 0; margin-top: 32px;
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ink-mid);
  }
  .profile-stats > span {
    flex: 1; padding: 14px 0 0; border-top: 0.5px solid var(--rule);
    display: flex; flex-direction: column; gap: 6px;
  }
  .profile-stats > span + span { padding-left: 18px; }
  .profile-stats strong {
    display: block; color: var(--ink);
    font-family: var(--display); font-weight: 400; font-size: 28px;
    font-variant-numeric: oldstyle-nums;
    letter-spacing: 0; text-transform: none;
  }

  /* —— 分节 eyebrow：编号 + 标签 —— */
  .profile-section { margin-top: 64px; }
  .profile-section-eyebrow {
    display: flex; align-items: baseline; gap: 14px;
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--ink-mid);
    margin-bottom: 28px; padding-bottom: 12px;
    border-bottom: 0.5px solid var(--rule);
  }
  .profile-section-eyebrow .num {
    font-family: var(--mono); color: var(--vermilion);
    font-size: 11px; letter-spacing: 0.04em;
  }
  .profile-section-eyebrow .label { flex: 1; }
  .profile-section-eyebrow .meta { color: var(--ink-mid); letter-spacing: 0.18em; }

  .profile-review { font-family: var(--display); font-size: 17px; line-height: 1.78; color: var(--ink); }
  .profile-review > p:first-child::first-letter {
    font-family: var(--display); font-weight: 400;
    float: left; font-size: 56px; line-height: 0.92;
    padding: 6px 10px 0 0; color: var(--vermilion);
  }
  .profile-review p { margin: 0 0 16px; }
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
  .profile-grid { display: grid; grid-template-columns: 1fr; gap: 0; }
  .dyn-card {
    display: block; padding: 28px 0; background: transparent;
    color: var(--ink); text-decoration: none;
    border-bottom: 0.5px solid var(--rule-soft);
  }
  .dyn-card:last-child { border-bottom: none; }
  .dyn-card:hover .name { color: var(--vermilion); }
  .dyn-card .head-row {
    display: flex; align-items: baseline; gap: 12px;
    margin-bottom: 4px;
  }
  .dyn-card .name {
    font-family: var(--display); font-weight: 400; font-size: 28px;
    letter-spacing: -0.01em; line-height: 1.1;
    transition: color 0.12s;
  }
  .dyn-card .period { font-family: var(--mono); font-size: 11px; color: var(--ink-mid); flex: 1; }
  .dyn-card .count {
    font-family: var(--sans); font-size: 10px; color: var(--ink-mid);
    letter-spacing: 0.22em; text-transform: uppercase;
    margin-bottom: 16px;
  }
  .dyn-card .count strong { color: var(--vermilion); font-weight: 400; font-family: var(--display); font-size: 13px; letter-spacing: 0; }
  .dyn-card .body { font-family: var(--display); font-size: 15px; line-height: 1.72; color: var(--ink); }
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
    background: linear-gradient(to bottom, transparent, var(--paper) 80%);
    pointer-events: none; transition: opacity 0.18s ease;
  }
  .dyn-card details[open] .body-clip::after { opacity: 0; }
  .dyn-card .toggle-hint {
    display: inline-block; margin-top: 12px;
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--vermilion);
  }
  .dyn-card details[open] .toggle-hint .more-text { display: none; }
  .dyn-card details:not([open]) .toggle-hint .less-text { display: none; }
  .dyn-card .more {
    display: inline-block; margin-top: 16px;
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.24em;
    text-transform: uppercase; color: var(--vermilion);
    text-decoration: none;
  }
  .dyn-card .more:hover { border-bottom: 0.5px solid var(--vermilion); padding-bottom: 1px; }
  .visit-list { list-style: none; padding: 0; margin: 0; }
  .visit-item {
    display: grid; grid-template-columns: 92px 1fr; gap: 22px;
    padding: 16px 0; border-bottom: 0.5px solid var(--rule-soft);
    align-items: baseline;
  }
  .visit-item:last-child { border-bottom: none; }
  .visit-date {
    font-family: var(--mono); font-size: 11px; color: var(--ink-mid);
    font-variant-numeric: lining-nums; letter-spacing: 0.04em;
  }
  .visit-name {
    font-family: var(--display); font-size: 18px; font-weight: 400;
    line-height: 1.3; letter-spacing: -0.005em;
  }
  .visit-note {
    font-family: var(--display); font-style: italic;
    color: var(--ink-mid); font-size: 14px; margin-top: 6px; line-height: 1.55;
  }
  .cta-row {
    display: flex; flex-wrap: wrap; gap: 28px; align-items: baseline;
    margin-top: 64px; padding-top: 32px;
    border-top: 0.5px solid var(--rule);
  }
  .cta-primary {
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.28em;
    text-transform: uppercase; color: var(--vermilion);
    text-decoration: none; padding-bottom: 4px;
    border-bottom: 1px solid var(--vermilion);
  }
  .cta-secondary {
    font-family: var(--sans); font-size: 11px; letter-spacing: 0.28em;
    text-transform: uppercase; color: var(--ink-mid);
    text-decoration: none; padding-bottom: 4px;
    border-bottom: 0.5px solid var(--rule);
  }
  .cta-secondary:hover { color: var(--ink); border-color: var(--ink); }
  .footer-meta {
    margin-top: 88px; padding-top: 18px; border-top: 0.5px solid var(--rule);
    font-family: var(--sans); font-size: 10px; letter-spacing: 0.28em;
    text-transform: uppercase; color: var(--ink-mid);
    display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;
  }
  .footer-meta a { color: var(--vermilion); text-decoration: none; }
  .empty { font-family: var(--display); font-style: italic; color: var(--ink-mid); padding: 16px 0; font-size: 16px; }
  `

  const reviewBlock = profile.review
    ? `<section class="profile-section">
        <div class="profile-section-eyebrow">
          <span class="num">No.01</span>
          <span class="label">AI 总评</span>
          <span class="meta">${esc(fmtDate(profile.review.generatedAt))} · ${profile.review.count} 馆</span>
        </div>
        <div class="profile-review">${renderMd(profile.review.summary)}</div>
      </section>`
    : ""

  const dynastyBlock = dynastyCards.length
    ? `<section class="profile-section">
        <div class="profile-section-eyebrow">
          <span class="num">No.02</span>
          <span class="label">朝代品鉴</span>
          <span class="meta">${dynastyCards.length} 朝</span>
        </div>
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
                <div class="head-row">
                  <span class="name">${esc(d.name.replace(/[（(][^)）]*[)）]\s*$/, "").trim())}</span>
                  <span class="period">${esc(d.period || "")}</span>
                </div>
                <div class="count">打卡 <strong>${count}</strong> 馆 · ${esc(fmtDate(r.generatedAt))}</div>
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
        <div class="profile-section-eyebrow">
          <span class="num">No.03</span>
          <span class="label">最近足迹</span>
          <span class="meta">共 ${visitCount} 馆</span>
        </div>
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
        <div class="profile-section-eyebrow">
          <span class="num">No.03</span>
          <span class="label">足迹</span>
        </div>
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
      <div class="profile-masthead">
        <span class="left">中國博物館地圖 · ATLAS</span>
        <span>个人足迹 · Vol. ${visitCount}</span>
      </div>

      <header class="profile-head">
        <div class="profile-head-row">
          <div class="profile-avatar">${esc(initial)}</div>
          <div class="profile-head-text">
            <h1 class="profile-name">${esc(displayName)}</h1>
            <div class="profile-handle">@${esc(handle)}</div>
          </div>
        </div>
        <div class="profile-stats">
          <span>打卡馆数<strong>${visitCount}</strong></span>
          <span>跨越朝代<strong>${dynastyCount}</strong></span>
          ${profile.review ? `<span>AI 评<strong>${profile.review.count}</strong></span>` : ""}
        </div>
      </header>

      ${reviewBlock}
      ${dynastyBlock}
      ${visitsBlock}

      <div class="cta-row">
        <a class="cta-primary" href="/u/${encodeURIComponent(handle)}/map">在地图上查看 →</a>
        <a class="cta-secondary" href="/u/${encodeURIComponent(handle)}/share">生成分享海报</a>
        <a class="cta-secondary" href="/plaza">← 回广场</a>
        ${isOwn ? `<a class="cta-secondary" href="/">← 我的地图</a>` : `<a class="cta-secondary" href="/">访问中国博物馆地图</a>`}
      </div>

      <div class="footer-meta">
        <span>An Atlas of Chinese Museums</span>
        ${selfLink}
      </div>
    </div>`,
  })
}
