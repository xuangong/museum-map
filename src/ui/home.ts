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

export function HomePage(data: HomeData): string {
  const bootstrap = JSON.stringify(data)
    .replace(/</g, "\\u003c") // safe inline in <script>
    .replace(/-->/g, "--\\u003e")
  return Layout({
    title: "中国博物馆地图",
    children: `
<div style="display:flex;flex-direction:column;height:100vh;">
  ${DynastyTimeline()}
  <div style="flex:1;display:flex;overflow:hidden;" x-data="museumApp()" x-init="init()">
    ${Sidebar()}
    <div id="map" style="flex:1;height:100%;"></div>
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
    children: `<div style="padding:60px;text-align:center;font-family:var(--font-cn);">
      <h1 class="display" style="font-size:28px;color:var(--accent);">数据未就绪</h1>
      <p style="color:var(--ink-mute);">${message.replace(/</g, "&lt;")}</p>
      <pre style="background:var(--bg-soft);padding:16px;display:inline-block;text-align:left;">bun run seed</pre>
    </div>`,
  })
}
