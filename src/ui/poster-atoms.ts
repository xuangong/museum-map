// Shared atoms for share posters: constants, escapes, vertical CJK helper,
// background defs, masthead, footer, seal, QR. Each template module composes
// these freely. Width/height vary per template — atoms accept dimensions where
// relevant and avoid baking in 900×1200.

export const PAPER = "#F4EFE3"
export const INK = "#1B1A17"
export const INK_MID = "#6B6760"
export const INK_SOFT = "#8C8676"
export const VERMILION = "#B73E18"
export const VERMILION_SOFT = "#D86A48"
export const RULE = "#C8C0AE"
export const SERIF = "'Noto Serif SC','Source Serif 4',serif"
export const SANS = "'Source Serif 4','Noto Serif SC',serif"
export const MONO = "'JetBrains Mono',ui-monospace,monospace"

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Stack CJK glyphs vertically as separate <text> elements centered at x. */
export function vCol(chars: string, x: number, topY: number, size: number, fill: string, weight = 400): string {
  const lh = size * 1.18
  return Array.from(chars)
    .map(
      (ch, i) =>
        `<text x="${x}" y="${topY + i * lh + size}" font-family="${SERIF}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="middle">${esc(ch)}</text>`,
    )
    .join("")
}

/** Standard background defs reused by every template. */
export function bgDefs(): string {
  return `
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
}

/** Layered paper background. Caller wraps in <svg>. */
export function bgLayers(W: number, H: number): string {
  return `
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <rect width="${W}" height="${H}" fill="url(#ink-tr)"/>
    <rect width="${W}" height="${H}" fill="url(#ink-bl)"/>
    <rect width="${W}" height="${H}" fill="${PAPER}" filter="url(#paper-noise)" opacity="0.5"/>
  `
}

/** Top masthead: title left, solar term right, rule beneath. */
export function masthead(W: number, solarTerm: string, yearZh: string, padX = 56): string {
  return `
    <text x="${padX}" y="74" font-family="${SANS}" font-size="12" letter-spacing="4" fill="${INK_MID}">中國博物館地圖 · ATLAS</text>
    <text x="${W - padX}" y="74" font-family="${MONO}" font-size="12" letter-spacing="3" fill="${VERMILION}" text-anchor="end">${esc(solarTerm)} · ${esc(yearZh)}</text>
    <line x1="${padX}" y1="92" x2="${W - padX}" y2="92" stroke="${RULE}" stroke-width="0.5"/>
  `
}

export function footer(W: number, H: number, padX = 56): string {
  const footerY = H - 30
  const footerRuleY = footerY - 22
  return `
    <line x1="${padX}" y1="${footerRuleY}" x2="${W - padX}" y2="${footerRuleY}" stroke="${RULE}" stroke-width="0.5"/>
    <text x="${padX}" y="${footerY}" font-family="${MONO}" font-size="10" letter-spacing="0.2em" fill="${INK_MID}">museum.xianliao.de5.net</text>
    <text x="${W - padX}" y="${footerY}" font-family="${SANS}" font-size="10" letter-spacing="0.4em" fill="${INK_MID}" text-anchor="end">AN ATLAS OF CHINESE MUSEUMS</text>
  `
}

/** Vermilion seal stamp with a single CJK initial; flying-white via filter. */
export function sealStamp(opts: { x: number; y: number; size: number; char: string }): string {
  const { x, y, size, char } = opts
  return `
    <g filter="url(#seal-rough)" opacity="0.92">
      <rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${VERMILION}" rx="2"/>
      <rect x="${x + 6}" y="${y + 6}" width="${size - 12}" height="${size - 12}" fill="none" stroke="${PAPER}" stroke-width="2"/>
      <text x="${x + size / 2}" y="${y + size / 2 + size * 0.21}" font-family="${SERIF}" font-weight="700" font-size="${size * 0.62}" fill="${PAPER}" text-anchor="middle">${esc(char)}</text>
    </g>
  `
}

/** Round seal variant. */
export function sealRound(opts: { cx: number; cy: number; r: number; char: string }): string {
  const { cx, cy, r, char } = opts
  return `
    <g filter="url(#seal-rough)" opacity="0.92">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${VERMILION}"/>
      <circle cx="${cx}" cy="${cy}" r="${r - 6}" fill="none" stroke="${PAPER}" stroke-width="2"/>
      <text x="${cx}" y="${cy + r * 0.32}" font-family="${SERIF}" font-weight="700" font-size="${r * 1.0}" fill="${PAPER}" text-anchor="middle">${esc(char)}</text>
    </g>
  `
}

/** Embedded QR with optional caption beneath. */
export function qrBlock(opts: {
  x: number
  y: number
  size: number
  qrSvgInner: string
  qrModuleCount: number
  caption?: string
  framed?: boolean
}): string {
  const { x, y, size, qrSvgInner, qrModuleCount, caption, framed } = opts
  const frame = framed
    ? `<rect x="${x - 8}" y="${y - 8}" width="${size + 16}" height="${size + 16}" fill="${PAPER}" stroke="${RULE}" stroke-width="0.5"/>`
    : ""
  const cap = caption
    ? `<text x="${x + size / 2}" y="${y + size + 18}" font-family="${SANS}" font-size="9" letter-spacing="0.32em" fill="${INK_MID}" text-anchor="middle">${esc(caption)}</text>`
    : ""
  return `
    ${frame}
    <g transform="translate(${x} ${y})">
      <svg viewBox="0 0 ${qrModuleCount} ${qrModuleCount}" width="${size}" height="${size}">
        ${qrSvgInner}
      </svg>
    </g>
    ${cap}
  `
}
