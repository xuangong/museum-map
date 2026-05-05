import type { MuseumListItem, DynastyFull } from "~/repo/types"
import { Layout } from "./layout"
import { Sidebar } from "./components/sidebar"
import { DynastyTimeline } from "./components/dynasty-timeline"
import { Drawer } from "./components/drawer"
import { ChatPanel } from "./components/chat-panel"
import { COORDS_SCRIPT } from "./client/coords"
import { MAP_SCRIPT } from "./client/map"
import { CHAT_SCRIPT } from "./client/chat"
import { AUTH_SCRIPT } from "./client/auth"
import { APP_SCRIPT } from "./client/app"

export interface ViewingProfile {
  user: { handle: string | null; displayName: string | null }
  visits: Array<{ museumId: string; visitedAt: number; note: string | null }>
  review: { summary: string; count: number; generatedAt: number } | null
}

export interface HomeData {
  museums: MuseumListItem[]
  dynasties: DynastyFull[]
  googleEnabled?: boolean
  viewingProfile?: ViewingProfile | null
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
<div class="app-shell" x-data="museumApp()">
  <template x-if="isReadOnly && viewingProfile">
    <div style="background:var(--vermilion);color:var(--paper);padding:8px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:var(--sans);font-size:12px;letter-spacing:0.06em;">
      <span>正在浏览 <strong x-text="(viewingProfile.user.displayName || ('@' + viewingProfile.user.handle))"></strong> 的足迹（只读）</span>
      <a href="/" style="color:var(--paper);text-decoration:underline;font-size:11px;">退出只读 →</a>
    </div>
  </template>
  <header class="masthead">
    <div class="left">
      <span class="eyebrow">Established · MMXXVI</span>
    </div>
    <div class="center">
      <div class="title">中國博物館地圖</div>
      <div class="subtitle">An Atlas of Chinese Museums &amp; Their Dynasties</div>
    </div>
    <div class="right">
      <button class="footprint-pill" :class="visits.footprintMode ? 'active' : ''" @click="toggleFootprint()" :title="visits.footprintMode ? '退出足迹模式' : '查看我的足迹'">
        <span x-show="!visits.footprintMode">✦ 足迹 <span style="font-variant-numeric:lining-nums;" x-text="visits.ids.length"></span></span>
        <span x-show="visits.footprintMode">✕ 退出足迹</span>
      </button>
      <span class="eyebrow" style="font-variant-numeric:lining-nums;margin-left:14px;">${today()}</span>
    </div>
  </header>
  ${DynastyTimeline(data.dynasties)}
  <div class="stage">
    <div class="toc-overlay" :class="tocOpen ? 'open' : ''" @click="tocOpen = false" x-cloak></div>
    <div class="toc-wrap" :class="tocOpen ? 'open' : ''">
      ${Sidebar({ googleEnabled: !!data.googleEnabled })}
    </div>
    <div class="canvas">
      <div class="canvas-bg"></div>
      <div id="map"></div>
      <div class="map-legend">
        <template x-if="visits.footprintMode">
          <div class="row"><span class="dot r"></span><span>足迹（含推荐路径）</span></div>
        </template>
        <template x-if="!visits.footprintMode && currentDynastyId">
          <div class="row"><span class="dot k"></span><span>朝代相关博物馆</span></div>
        </template>
        <template x-if="!visits.footprintMode && currentDynastyId">
          <div class="row"><span class="dot r"></span><span>已打卡</span></div>
        </template>
        <template x-if="!visits.footprintMode && !currentDynastyId">
          <div class="row"><span class="dot r"></span><span>已打卡</span></div>
        </template>
        <template x-if="!visits.footprintMode && !currentDynastyId">
          <div class="row"><span class="dot k"></span><span>未打卡</span></div>
        </template>
        <div class="row" x-show="currentDynastyId" x-cloak><span class="dot e"></span><span>历史事件</span></div>
      </div>
      <div class="map-caption" :class="captionShown ? 'show' : ''" x-cloak>
        <div class="label">Now Reading</div>
        <div class="name" x-text="(currentDynasty() || {}).name || ''"></div>
        <div class="period" x-text="(currentDynasty() || {}).period || ''"></div>
      </div>
    </div>
    <button class="toc-fab" x-show="!drawer.open" @click="tocOpen = true" aria-label="Open index">
      <span class="bars"><span></span><span></span><span></span></span>
      <span class="lbl">目录</span>
    </button>
    ${Drawer()}
    ${ChatPanel()}
  </div>
  <div class="toast" x-show="toast" x-text="toast" x-transition.opacity x-cloak></div>
</div>
<!-- Hidden poster (off-screen) used for footprint long-screenshot export -->
<div id="footprint-poster" aria-hidden="true" style="position:absolute;left:-99999px;top:0;width:760px;background:#fefcf6;color:#2a2520;font-family:'Source Serif 4','Noto Serif SC',serif;padding:56px 48px;box-sizing:border-box;"></div>
<div id="dynasty-poster" aria-hidden="true" style="position:absolute;left:-99999px;top:0;width:760px;background:#fefcf6;color:#2a2520;font-family:'Source Serif 4','Noto Serif SC',serif;padding:56px 48px;box-sizing:border-box;"></div>
<script id="bootstrap-data" type="application/json">${bootstrap}</script>
<script src="/cdn/html2canvas.js"></script>
<script src="/cdn/leaflet-image.js"></script>
<script src="/cdn/qrcode.js"></script>
<script>${COORDS_SCRIPT}</script>
<script>${MAP_SCRIPT}</script>
<script>${CHAT_SCRIPT}</script>
<script>${AUTH_SCRIPT}</script>
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
