import { themeCss } from "./theme"

/** Bar colour per hall — mirrors --bg-2 in theme.ts; used for <meta name="theme-color">. */
export const THEME_BAR: Record<string, string> = { night: "#131210", paper: "#F8F4EC", qinglu: "#132D31" }

// Runs before first paint so the page never flashes the wrong hall. The stored choice
// ("auto" | "night" | "paper" | "qinglu") lives in localStorage.mmTheme; auto follows the
// system: light → 宣纸, dark → 夜展.
const THEME_BOOT = `(function(){try{
var p=localStorage.getItem('mmTheme')||'auto';
var t=p==='auto'?((window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'paper':'night'):p;
if(!/^(night|paper|qinglu)$/.test(t))t='night';
document.documentElement.setAttribute('data-theme',t);
var bar=${JSON.stringify(THEME_BAR)}[t];var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',bar);
}catch(e){document.documentElement.setAttribute('data-theme','night');}})();`

// Proxied through our Worker (/fonts/*) — Google Fonts is unreachable from mainland China.
export const FONT_CSS_HREF =
  "/fonts/css2?family=Noto+Serif+SC:wght@400;700;900" +
  "&family=Inter:wght@400;500;600" +
  "&family=JetBrains+Mono:wght@400;500" +
  "&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400" +
  "&display=swap"

export function Layout({
  title,
  head,
  children,
}: {
  title: string
  head?: string
  children: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
  <meta name="theme-color" content="#131210" />
  <meta name="color-scheme" content="dark light" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <script>${THEME_BOOT}</script>
  <title>${title}</title>
  <link rel="preload" href="${FONT_CSS_HREF}" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="${FONT_CSS_HREF}"></noscript>
  <link rel="stylesheet" href="/cdn/leaflet.css">
  <script defer src="/cdn/alpine.js"></script>
  <script src="/cdn/leaflet.js"></script>
  <style>${themeCss}</style>
  ${head ?? ""}
</head>
<body>
${children}
</body>
</html>`
}
