import type { DynastyFull } from "~/repo/types"

function shortName(d: DynastyFull): string {
  const n = d.name || ""
  const i = n.search(/[（(]/)
  return (i >= 0 ? n.slice(0, i) : n).trim()
}
function shortPeriod(d: DynastyFull): string {
  const p = d.period || ""
  return p.replace(/约公元/g, "").replace(/公元/g, "").replace(/年/g, "").replace(/—/g, "–")
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export function DynastyTimeline(dynasties: DynastyFull[] = []): string {
  // Pure SSR — no Alpine reactive bindings on dynasty items. Labels stay put even
  // if Alpine throws anywhere downstream. Active/visit/depth state is updated
  // imperatively by syncTimeline() in app.ts via $watch.
  const items = dynasties
    .map(
      (d) => `
  <div class="timeline-item"
       data-dyn-id="${esc(d.id)}"
       data-mm-click="dyn:${esc(d.id)}">
    <div class="name">${esc(shortName(d))}</div>
    <div class="period">${esc(shortPeriod(d))}</div>
  </div>`,
    )
    .join("")

  // Wrapper carries the edge fades as pseudo-elements — never mask-image on the
  // nav itself (iOS Safari dropped the labels when a mask sat on this layer).
  return `<div class="timeline-wrap"><nav class="timeline" data-timeline>
  <div class="timeline-item all"
       data-mm-click="dyn:__all__">
    <div class="name" data-tl-all-name>全部</div>
    <div class="period" data-tl-all-period>${dynasties.length} 个地层</div>
  </div>
  ${items}
</nav></div>`
}
