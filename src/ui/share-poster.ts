// Share poster registry. Five editorial templates share the same PoetCopy +
// QR input but render in dramatically different styles. URL ?style= picks one;
// otherwise a deterministic-from-handle pick gives stable surprise per user.

import {
  PAPER, INK, INK_MID, INK_SOFT, VERMILION, VERMILION_SOFT, RULE,
  SERIF, SANS, MONO,
  esc, vCol, bgDefs, bgLayers, masthead, footer, sealStamp, sealRound, qrBlock,
} from "./poster-atoms"

export interface PosterInput {
  displayName: string
  handle: string
  recentMuseums: string[]
  themeWord: string
  poem: string[]
  poemSource: string
  headline: string[]
  qrSvgInner: string
  qrModuleCount: number
  solarTerm: string
  yearZh: string
}

export type PosterStyle = "grid" | "scroll" | "ticket" | "seal" | "archive"

export const POSTER_STYLES: PosterStyle[] = ["grid", "scroll", "ticket", "seal", "archive"]

export const POSTER_STYLE_LABELS: Record<PosterStyle, string> = {
  grid: "窗格",
  scroll: "立轴",
  ticket: "门票",
  seal: "印谱",
  archive: "档案卡",
}

// All templates render at 900×1200 (3:4 — 微信/小红书 friendly).
export const POSTER_W = 900
export const POSTER_H = 1200

export function pickStyle(handle: string, override?: string): PosterStyle {
  if (override && (POSTER_STYLES as string[]).includes(override)) return override as PosterStyle
  // Stable hash → style index.
  let h = 0
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0
  return POSTER_STYLES[h % POSTER_STYLES.length]!
}

export function renderPosterSvg(input: PosterInput, style: PosterStyle): string {
  switch (style) {
    case "scroll":  return renderScroll(input)
    case "ticket":  return renderTicket(input)
    case "seal":    return renderSealCatalog(input)
    case "archive": return renderArchive(input)
    case "grid":
    default:        return renderGrid(input)
  }
}

const W = POSTER_W
const H = POSTER_H

