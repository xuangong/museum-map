import type { MuseumListItem, DynastyFull } from "~/repo/types"
import { Layout } from "./layout"
import { Sidebar } from "./components/sidebar"
import { DynastyTimeline } from "./components/dynasty-timeline"
import { Drawer } from "./components/drawer"
import { ChatPanel } from "./components/chat-panel"
import { AchievementSheet, AchievementCeremony } from "./components/achievements"
import { icon } from "./icons"
import { COORDS_SCRIPT } from "./client/coords"
import { TRIP_CORE_SCRIPT } from "./client/trip-core"
import { MAP_SCRIPT } from "./client/map"
import { CHAT_SCRIPT } from "./client/chat"
import { AUTH_SCRIPT } from "./client/auth"
import { APP_SCRIPT } from "./client/app"
import { STRATA_SRC, TERRITORY_SRC } from "~/routes/assets"
import { DYNASTY_GEO } from "~/data/dynasty-geo"
import { computeCrossings } from "~/services/crossings"
import { AI_MODELS, DEFAULT_AI_MODEL, DEFAULT_AI_EFFORT } from "~/services/ai-models"
import { MUSEUM_ALIASES } from "~/data/museum-aliases"
import { ACHIEVEMENTS } from "~/data/achievements"
import { ACHIEVEMENT_LABELS } from "~/data/achievement-labels"
import { ACH_CORE_SCRIPT } from "./client/achievements-core"

export interface ViewingProfile {
  user: { handle: string | null; displayName: string | null }
  visits: Array<{ museumId: string; visitedAt: number; note: string | null }>
  review: { summary: string; count: number; generatedAt: number } | null
  dynastyReviews?: Array<{ dynastyId: string; summary: string; count: number; generatedAt: number }>
}

export interface HomeData {
  museums: MuseumListItem[]
  dynasties: DynastyFull[]
  googleEnabled?: boolean
  viewingProfile?: ViewingProfile | null
}

