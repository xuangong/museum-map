// Server-rendered share poster (SVG, 800×1200).
//
// Layout:
//   - Top masthead: 「中國博物館地圖」 (left) | 「立夏 · 二〇二六」 (right)
//   - Two-column grid:
//       LEFT (350px wide):  巨字「主题字」 + 近访列表
//       RIGHT (~390px):     古诗（双列竖排堆叠）+ 出处 + 金句
//   - Bottom: 朱色印章（用户首字） + handle + QR
//   - Background: 极淡水墨晕染 (radial gradient) 在右上和左下角
//
// Vertical text rendered as stacked per-glyph <text> for cross-renderer reliability.

const W = 900
const H = 1200

const PAPER = "#F4EFE3"
const INK = "#1B1A17"
const INK_MID = "#6B6760"
const INK_SOFT = "#8C8676"
const VERMILION = "#B73E18"
const VERMILION_SOFT = "#D86A48"
const RULE = "#C8C0AE"
const SERIF = "'Noto Serif SC','Source Serif 4',serif"
const SANS = "'Source Serif 4','Noto Serif SC',serif"
const MONO = "'JetBrains Mono',ui-monospace,monospace"

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export interface PosterInput {
  displayName: string
  handle: string
  recentMuseums: string[]
  themeWord: string // 2 chars
  poem: string[]
  poemSource: string
  headline: string[]
  qrSvgInner: string
  qrModuleCount: number
  solarTerm: string // 节气名 e.g. "立夏"
  yearZh: string // 年份汉字 e.g. "二〇二六"
}

export const POSTER_W = W
export const POSTER_H = H

/** Stack CJK glyphs vertically as separate <text> elements (right column starts at x). */
function vCol(chars: string, x: number, topY: number, size: number, fill: string, weight = 400): string {
  const lh = size * 1.18
  return Array.from(chars)
    .map(
      (ch, i) =>
        `<text x="${x}" y="${topY + i * lh + size}" font-family="${SERIF}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="middle">${esc(ch)}</text>`,
    )
    .join("")
}