// ============================================================================
// Template 1: GRID (current editorial 窗格)
// ============================================================================
function renderGrid(input: PosterInput): string {
  const padX = 56
  const gridTop = 130
  const gridBottom = 920
  const sepX = 420
  const eyebrow1Y = gridTop + 30
  const eyebrow2Y = gridTop + 560

  // Theme word (left)
  const themeChars = Array.from(input.themeWord).slice(0, 2)
  const themeSize = 150
  const themeTop = eyebrow1Y + 28
  const themeX = padX
  const themeSvg = themeChars
    .map((ch, i) =>
      `<text x="${themeX}" y="${themeTop + i * themeSize + themeSize}" font-family="${SERIF}" font-weight="500" font-size="${themeSize}" fill="${VERMILION}" letter-spacing="-0.04em">${esc(ch)}</text>`,
    )
    .join("")

  // Recent (left bottom)
  const recentItems = input.recentMuseums.slice(0, 6)
  const recentList = recentItems
    .map((m, i) =>
      `<text x="${themeX}" y="${eyebrow2Y + 28 + i * 26}" font-family="${SERIF}" font-size="14" fill="${INK}">${esc(m)}</text>`,
    )
    .join("")

  // Poem (right top)
  const rightX = sepX + 40
  const rightW = W - padX - rightX
  const rightCenterX = rightX + rightW / 2
  const cols = input.poem.slice(0, 2)
  const longest = Math.max(...cols.map((c) => Array.from(c).length), 1)
  const POEM_TOP = eyebrow1Y + 40
  const POEM_BAND = 360
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

  // Headline (right bottom)
  const headTop = eyebrow2Y + 14
  const headSize = 22
  const headLH = headSize * 1.6
  const headSvg = input.headline
    .slice(0, 3)
    .map((line, i) =>
      `<text x="${rightX}" y="${headTop + i * headLH + headSize}" font-family="${SERIF}" font-style="italic" font-weight="400" font-size="${headSize}" fill="${INK}" letter-spacing="0.04em">${esc(line)}</text>`,
    )
    .join("")

  // Bottom: seal + handle + QR
  const sealSize = 96
  const sealX = padX
  const sealY = gridBottom + 48
  const sealChar = (input.displayName || input.handle || "·").trim().charAt(0)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${bgDefs()}
    ${bgLayers(W, H)}
    ${masthead(W, input.solarTerm, input.yearZh, padX)}
    <line x1="${sepX}" y1="${gridTop}" x2="${sepX}" y2="${gridBottom}" stroke="${RULE}" stroke-width="0.4"/>
    <text x="${themeX}" y="${eyebrow1Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">A POSTSCRIPT</text>
    ${themeSvg}
    <text x="${themeX}" y="${eyebrow2Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">RECENT VISITS</text>
    ${recentList}
    <text x="${rightX}" y="${eyebrow1Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">A LINE FROM HISTORY</text>
    ${poemSvg}
    <text x="${sourceX}" y="${sourceY}" font-family="${MONO}" font-size="12" letter-spacing="0.1em" fill="${INK_MID}" text-anchor="middle">— ${esc(input.poemSource)}</text>
    <text x="${rightX}" y="${eyebrow2Y}" font-family="${SANS}" font-size="10" letter-spacing="4" fill="${INK_MID}">EDITOR'S NOTE</text>
    ${headSvg}
    <line x1="${padX}" y1="${gridBottom}" x2="${W - padX}" y2="${gridBottom}" stroke="${RULE}" stroke-width="0.4"/>
    ${sealStamp({ x: sealX, y: sealY, size: sealSize, char: sealChar })}
    <text x="${sealX + sealSize + 24}" y="${sealY + 30}" font-family="${SERIF}" font-weight="500" font-size="22" fill="${INK}">${esc(input.displayName)}</text>
    <text x="${sealX + sealSize + 24}" y="${sealY + 56}" font-family="${MONO}" font-size="12" letter-spacing="0.1em" fill="${INK_MID}">@${esc(input.handle)}</text>
    ${qrBlock({ x: W - 110 - padX, y: gridBottom + 46, size: 110, qrSvgInner: input.qrSvgInner, qrModuleCount: input.qrModuleCount, caption: "SCAN · 同行" })}
    ${footer(W, H, padX)}
  </svg>`
}

// ============================================================================
// Template 2: SCROLL (立轴 — single dominant column, generous whitespace)
// ============================================================================
function renderScroll(input: PosterInput): string {
  const padX = 60
  const cx = W / 2

  // Decorative scroll rods (top + bottom horizontal bars)
  const rodTopY = 130
  const rodBotY = H - 170
  const rodTop = `<line x1="${padX - 20}" y1="${rodTopY}" x2="${W - padX + 20}" y2="${rodTopY}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`
  const rodBot = `<line x1="${padX - 20}" y1="${rodBotY}" x2="${W - padX + 20}" y2="${rodBotY}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`

  // Eyebrow under top rod
  const eyebrow = `<text x="${cx}" y="${rodTopY + 32}" font-family="${SANS}" font-size="10" letter-spacing="0.42em" fill="${INK_MID}" text-anchor="middle">A LINE FROM HISTORY · 立軸</text>`

  // Centered poem dominates middle band; auto-fit so longer poems don't overflow.
  const cols = input.poem.slice(0, 2)
  const longest = Math.max(...cols.map((c) => Array.from(c).length), 1)
  const POEM_TOP = rodTopY + 80
  const POEM_BAND = rodBotY - POEM_TOP - 140 // leave room for source + headline
  const poemSize = Math.min(96, Math.floor(POEM_BAND / (longest * 1.18)))
  const colGap = Math.max(120, poemSize * 1.6)
  let poemSvg = ""
  if (cols.length === 1) {
    poemSvg = vCol(cols[0]!, cx, POEM_TOP, poemSize, VERMILION, 500)
  } else {
    poemSvg =
      vCol(cols[0]!, cx + colGap / 2, POEM_TOP, poemSize, VERMILION, 500) +
      vCol(cols[1]!, cx - colGap / 2, POEM_TOP, poemSize, VERMILION, 500)
  }
  const poemBottom = POEM_TOP + longest * poemSize * 1.18
  const sourceX = cols.length >= 2 ? cx + colGap / 2 : cx
  const sourceSvg = `<text x="${sourceX}" y="${poemBottom + 30}" font-family="${MONO}" font-size="12" letter-spacing="0.1em" fill="${INK_MID}" text-anchor="middle">— ${esc(input.poemSource)}</text>`

  // Theme word — small, off to the side as a 题签 slip (not competing with poem)
  const themeChars = Array.from(input.themeWord).slice(0, 2)
  const slipSize = 22
  const slipX = padX + 12
  const slipTopY = POEM_TOP + 6
  const slipFrame = `<rect x="${slipX - 14}" y="${slipTopY - 16}" width="${slipSize + 28}" height="${themeChars.length * slipSize * 1.4 + 28}" fill="none" stroke="${INK_MID}" stroke-width="0.5"/>`
  const themeSlip = themeChars
    .map((ch, i) => `<text x="${slipX + slipSize / 2}" y="${slipTopY + i * slipSize * 1.4 + slipSize}" font-family="${SERIF}" font-weight="500" font-size="${slipSize}" fill="${INK}" text-anchor="middle">${esc(ch)}</text>`)
    .join("")

  // Headline — italic, centered, just above the bottom rod
  const headBaseY = rodBotY - 50
  const headSvg = input.headline
    .slice(0, 2)
    .map((line, i) =>
      `<text x="${cx}" y="${headBaseY + i * 26}" font-family="${SERIF}" font-style="italic" font-size="17" fill="${INK}" text-anchor="middle" letter-spacing="0.05em">${esc(line)}</text>`,
    )
    .join("")

  // Below the rod: handle/seal/QR strip — laid out within H bounds
  const sealChar = (input.displayName || input.handle || "·").trim().charAt(0)
  const stripY = rodBotY + 30 // safely above bottom

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${bgDefs()}
    ${bgLayers(W, H)}
    ${masthead(W, input.solarTerm, input.yearZh, padX)}
    ${rodTop}
    ${eyebrow}
    ${slipFrame}
    ${themeSlip}
    ${poemSvg}
    ${sourceSvg}
    ${headSvg}
    ${rodBot}
    ${sealRound({ cx: padX + 36, cy: stripY + 36, r: 30, char: sealChar })}
    <text x="${padX + 86}" y="${stripY + 32}" font-family="${SERIF}" font-weight="500" font-size="18" fill="${INK}">${esc(input.displayName)}</text>
    <text x="${padX + 86}" y="${stripY + 54}" font-family="${MONO}" font-size="11" letter-spacing="0.1em" fill="${INK_MID}">@${esc(input.handle)}</text>
    ${qrBlock({ x: W - padX - 70, y: stripY, size: 70, qrSvgInner: input.qrSvgInner, qrModuleCount: input.qrModuleCount })}
  </svg>`
}

// ============================================================================
// Template 3: TICKET (门票 — perforated stub with serial number)
// ============================================================================
function renderTicket(input: PosterInput): string {
  // Outer ticket frame with rounded corners and subtle border.
  const frameX = 40
  const frameY = 40
  const frameW = W - 80
  const frameH = H - 80
  const ticket = `<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" fill="none" stroke="${INK}" stroke-width="1.2" rx="6"/>`

  // Perforation: vertical dashed line splitting ticket into main + stub. Wider stub.
  const perfX = W - 300
  const perf = `<line x1="${perfX}" y1="${frameY + 16}" x2="${perfX}" y2="${frameY + frameH - 16}" stroke="${INK_MID}" stroke-width="0.8" stroke-dasharray="3 5"/>`

  // Header band inside main panel
  const headerY = frameY + 36
  const serial = `<text x="${frameX + 28}" y="${headerY}" font-family="${MONO}" font-size="11" letter-spacing="0.3em" fill="${VERMILION}">No. ${String(input.recentMuseums.length).padStart(4, "0")}</text>`
  const term = `<text x="${perfX - 24}" y="${headerY}" font-family="${MONO}" font-size="11" letter-spacing="0.3em" fill="${INK_MID}" text-anchor="end">${esc(input.solarTerm)} · ${esc(input.yearZh)}</text>`
  const headerRule = `<line x1="${frameX + 28}" y1="${headerY + 16}" x2="${perfX - 24}" y2="${headerY + 16}" stroke="${RULE}" stroke-width="0.4"/>`

  // Title block
  const titleY = headerY + 60
  const title = `<text x="${frameX + 28}" y="${titleY}" font-family="${SANS}" font-size="11" letter-spacing="0.4em" fill="${INK_MID}">ADMIT ONE · 入場券</text>
    <text x="${frameX + 28}" y="${titleY + 32}" font-family="${SERIF}" font-weight="500" font-size="28" fill="${INK}">中國博物館地圖</text>`

  // Theme word — giant, sized to fit main panel width
  const themeChars = Array.from(input.themeWord).slice(0, 2)
  const mainPanelW = perfX - frameX - 56
  const themeSize = Math.min(140, Math.floor(mainPanelW / (themeChars.length * 0.95)))
  const themeTop = titleY + 80
  const themeX = frameX + 28
  const themeSvg = themeChars
    .map((ch, i) =>
      `<text x="${themeX + i * themeSize * 0.95}" y="${themeTop + themeSize}" font-family="${SERIF}" font-weight="500" font-size="${themeSize}" fill="${VERMILION}" letter-spacing="-0.05em">${esc(ch)}</text>`,
    )
    .join("")
  const themeBottom = themeTop + themeSize + 20

  // Headline (italic, below theme)
  const headTop = themeBottom + 50
  const headLines = input.headline.slice(0, 2)
  const headSvg = headLines
    .map((line, i) =>
      `<text x="${frameX + 28}" y="${headTop + i * 30}" font-family="${SERIF}" font-style="italic" font-size="18" fill="${INK}" letter-spacing="0.04em">${esc(line)}</text>`,
    )
    .join("")

  // Recent passages (rows)
  const recentTop = headTop + (headLines.length * 30) + 60
  const recentLabel = `<text x="${frameX + 28}" y="${recentTop}" font-family="${SANS}" font-size="10" letter-spacing="0.4em" fill="${INK_MID}">PASSAGES · 沿途</text>`
  const recentItems = input.recentMuseums.slice(0, 4)
  const recentList = recentItems
    .map((m, i) => {
      const y = recentTop + 30 + i * 28
      return `<text x="${frameX + 28}" y="${y}" font-family="${MONO}" font-size="11" fill="${VERMILION}">${String(i + 1).padStart(2, "0")}</text>
        <text x="${frameX + 70}" y="${y}" font-family="${SERIF}" font-size="15" fill="${INK}">${esc(truncate(m, 16))}</text>`
    })
    .join("")

  // Stub (right of perf): label + vertical poem in middle + seal/QR/handle at bottom
  const stubX = perfX + 20
  const stubW = frameX + frameW - stubX - 20
  const stubCx = stubX + stubW / 2
  const stubLabel = `<text x="${stubCx}" y="${frameY + 56}" font-family="${SANS}" font-size="10" letter-spacing="0.4em" fill="${INK_MID}" text-anchor="middle">STUB · 副券</text>`

  // Poem in stub (vertical) — auto-fit narrow column
  const cols = input.poem.slice(0, 2)
  const longest = Math.max(...cols.map((c) => Array.from(c).length), 1)
  const POEM_TOP = frameY + 110
  const POEM_BAND = 360
  const poemSize = Math.min(38, Math.floor(POEM_BAND / (longest * 1.18)))
  const colGap = Math.min(56, stubW / 3)
  let poemSvg = ""
  if (cols.length === 1) {
    poemSvg = vCol(cols[0]!, stubCx, POEM_TOP, poemSize, VERMILION, 500)
  } else {
    poemSvg =
      vCol(cols[0]!, stubCx + colGap / 2, POEM_TOP, poemSize, VERMILION, 500) +
      vCol(cols[1]!, stubCx - colGap / 2, POEM_TOP, poemSize, VERMILION, 500)
  }
  const poemBottom = POEM_TOP + longest * poemSize * 1.18
  const sourceX = cols.length >= 2 ? stubCx + colGap / 2 : stubCx
  const stubSource = `<text x="${sourceX}" y="${poemBottom + 18}" font-family="${MONO}" font-size="9" letter-spacing="0.1em" fill="${INK_MID}" text-anchor="middle">— ${esc(truncate(input.poemSource, 14))}</text>`

  // Stub bottom — pin to frame bottom, ensure all elements fit. Order from bottom up:
  //   QR bottom edge sits at frameBottom - 40, handle text above it, name above, seal above.
  const sealChar = (input.displayName || input.handle || "·").trim().charAt(0)
  const frameBottom = frameY + frameH
  const qrSize = 86
  const qrX = stubCx - qrSize / 2
  const qrYY = frameBottom - qrSize - 36 // 36 from frame bottom
  const handleY = qrYY - 14
  const nameY = handleY - 18
  const sealSize = 50
  const sealStubY = nameY - sealSize - 18
  const stubBottom = `
    ${sealStamp({ x: stubCx - sealSize / 2, y: sealStubY, size: sealSize, char: sealChar })}
    <text x="${stubCx}" y="${nameY}" font-family="${SERIF}" font-weight="500" font-size="14" fill="${INK}" text-anchor="middle">${esc(truncate(input.displayName, 10))}</text>
    <text x="${stubCx}" y="${handleY}" font-family="${MONO}" font-size="9" letter-spacing="0.1em" fill="${INK_MID}" text-anchor="middle">@${esc(truncate(input.handle, 14))}</text>
    ${qrBlock({ x: qrX, y: qrYY, size: qrSize, qrSvgInner: input.qrSvgInner, qrModuleCount: input.qrModuleCount })}
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${bgDefs()}
    ${bgLayers(W, H)}
    ${ticket}
    ${perf}
    ${serial}
    ${term}
    ${headerRule}
    ${title}
    ${themeSvg}
    ${headSvg}
    ${recentLabel}
    ${recentList}
    ${stubLabel}
    ${poemSvg}
    ${stubSource}
    ${stubBottom}
  </svg>`
}

