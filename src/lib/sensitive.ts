// Names and one-line notes typed on public scrolls. Short, plain text only; anything that looks
// like an ad or contact handle is dropped rather than shown.
const BLOCK = [
  /https?:|www\.|\.com|\.cn|\.net/i,
  /微信|vx|v信|加我|qq|电话|手机号|优惠|代购|返利|兼职|博彩|赌|色情|约炮/i,
  /习近平|共产党|法轮|台独|藏独|六四/,
]
function base(s: unknown): string {
  return String(s ?? "").replace(/[<>"'`\\]/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
}
function ok(s: string): boolean { return !BLOCK.some((r) => r.test(s)) }
export function cleanName(s: unknown, max: number): string {
  const t = [...base(s).replace(/[\/]/g, "")].slice(0, max).join("")
  return t && ok(t) ? t : ""
}
export function cleanLine(s: unknown, max: number): string {
  const t = [...base(s)].slice(0, max).join("")
  return t && ok(t) ? t : ""
}
