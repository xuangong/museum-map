// Generate QR code as inner SVG content (no <svg> wrapper) plus module count.
// Imports core + svg-tag renderer directly to avoid bundling qrcode's `server`
// entry which pulls in `pngjs` and `fs` (incompatible with Workers).

// @ts-expect-error -- no types for deep import
import QRCodeCore from "qrcode/lib/core/qrcode.js"
// @ts-expect-error -- no types
import SvgRenderer from "qrcode/lib/renderer/svg-tag.js"

export interface QrParts {
  inner: string // path elements only (no <svg> wrapper)
  modules: number // viewBox width/height in module units
}

export function buildQrSvg(text: string): QrParts {
  const data = QRCodeCore.create(text, { errorCorrectionLevel: "M" })
  const svg: string = SvgRenderer.render(data, {
    margin: 0,
    color: { dark: "#1B1A17", light: "#0000" },
  })
  const vbMatch = svg.match(/viewBox="0 0 (\d+) \d+"/)
  const modules = vbMatch ? Number(vbMatch[1]) : data.modules.size
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<path[^>]*fill="#ffffff"[^>]*\/>\s*/i, "")
  return { inner, modules }
}