// ============================================================================
// Template 4: SEAL CATALOG (印谱 — multiple stamps + sparse text)
// ============================================================================
function renderSealCatalog(input: PosterInput): string {
  const padX = 60
  const cx = W / 2

  // Top eyebrow + title (mimics 印谱 booklet plate)
  const topY = 90
  const head = `
    <text x="${cx}" y="${topY}" font-family="${SANS}" font-size="11" letter-spacing="0.5em" fill="${INK_MID}" text-anchor="middle">SEAL CATALOG · 印譜</text>
    <text x="${cx}" y="${topY + 30}" font-family="${SERIF}" font-weight="500" font-size="22" fill="${INK}" text-anchor="middle">中國博物館地圖</text>
    <line x1="${cx - 50}" y1="${topY + 50}" x2="${cx + 50}" y2="${topY + 50}" stroke="${VERMILION}" stroke-width="0.6"/>
  `

  // Big square seal carrying the theme word — centered, sized so corner seals fit
  const cornerSize = 64
  const cornerOff = 40
  // Constrain bigSize so cornerX (= bigX - cornerSize - cornerOff) stays >= padX + 10
  const maxBigForCorners = W - 2 * (padX + 10 + cornerSize + cornerOff)
  const bigSize = Math.min(280, maxBigForCorners)
  const bigX = cx - bigSize / 2
  const bigY = 210
  const themeChars = Array.from(input.themeWord).slice(0, 2)
  const bigCharFontSize = bigSize * 0.36
  // Properly centered: single char at vertical center; two chars at 1/3 and 2/3
  const bigSeal = `
    <g filter="url(#seal-rough)" opacity="0.94">
      <rect x="${bigX}" y="${bigY}" width="${bigSize}" height="${bigSize}" fill="${VERMILION}"/>
      <rect x="${bigX + 14}" y="${bigY + 14}" width="${bigSize - 28}" height="${bigSize - 28}" fill="none" stroke="${PAPER}" stroke-width="3"/>
      ${themeChars.map((ch, i) => {
        // baseline-y; account for font baseline ≈ 0.78 * size
        const yFrac = themeChars.length === 1
          ? 0.5 + 0.25
          : (i === 0 ? 0.30 + 0.13 : 0.70 + 0.13)
        return `<text x="${cx}" y="${bigY + bigSize * yFrac}" font-family="${SERIF}" font-weight="700" font-size="${bigCharFontSize}" fill="${PAPER}" text-anchor="middle">${esc(ch)}</text>`
      }).join("")}
    </g>
  `
  const bigBottom = bigY + bigSize

  // Four corner accent seals (one per corner of the big seal) carrying first chars of recent museums
  const recents = input.recentMuseums.slice(0, 4)
  const cornerPositions = [
    { x: bigX - cornerSize - cornerOff, y: bigY,                        round: false }, // TL
    { x: bigX + bigSize + cornerOff,    y: bigY,                        round: true  }, // TR
    { x: bigX - cornerSize - cornerOff, y: bigY + bigSize - cornerSize, round: true  }, // BL
    { x: bigX + bigSize + cornerOff,    y: bigY + bigSize - cornerSize, round: false }, // BR
  ]
  const corners = recents.map((m, i) => {
    const ch = Array.from(m)[0] ?? "·"
    const p = cornerPositions[i]!
    if (p.round) {
      return sealRound({ cx: p.x + cornerSize / 2, cy: p.y + cornerSize / 2, r: cornerSize / 2, char: ch })
    }
    return sealStamp({ x: p.x, y: p.y, size: cornerSize, char: ch })
  }).join("")

  // Poem block — vertical, fit within available band before bottom strip
  const stripY = H - 140
  const cols = input.poem.slice(0, 2)
  const longest = Math.max(...cols.map((c) => Array.from(c).length), 1)
  const POEM_TOP = bigBottom + 70
  const headlineRoom = 70 // headline + source padding above bottom strip
  const POEM_BAND = stripY - POEM_TOP - headlineRoom
  const poemSize = Math.min(36, Math.floor(POEM_BAND / (longest * 1.18)))
  const colGap = 56
  let poemSvg = ""
  if (cols.length === 1) {
    poemSvg = vCol(cols[0]!, cx, POEM_TOP, poemSize, INK, 500)
  } else {
    poemSvg =
      vCol(cols[0]!, cx + colGap / 2, POEM_TOP, poemSize, INK, 500) +
      vCol(cols[1]!, cx - colGap / 2, POEM_TOP, poemSize, INK, 500)
  }
  const poemBottom = POEM_TOP + longest * poemSize * 1.18
  const sourceX = cols.length >= 2 ? cx + colGap / 2 : cx
  const sourceSvg = `<text x="${sourceX}" y="${poemBottom + 22}" font-family="${MONO}" font-size="11" letter-spacing="0.1em" fill="${INK_MID}" text-anchor="middle">— ${esc(input.poemSource)}</text>`

  // Headline (italic, beneath poem source) — single line to avoid crowding
  const headTop = poemBottom + 50
  const headSvg = input.headline
    .slice(0, 1)
    .map((line) =>
      `<text x="${cx}" y="${headTop}" font-family="${SERIF}" font-style="italic" font-size="16" fill="${INK_MID}" text-anchor="middle">${esc(truncate(line, 40))}</text>`,
    )
    .join("")

  // Bottom strip: rule + handle + QR
  const bottom = `
    <line x1="${padX}" y1="${stripY}" x2="${W - padX}" y2="${stripY}" stroke="${RULE}" stroke-width="0.4"/>
    <text x="${padX}" y="${stripY + 30}" font-family="${SERIF}" font-weight="500" font-size="20" fill="${INK}">${esc(input.displayName)}</text>
    <text x="${padX}" y="${stripY + 52}" font-family="${MONO}" font-size="11" letter-spacing="0.1em" fill="${INK_MID}">@${esc(input.handle)} · ${esc(input.solarTerm)} · ${esc(input.yearZh)}</text>
    ${qrBlock({ x: W - 80 - padX, y: stripY + 14, size: 80, qrSvgInner: input.qrSvgInner, qrModuleCount: input.qrModuleCount })}
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${bgDefs()}
    ${bgLayers(W, H)}
    ${head}
    ${corners}
    ${bigSeal}
    ${poemSvg}
    ${sourceSvg}
    ${headSvg}
    ${bottom}
  </svg>`
}