export function renderPosterSvg(input: PosterInput): string {
  // ── background defs (ink-wash gradients + paper texture) ──────────────────
  const defs = `
    <defs>
      <radialGradient id="ink-tr" cx="100%" cy="0%" r="55%">
        <stop offset="0%" stop-color="${VERMILION}" stop-opacity="0.10"/>
        <stop offset="60%" stop-color="${VERMILION}" stop-opacity="0.025"/>
        <stop offset="100%" stop-color="${VERMILION}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="ink-bl" cx="0%" cy="100%" r="60%">
        <stop offset="0%" stop-color="${INK}" stop-opacity="0.07"/>
        <stop offset="55%" stop-color="${INK}" stop-opacity="0.02"/>
        <stop offset="100%" stop-color="${INK}" stop-opacity="0"/>
      </radialGradient>
      <filter id="paper-noise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
        <feColorMatrix values="0 0 0 0 0.42  0 0 0 0 0.40  0 0 0 0 0.34  0 0 0 0.06 0"/>
        <feComposite in2="SourceGraphic" operator="in"/>
      </filter>
      <filter id="seal-rough" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="2" seed="3"/>
        <feDisplacementMap in="SourceGraphic" scale="1.4"/>
      </filter>
    </defs>
  `

  // ── masthead ──────────────────────────────────────────────────────────────
  const masthead = `
    <text x="56" y="74" font-family="${SANS}" font-size="12" letter-spacing="4" fill="${INK_MID}">中國博物館地圖 · ATLAS</text>
    <text x="${W - 56}" y="74" font-family="${MONO}" font-size="12" letter-spacing="3" fill="${VERMILION}" text-anchor="end">${esc(input.solarTerm)} · ${esc(input.yearZh)}</text>
    <line x1="56" y1="92" x2="${W - 56}" y2="92" stroke="${RULE}" stroke-width="0.5"/>
  `

  // ── grid layout ───────────────────────────────────────────────────────────
  // Two columns under masthead. Vertical separator at x = 380.
  const gridTop = 130
  const gridBottom = 920
  const sepX = 420
  const gridSep = `<line x1="${sepX}" y1="${gridTop}" x2="${sepX}" y2="${gridBottom}" stroke="${RULE}" stroke-width="0.4"/>`

  // ── LEFT COLUMN: theme word (huge) + recent list ──────────────────────────
  // Eyebrow row 1 (TOP): A POSTSCRIPT (left) + A LINE FROM HISTORY (right)
  // Eyebrow row 2 (MID): RECENT VISITS (left) + EDITOR'S NOTE (right)
  // These shared baselines are computed up-front so left and right columns
  // line up at the small caps regardless of poem column count or theme size.
  const eyebrow1Y = gridTop + 30
  const eyebrow2Y = gridTop + 560 // mid-band; tuned to clear theme + poem blocks

  // 主题字 — 2 chars, 一字一行，朱色细描
  const themeChars = Array.from(input.themeWord).slice(0, 2)
  const themeSize = 150
  const themeTop = eyebrow1Y + 28 // sits just below the top eyebrow line
  const themeX = 56
  const themeSvg = themeChars
    .map(
      (ch, i) =>
        `<text x="${themeX}" y="${themeTop + i * themeSize * 1.0 + themeSize}" font-family="${SERIF}" font-weight="500" font-size="${themeSize}" fill="${VERMILION}" letter-spacing="-0.04em">${esc(ch)}</text>`,
    )
    .join("")

  const themeEyebrow = `
    <text x="${themeX}" y="${eyebrow1Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">A POSTSCRIPT</text>
  `

  // Recent museums list (left col, anchored to eyebrow2Y baseline)
  const recentLabel = `<text x="${themeX}" y="${eyebrow2Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">RECENT VISITS</text>`
  const recentItems = input.recentMuseums.slice(0, 6)
  const recentList = recentItems
    .map(
      (m, i) =>
        `<text x="${themeX}" y="${eyebrow2Y + 28 + i * 26}" font-family="${SERIF}" font-size="14" fill="${INK}">${esc(m)}</text>`,
    )
    .join("")

  // ── RIGHT COLUMN: poem (vertical) + source + headline ─────────────────────
  const rightX = sepX + 40 // left padding inside right column
  const rightW = W - 56 - rightX
  const rightCenterX = rightX + rightW / 2

  // Poem block — eyebrow shares eyebrow1Y baseline with left column
  const poemEyebrow = `
    <text x="${rightX}" y="${eyebrow1Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">A LINE FROM HISTORY</text>
  `
  const cols = input.poem.slice(0, 2)
  const longest = Math.max(...cols.map((c) => Array.from(c).length), 1)
  const POEM_TOP = eyebrow1Y + 40
  const POEM_BAND = 360 // shrunk to keep poem within top band above eyebrow2Y
  const poemSize = Math.min(64, Math.floor(POEM_BAND / (longest * 1.18)))
  const colGap = 100
  let poemSvg = ""
  if (cols.length === 1) {
    poemSvg = vCol(cols[0]!, rightCenterX, POEM_TOP, poemSize, VERMILION, 500)
  } else if (cols.length >= 2) {
    poemSvg =
      vCol(cols[0]!, rightCenterX + colGap / 2, POEM_TOP, poemSize, VERMILION, 500) +
      vCol(cols[1]!, rightCenterX - colGap / 2, POEM_TOP, poemSize, VERMILION, 500)
  }
  const poemBottom = POEM_TOP + longest * poemSize * 1.18

  const sourceY = poemBottom + 22
  const sourceX = cols.length >= 2 ? rightCenterX + colGap / 2 : rightCenterX
  const poemSourceSvg = `
    <text x="${sourceX}" y="${sourceY}" font-family="${MONO}" font-size="12"
          letter-spacing="0.1em" fill="${INK_MID}" text-anchor="middle">— ${esc(input.poemSource)}</text>
  `

  // Headline eyebrow shares eyebrow2Y baseline with RECENT VISITS
  const headEyebrow = `
    <text x="${rightX}" y="${eyebrow2Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">EDITOR'S NOTE</text>
  `
  const headTop = eyebrow2Y + 14
  const headSize = 22
  const headLH = headSize * 1.6
  const headSvg = input.headline
    .slice(0, 3)
    .map(
      (line, i) =>
        `<text x="${rightX}" y="${headTop + i * headLH + headSize}" font-family="${SERIF}" font-style="italic" font-weight="400" font-size="${headSize}" fill="${INK}" letter-spacing="0.04em">${esc(line)}</text>`,
    )
    .join("")

  // ── Bottom block: seal + handle + QR ──────────────────────────────────────
  const bottomTop = gridBottom + 30 // line below grid
  const gridBottomLine = `<line x1="56" y1="${gridBottom}" x2="${W - 56}" y2="${gridBottom}" stroke="${RULE}" stroke-width="0.4"/>`

  // 朱印 — square seal with displayName initial in 篆-ish serif bold
  const sealSize = 96
  const sealX = 56
  const sealY = bottomTop + 18
  const sealChar = (input.displayName || input.handle || "·").trim().charAt(0)
  const seal = `
    <g filter="url(#seal-rough)" opacity="0.92">
      <rect x="${sealX}" y="${sealY}" width="${sealSize}" height="${sealSize}" fill="${VERMILION}" rx="2"/>
      <rect x="${sealX + 6}" y="${sealY + 6}" width="${sealSize - 12}" height="${sealSize - 12}" fill="none" stroke="${PAPER}" stroke-width="2"/>
      <text x="${sealX + sealSize / 2}" y="${sealY + sealSize / 2 + sealSize * 0.21}" font-family="${SERIF}" font-weight="700" font-size="${sealSize * 0.62}" fill="${PAPER}" text-anchor="middle">${esc(sealChar)}</text>
    </g>
  `

  // Handle + name (right of seal)
  const idX = sealX + sealSize + 24
  const idTop = sealY + 30
  const idSvg = `
    <text x="${idX}" y="${idTop}" font-family="${SERIF}" font-weight="500" font-size="22" fill="${INK}">${esc(input.displayName)}</text>
    <text x="${idX}" y="${idTop + 26}" font-family="${MONO}" font-size="12" letter-spacing="0.1em" fill="${INK_MID}">@${esc(input.handle)}</text>
  `

  // QR (bottom right)
  const qrSize = 110
  const qrX = W - qrSize - 56
  const qrY = bottomTop + 16
  const qrCaptionY = qrY + qrSize + 18
  const qrSvg = `
    <g transform="translate(${qrX} ${qrY})">
      <svg viewBox="0 0 ${input.qrModuleCount} ${input.qrModuleCount}" width="${qrSize}" height="${qrSize}">
        ${input.qrSvgInner}
      </svg>
    </g>
    <text x="${qrX + qrSize / 2}" y="${qrCaptionY}" font-family="${SANS}" font-size="9" letter-spacing="0.32em" fill="${INK_MID}" text-anchor="middle">SCAN · 同行</text>
  `

  // ── footer ────────────────────────────────────────────────────────────────
  const footerY = H - 30
  const footerRuleY = footerY - 22
  const footer = `
    <line x1="56" y1="${footerRuleY}" x2="${W - 56}" y2="${footerRuleY}" stroke="${RULE}" stroke-width="0.5"/>
    <text x="56" y="${footerY}" font-family="${MONO}" font-size="10" letter-spacing="0.2em" fill="${INK_MID}">museum.xianliao.de5.net</text>
    <text x="${W - 56}" y="${footerY}" font-family="${SANS}" font-size="10" letter-spacing="0.4em" fill="${INK_MID}" text-anchor="end">AN ATLAS OF CHINESE MUSEUMS</text>
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${defs}
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <rect width="${W}" height="${H}" fill="url(#ink-tr)"/>
    <rect width="${W}" height="${H}" fill="url(#ink-bl)"/>
    <rect width="${W}" height="${H}" fill="${PAPER}" filter="url(#paper-noise)" opacity="0.5"/>
    ${masthead}
    ${gridSep}
    ${themeEyebrow}
    ${themeSvg}
    ${recentLabel}
    ${recentList}
    ${poemEyebrow}
    ${poemSvg}
    ${poemSourceSvg}
    ${headEyebrow}
    ${headSvg}
    ${gridBottomLine}
    ${seal}
    ${idSvg}
    ${qrSvg}
    ${footer}
  </svg>`
}
