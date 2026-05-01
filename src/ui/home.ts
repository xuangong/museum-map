import type { MuseumListItem, DynastyFull } from "~/repo/types"
import { Layout } from "./layout"
import { Sidebar } from "./components/sidebar"
import { DynastyTimeline } from "./components/dynasty-timeline"
import { Drawer } from "./components/drawer"
import { ChatPanel } from "./components/chat-panel"
import { COORDS_SCRIPT } from "./client/coords"
import { MAP_SCRIPT } from "./client/map"
import { CHAT_SCRIPT } from "./client/chat"
import { APP_SCRIPT } from "./client/app"

export interface HomeData {
  museums: MuseumListItem[]
  dynasties: DynastyFull[]
}

const today = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })

export function HomePage(data: HomeData): string {
  const bootstrap = JSON.stringify(data)
    .replace(/</g, "\\u003c") // safe inline in <script>
    .replace(/-->/g, "--\\u003e")
  return Layout({
    title: "中国博物馆地图 — Atlas of Chinese Museums",
    children: `
<style>[x-cloak] { display: none !important; }</style>
<div class="app-shell">
  <header class="masthead">
    <div class="left">
      <span class="eyebrow">Established · MMXXVI</span>
    </div>
    <div class="center">
      <div class="title">中國博物館地圖</div>
      <div class="subtitle">An Atlas of Chinese Museums &amp; Their Dynasties</div>
    </div>
    <div class="right">
      <span class="eyebrow" style="font-variant-numeric:lining-nums;">${today()}</span>
    </div>
  </header>
  ${DynastyTimeline()}
  <div class="stage" x-data="museumApp()" x-init="init()">
    <div class="toc-overlay" :class="tocOpen ? 'open' : ''" @click="tocOpen = false" x-cloak></div>
    <div class="toc-wrap" :class="tocOpen ? 'open' : ''">
      ${Sidebar()}
    </div>
    <div class="canvas">
      <div class="canvas-bg"></div>
      <div id="map"></div>
      <div class="map-legend">
        <div class="row"><span class="dot r"></span><span>推荐博物馆</span></div>
        <div class="row" x-show="currentDynastyId" x-cloak><span class="dot e"></span><span>历史事件</span></div>
      </div>
      <div class="map-caption" :class="currentDynastyId ? 'show' : ''" x-cloak>
        <div class="label">Now Reading</div>
        <div class="name" x-text="(currentDynasty() || {}).name || ''"></div>
        <div class="period" x-text="(currentDynasty() || {}).period || ''"></div>
      </div>
    </div>
    <button class="toc-fab" @click="tocOpen = true" aria-label="Open index">
      <span class="bars"><span></span><span></span><span></span></span>
      <span class="lbl">目录</span>
    </button>
    ${Drawer()}
    ${ChatPanel()}
  </div>
</div>
<script id="bootstrap-data" type="application/json">${bootstrap}</script>
<script>${COORDS_SCRIPT}</script>
<script>${MAP_SCRIPT}</script>
<script>${CHAT_SCRIPT}</script>
<script>${APP_SCRIPT}</script>
`,
  })
}

export function ErrorPage(message: string): string {
  return Layout({
    title: "数据未就绪",
    children: `<div style="padding:120px 60px;text-align:center;max-width:560px;margin:0 auto;">
      <div class="eyebrow" style="color:var(--vermilion);">Error · 503</div>
      <h1 class="display-zh" style="font-size:48px;margin:16px 0 8px;">数据未就绪</h1>
      <p style="color:var(--ink-mid);font-family:var(--display);font-style:italic;">${message.replace(/</g, "&lt;")}</p>
      <pre style="background:var(--paper-elev);border:1px solid var(--ink);padding:14px 22px;display:inline-block;margin-top:24px;font-family:var(--mono);">bun run seed</pre>
    </div>`,
  })
}