export function HomePage(data: HomeData): string {
  const bootstrap = JSON.stringify({
    ...data,
    dynastyGeo: DYNASTY_GEO,
    crossings: computeCrossings(data.museums, data.dynasties),
    territoryUrl: TERRITORY_SRC,
    ai: { models: AI_MODELS, defaultModel: DEFAULT_AI_MODEL, defaultEffort: DEFAULT_AI_EFFORT },
    aliases: MUSEUM_ALIASES,
    achievements: ACHIEVEMENTS.map((a) => ({ ...a, label: ACHIEVEMENT_LABELS[a.id] })),
  })
    .replace(/</g, "\\u003c") // safe inline in <script>
    .replace(/-->/g, "--\\u003e")
  return Layout({
    title: "中国博物馆地图 · 时间与地点的交汇",
    children: `
<div class="app-shell" x-data="museumApp()">
  <template x-if="isReadOnly && viewingProfile">
    <div class="readonly-bar">
      <span>正在翻阅 <strong x-text="(viewingProfile.user.displayName || ('@' + viewingProfile.user.handle))"></strong> 的集章册 · 只读</span>
      <a href="/">回到我的地图 →</a>
    </div>
  </template>
  <header class="topbar">
    <a class="brand" href="/" aria-label="中国博物馆地图">
      <span class="brand-seal">博</span>
      <span class="brand-text">
        <span class="brand-name">中国博物馆地图</span>
        <span class="brand-sub">WHERE TIME MEETS PLACE</span>
      </span>
    </a>
    <div class="topbar-stats">
      <span><b x-text="museums.length"></b>座博物馆</span>
      <span><b x-text="dynasties.length"></b>个朝代地层</span>
    </div>
    <nav class="topbar-actions">
      <a class="tb-btn" href="/plaza" title="同好广场">${icon("users", 16)}<span class="tb-label">广场</span></a>
      <button class="tb-btn tb-trip" :class="tripMode ? 'active' : ''" @click="toggleTripMode()" title="我的行程">
        ${icon("route", 16)}<span class="tb-label">行程</span><b class="tb-count" x-show="trip.picks.length" x-text="trip.picks.length" x-cloak></b>
      </button>
      <button class="tb-btn tb-stamp" :class="visits.footprintMode ? 'active' : ''" @click="toggleFootprint()" title="我的集章册">
        ${icon("seal", 16)}<span>集章</span><b x-text="visits.ids.length"></b>
      </button>
    </nav>
  </header>
  ${DynastyTimeline(data.dynasties)}
  <div class="stage" :class="tripMode ? 'is-trip' : ''">
    <div class="toc-overlay" :class="tocOpen ? 'open' : ''" @click="tocOpen = false" x-cloak></div>
    <div class="toc-wrap" :class="tocOpen ? 'open' : ''">
      ${Sidebar({ googleEnabled: !!data.googleEnabled })}
    </div>
    <div class="toc-resize" id="toc-resize" role="separator" aria-orientation="vertical" aria-label="拖动调整索引宽度" title="拖动调整索引宽度"></div>
    <div class="canvas" :class="'is-' + view + (drawer.open ? ' has-drawer' : '')">
      <div id="strata" class="strata-wrap" aria-label="时空地层"></div>
      <div id="map" class="map-wrap"></div>
      <div class="map-vignette" x-show="view === 'map'"></div>
      <div class="view-switch" role="tablist" aria-label="视图">
        <button role="tab" :class="view === 'strata' ? 'active' : ''" :aria-selected="view === 'strata'" @click="setView('strata')">${icon("layers", 15)}<span>时空</span></button>
        <button role="tab" :class="view === 'map' ? 'active' : ''" :aria-selected="view === 'map'" @click="setView('map')">${icon("pin", 15)}<span>地图</span></button>
      </div>
      <button class="locate-btn" x-show="view === 'map'" x-cloak @click="locateMe()" :disabled="geo.locating" :class="geo.lat != null ? 'on' : ''" title="看看我附近的博物馆">
        ${icon("locate", 16)}<span x-text="geo.locating ? '定位中…' : (geo.lat != null ? '已定位' : '附近')"></span>
      </button>
      <div class="map-legend" x-show="view === 'map'" x-cloak>
        <template x-if="tripMode">
          <div style="display:contents">
            <div class="row"><span class="dot g"></span><span x-text="trip.mode === 'drive' ? '路线与沿途' : '城市与周边'"></span></div>
            <div class="row"><span class="dot c"></span><span>推荐 · 点开可加入</span></div>
          </div>
        </template>
        <template x-if="!tripMode && visits.footprintMode">
          <div class="row"><span class="dot r"></span><span>已集章</span></div>
        </template>
        <template x-if="!tripMode && visits.footprintMode && ledgerOpt.tab === 'near' && !isReadOnly">
          <div class="row"><span class="dot c"></span><span x-text="'附近可补 · ' + ledgerRadiusLabel()"></span></div>
        </template>
        <template x-if="!tripMode && !visits.footprintMode && currentDynastyId">
          <div class="row"><span class="dot g"></span><span>本朝相关</span></div>
        </template>
        <template x-if="!tripMode && !visits.footprintMode">
          <div class="row"><span class="dot r"></span><span>已集章</span></div>
        </template>
        <template x-if="!tripMode && !visits.footprintMode && !currentDynastyId">
          <div class="row"><span class="dot k"></span><span>未到访</span></div>
        </template>
        <div class="row" x-show="currentDynastyId && !tripMode" x-cloak><span class="dot e"></span><span>历史事件</span></div>
        <div class="row mention-chip" x-show="mentions.ids.length" x-cloak>
          <span class="dot m"></span><span x-text="'讲解员提到的 ' + mentions.ids.length + ' 座馆'"></span><span class="sep">·</span><button type="button" @click="clearMentions()">清除</button>
        </div>
      </div>
      <div class="map-caption" :class="captionShown ? 'show' : ''" x-cloak>
        <div class="cap-kicker">ENTERING</div>
        <div class="cap-name" x-text="dynastyTitle()"></div>
        <div class="cap-period" x-text="(currentDynasty() || {}).period || ''"></div>
      </div>
    </div>
    ${Drawer()}
    ${ChatPanel()}
    ${AchievementSheet()}${AchievementCeremony()}
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
<script>${TRIP_CORE_SCRIPT}</script>
<script>${ACH_CORE_SCRIPT}</script>
<script>${MAP_SCRIPT}</script>
<script>${CHAT_SCRIPT}</script>
<script>${AUTH_SCRIPT}</script>
<script>${APP_SCRIPT}</script>
<script type="module" src="${STRATA_SRC}"></script>
`,
  })
}

export function ErrorPage(message: string): string {
  return Layout({
    title: "数据未就绪",
    children: `<div style="padding:120px 32px;text-align:center;max-width:560px;margin:0 auto;">
      <div class="eyebrow" style="color:var(--seal);">Error · 503</div>
      <h1 class="display-zh" style="font-size:44px;margin:16px 0 10px;">数据未就绪</h1>
      <p style="color:var(--text-2);font-size:15px;line-height:1.8;">${message.replace(/</g, "&lt;")}</p>
      <pre style="background:var(--surface);border:1px solid var(--line-strong);border-radius:12px;padding:14px 22px;display:inline-block;margin-top:24px;font-family:var(--mono);color:var(--gilt);">bun run seed</pre>
    </div>`,
  })
}