// ============================================================================
// Template 5: ARCHIVE (档案卡 — museum specimen card style)
// ============================================================================
function renderArchive(input: PosterInput): string {
  const padX = 56
  const innerX = padX + 8
  const innerW = W - 2 * (padX + 8)

  // Outer card frame
  const frameTop = 110
  const frameBot = H - 70
  const frame = `<rect x="${padX - 8}" y="${frameTop}" width="${W - 2 * (padX - 8)}" height="${frameBot - frameTop}" fill="none" stroke="${INK}" stroke-width="1.2"/>`
  const innerFrame = `<rect x="${padX}" y="${frameTop + 8}" width="${W - 2 * padX}" height="${frameBot - frameTop - 16}" fill="none" stroke="${INK}" stroke-width="0.4"/>`

  // Top row inside frame: catalog header
  const headerY = frameTop + 38
  const header = `
    <text x="${innerX + 10}" y="${headerY}" font-family="${MONO}" font-size="11" letter-spacing="0.32em" fill="${VERMILION}">SPECIMEN · 藏品卡</text>
    <text x="${W - innerX - 10}" y="${headerY}" font-family="${MONO}" font-size="11" letter-spacing="0.32em" fill="${INK_MID}" text-anchor="end">CAT. ${(input.handle || "0000").slice(0, 6).toUpperCase()}</text>
    <line x1="${innerX + 10}" y1="${headerY + 14}" x2="${W - innerX - 10}" y2="${headerY + 14}" stroke="${RULE}" stroke-width="0.4"/>
  `

  // Specimen name = theme word — auto-fit to inner width
  const themeChars = Array.from(input.themeWord).slice(0, 2)
  const themeMaxW = innerW - 20
  const themeSize = Math.min(160, Math.floor(themeMaxW / Math.max(themeChars.length, 1) / 1.05))
  const themeY = headerY + themeSize + 50
  const themeSvg = `<text x="${innerX + 10}" y="${themeY}" font-family="${SERIF}" font-weight="500" font-size="${themeSize}" fill="${INK}" letter-spacing="0.04em">${esc(themeChars.join(""))}</text>`

  // Decorative subtitle
  const subY = themeY + 36
  const sub = `<text x="${innerX + 10}" y="${subY}" font-family="${MONO}" font-size="10" letter-spacing="0.4em" fill="${INK_MID}">SPECIES · ${esc(input.solarTerm)} · ${esc(input.yearZh)}</text>`

  // Field rows — fit before bottom seal/QR area
  const bottomReserved = 200 // space at bottom for seal + QR
  const fieldsTop = subY + 50
  const fieldsAvailable = frameBot - bottomReserved - fieldsTop
  type Row = { label: string; value: string; mono?: boolean; italic?: boolean; vermilion?: boolean }
  const rows: Row[] = [
    { label: "題詩 · LINE",          value: input.poem.join("，"),                               vermilion: true },
    { label: "出處 · SOURCE",        value: input.poemSource,                                    mono: true },
    { label: "評註 · NOTE",          value: input.headline.join(" / "),                          italic: true },
    { label: "履歷 · PASSAGES",      value: input.recentMuseums.slice(0, 5).join(" · ") },
    { label: "編錄 · ARCHIVED BY",   value: `${input.displayName} (@${input.handle})` },
  ]
  const fieldGap = Math.min(64, Math.floor(fieldsAvailable / rows.length))
  // Truncation tuned for innerW≈776 at 17px serif (~36 cjk-equivalent chars)
  const VAL_MAX = 36
  const fieldRows = rows
    .map((r, i) => {
      const y = fieldsTop + i * fieldGap
      const labelEl = `<text x="${innerX + 10}" y="${y}" font-family="${SANS}" font-size="9" letter-spacing="0.32em" fill="${VERMILION}">${esc(r.label)}</text>`
      const valFont = r.mono ? MONO : SERIF
      const valStyle = r.italic ? `font-style="italic" ` : ""
      const valColor = r.vermilion ? VERMILION : INK
      const valSize = r.italic ? 17 : (r.vermilion ? 21 : 16)
      const valEl = `<text x="${innerX + 10}" y="${y + 26}" font-family="${valFont}" ${valStyle}font-size="${valSize}" fill="${valColor}" letter-spacing="0.05em">${esc(truncate(r.value, VAL_MAX))}</text>`
      const rule = `<line x1="${innerX + 10}" y1="${y + fieldGap - 8}" x2="${W - innerX - 10}" y2="${y + fieldGap - 8}" stroke="${RULE}" stroke-width="0.3"/>`
      return labelEl + valEl + rule
    })
    .join("")

  // Bottom-left seal + caption
  const sealChar = (input.displayName || input.handle || "·").trim().charAt(0)
  const sealY = frameBot - 130
  const sealSize = 80
  const sealEl = sealStamp({ x: innerX + 10, y: sealY, size: sealSize, char: sealChar })
  const sealCaption = `<text x="${innerX + 10}" y="${sealY + sealSize + 18}" font-family="${MONO}" font-size="9" letter-spacing="0.32em" fill="${INK_MID}">SEAL · 鑑藏印</text>`

  // Bottom-right QR
  const qrSize = 96
  const qrX = W - innerX - 10 - qrSize
  const qrY = frameBot - 140
  const qrEl = qrBlock({ x: qrX, y: qrY, size: qrSize, qrSvgInner: input.qrSvgInner, qrModuleCount: input.qrModuleCount, caption: "SCAN · 同行" })

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    ${bgDefs()}
    ${bgLayers(W, H)}
    ${masthead(W, input.solarTerm, input.yearZh, padX)}
    ${frame}
    ${innerFrame}
    ${header}
    ${themeSvg}
    ${sub}
    ${fieldRows}
    ${sealEl}
    ${sealCaption}
    ${qrEl}
    ${footer(W, H, padX)}
  </svg>`
}

function truncate(s: string, n: number): string {
  const arr = Array.from(s)
  return arr.length > n ? arr.slice(0, n - 1).join("") + "…" : s
}
