# Museum Map Modernization · Plan 04 · UI (宣纸博物 + Components)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the home page (`GET /`) with map + sidebar + dynasty timeline + drawer + chat panel. Inline bootstrap data (server-side `museums.list()` + `dynasties.listFull()`) so first paint needs no fetch. Apply the 「宣纸博物」 visual tokens. Preserve every legacy interaction (timeline drag, drawer snap, dynasty→map fly, quick-question chips).

**Architecture:** Server-side renders the full HTML shell + an inlined `<script id="bootstrap-data" type="application/json">…</script>`. Browser-side: Alpine.js `x-data` reads bootstrap data synchronously in `init()`, builds Leaflet markers (after WGS-84→GCJ-02 transform), wires interactions. Drawer details fetched on demand from `/api/museums/:id`. CSS variables in `theme.ts` injected once in `<head>`. CDN JS proxied via `/cdn/*`; Google Fonts directly linked.

**Tech Stack:** Tailwind CDN, Alpine.js CDN, Leaflet CDN, Source Serif 4 + Noto Serif SC.

**Spec reference:** §5.1 (bootstrap), §6 (visual tokens), §6.3 (components), Map+Coords contract in §6.3.

**Depends on:** Plans 01-02 complete.

---

## File Structure

| File | Purpose |
|---|---|
| `src/lib/cdn.ts` | `/cdn/:file` proxy: tailwind/alpine/leaflet js+css |
| `src/lib/html.ts` | `html` tag template — escapes interpolated values; passes through `raw()` markers |
| `src/ui/theme.ts` | `:root` CSS variables (宣纸 palette + fonts + rules) |
| `src/ui/layout.ts` | `Layout({title, head, children})` — meta, fonts, CDN, theme inject |
| `src/ui/components/sidebar.ts` | List items markup (Alpine `x-for`) |
| `src/ui/components/dynasty-timeline.ts` | Timeline track markup |
| `src/ui/components/drawer.ts` | Two drawers: museum-drawer + dynasty-drawer |
| `src/ui/components/chat-panel.ts` | Bottom panel + overlay + quick-question chips |
| `src/ui/home.ts` | Compose: layout + map div + sidebar + timeline + drawers + chat-panel + bootstrap script + client scripts |
| `src/ui/client/coords.ts` | WGS-84→GCJ-02; `toMapCoord`; emitted as inline `<script>` string |
| `src/ui/client/map.ts` | Leaflet init; marker creation; tile layer with sepia filter |
| `src/ui/client/app.ts` | Alpine main store: bootstrap parse, dynasty selection, drawer state, fetch museum detail |
| `src/ui/client/chat.ts` | Chat send + render; quick-question chip → fill input (not auto-send) |
| `src/routes/home.ts` | GET `/` — call repos, render Layout(home(...)), inline bootstrap |
| `tests/coords.test.ts` | WGS-84→GCJ-02 regression: known points + outOfChina + Tokyo |
| `tests/routes.test.ts` (extend) | GET `/` 200, contains `<script id="bootstrap-data"`, contains Google Fonts link, contains 64 museum entries in JSON, contains "宣纸" CSS token |

---

## Task 1: html template helper

**Files:**
- Create: `src/lib/html.ts`
- Create: `tests/html.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "bun:test"
import { html, raw } from "~/lib/html"

describe("html tag template", () => {
  it("escapes interpolated strings", () => {
    const name = `<script>x</script>`
    expect(html`<div>${name}</div>`).toBe(`<div>&lt;script&gt;x&lt;/script&gt;</div>`)
  })

  it("escapes ampersands and quotes", () => {
    expect(html`<a title="${`a & "b"`}">x</a>`).toBe(`<a title="a &amp; &quot;b&quot;">x</a>`)
  })

  it("raw() bypasses escaping", () => {
    expect(html`<div>${raw("<b>bold</b>")}</div>`).toBe(`<div><b>bold</b></div>`)
  })

  it("flattens arrays", () => {
    expect(html`<ul>${[1, 2, 3].map((n) => html`<li>${n}</li>`)}</ul>`).toBe(`<ul><li>1</li><li>2</li><li>3</li></ul>`)
  })
})
```

- [ ] **Step 2: Run → FAIL**

Run: `bun test tests/html.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// src/lib/html.ts
const RAW = Symbol("raw")
type Raw = { [RAW]: true; value: string }
type Part = string | number | boolean | null | undefined | Raw | Part[]

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function render(p: Part): string {
  if (p == null || p === false) return ""
  if (Array.isArray(p)) return p.map(render).join("")
  if (typeof p === "object" && (p as Raw)[RAW]) return (p as Raw).value
  return escapeHtml(String(p))
}

export function raw(s: string): Raw {
  return { [RAW]: true, value: s }
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): string {
  let out = strings[0] ?? ""
  for (let i = 0; i < parts.length; i++) {
    out += render(parts[i] ?? "") + (strings[i + 1] ?? "")
  }
  return out
}
```

- [ ] **Step 4: Run → PASS**

Run: `bun test tests/html.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/html.ts tests/html.test.ts
git commit -m "feat(lib): html tag template with auto-escape and raw() escape hatch"
```

---

## Task 2: CDN proxy

**Files:**
- Create: `src/lib/cdn.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write `src/lib/cdn.ts`**

```typescript
import { Elysia } from "elysia"

const CDN_MAP: Record<string, string> = {
  "tailwind.js": "https://cdn.tailwindcss.com/3.4.17",
  "alpine.js": "https://unpkg.com/alpinejs@3/dist/cdn.min.js",
  "leaflet.js": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "leaflet.css": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
}

export const cdnRoute = new Elysia().get("/cdn/:file", async ({ params }) => {
  const url = CDN_MAP[params.file]
  if (!url) return new Response("Not found", { status: 404 })
  const ct = params.file.endsWith(".css") ? "text/css" : "application/javascript"
  const upstream = await fetch(url)
  return new Response(upstream.body, {
    headers: { "Content-Type": ct, "Cache-Control": "public, max-age=604800" },
  })
})
```

- [ ] **Step 2: Mount in `src/index.ts`**

Add to `createApp`:

```typescript
import { cdnRoute } from "~/lib/cdn"
// ...
    .use(cdnRoute)
    .use(museumsRoute)
```

- [ ] **Step 3: Smoke**

Run dev, then `curl -I http://localhost:4242/cdn/leaflet.js | head -1`
Expected: `HTTP/1.1 200`. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cdn.ts src/index.ts
git commit -m "feat(lib): /cdn/* proxy for tailwind/alpine/leaflet"
```

---

## Task 3: Theme tokens

**Files:**
- Create: `src/ui/theme.ts`

- [ ] **Step 1: Write `src/ui/theme.ts`**

```typescript
export const themeCss = `
:root {
  --bg:        #F5F1E8;
  --bg-soft:   #EFE9DA;
  --bg-elev:   #FBF8F0;
  --ink:       #1C1A17;
  --ink-soft:  #3D3833;
  --ink-mute:  #847A6E;
  --accent:    #C04A1A;
  --accent-soft: #E8B89A;
  --rule:      #D9D2C2;
  --rule-soft: #E8E2D2;
  --font-display: "Source Serif 4", "Songti SC", "STSong", serif;
  --font-cn:      "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif;
  --font-body:    -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
}
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); }
h1, h2, h3, .museum-name { font-family: var(--font-cn); font-weight: 600; }
.display { font-family: var(--font-display); }
.rule    { border-bottom: 0.5px solid var(--rule); }
.rule-strong { border-bottom: 1px solid var(--ink); }
.accent { color: var(--accent); }
.bg-elev { background: var(--bg-elev); }

/* Map tile sepia filter */
.leaflet-tile { filter: grayscale(0.4) sepia(0.15) brightness(1.05); }

/* Marker dot — 朱印 style */
.museum-marker {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--accent); border: 1.5px solid var(--bg);
  box-shadow: 0 0 0 1px var(--accent);
}
.museum-marker.selected {
  transform: scale(1.3);
  transition: transform 0.18s ease-out;
}

/* Drawer */
.drawer {
  position: fixed; right: 0; top: 0; bottom: 0; width: min(480px, 100vw);
  background: var(--bg-elev); border-left: 0.5px solid var(--rule);
  transform: translateX(100%); transition: transform 0.28s ease-out;
  overflow-y: auto; z-index: 1000;
}
.drawer.open { transform: translateX(0); }
.drawer-section { padding: 16px 20px; border-bottom: 0.5px solid var(--rule); }

/* Chat panel — bottom slide */
.chat-overlay {
  position: fixed; inset: 0; background: rgba(28,26,23,0.4);
  opacity: 0; pointer-events: none; transition: opacity 0.2s ease; z-index: 1500;
}
.chat-overlay.open { opacity: 1; pointer-events: auto; }
.chat-panel {
  position: fixed; left: 0; right: 0; bottom: 0; height: 70vh;
  background: var(--bg-elev); border-top: 0.5px solid var(--rule);
  transform: translateY(100%); transition: transform 0.28s ease-out;
  z-index: 1600; display: flex; flex-direction: column;
}
.chat-panel.open { transform: translateY(0); }
.chat-input {
  border: none; border-bottom: 1px solid var(--ink);
  background: transparent; padding: 8px 0; outline: none; flex: 1;
  font-family: var(--font-body);
}
.chip {
  display: inline-block; padding: 4px 10px; margin: 4px 6px 4px 0;
  border: 0.5px solid var(--rule); color: var(--ink-soft);
  cursor: pointer; font-size: 13px;
}
.chip:hover { border-color: var(--accent); color: var(--accent); }

/* Timeline */
.timeline { display: flex; gap: 24px; padding: 12px 20px; overflow-x: auto; user-select: none; }
.timeline-item { flex-shrink: 0; cursor: pointer; padding: 6px 4px; position: relative; font-family: var(--font-cn); }
.timeline-item.active::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 1.5px;
  background: var(--accent); transition: all 0.4s ease;
}
`
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/theme.ts
git commit -m "feat(ui): 宣纸博物 design tokens (CSS variables + base styles)"
```

---

## Task 4: Layout

**Files:**
- Create: `src/ui/layout.ts`

- [ ] **Step 1: Write**

```typescript
import { html, raw } from "~/lib/html"
import { themeCss } from "./theme"

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
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&family=Noto+Serif+SC:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/cdn/leaflet.css">
  <script src="/cdn/tailwind.js"></script>
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
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/layout.ts
git commit -m "feat(ui): Layout shell with fonts, CDN, and theme injection"
```

---

## Task 5: Coords (client + server-side regression test)

**Files:**
- Create: `src/ui/client/coords.ts`
- Create: `tests/coords.test.ts`

- [ ] **Step 1: Write `src/ui/client/coords.ts`**

The file exports a string of browser JS plus a JS-callable copy for the test environment.

```typescript
// Source of truth for WGS-84 → GCJ-02 (and the server-side test mirror)
export const COORDS_SCRIPT = `
(function(global){
  var PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323;
  function outOfChina(lat, lng) {
    return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
  }
  function transformLat(x, y) {
    var ret = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0;
    ret += (20.0*Math.sin(y*PI) + 40.0*Math.sin(y/3.0*PI)) * 2.0/3.0;
    ret += (160.0*Math.sin(y/12.0*PI) + 320*Math.sin(y*PI/30.0)) * 2.0/3.0;
    return ret;
  }
  function transformLng(x, y) {
    var ret = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x));
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0;
    ret += (20.0*Math.sin(x*PI) + 40.0*Math.sin(x/3.0*PI)) * 2.0/3.0;
    ret += (150.0*Math.sin(x/12.0*PI) + 300.0*Math.sin(x/30.0*PI)) * 2.0/3.0;
    return ret;
  }
  function wgs84ToGcj02(wgsLat, wgsLng) {
    if (outOfChina(wgsLat, wgsLng)) return [wgsLat, wgsLng];
    var dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
    var dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
    var radLat = wgsLat / 180.0 * PI;
    var magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    var sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
    return [wgsLat + dLat, wgsLng + dLng];
  }
  global.outOfChina = outOfChina;
  global.wgs84ToGcj02 = wgs84ToGcj02;
  global.toMapCoord = wgs84ToGcj02;
})(window);
`

/** Server-side mirror for tests (same algorithm). */
export function toMapCoord(lat: number, lng: number): [number, number] {
  const PI = Math.PI, a = 6378245.0, ee = 0.00669342162296594323
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng]
  const tLat = (x: number, y: number) => {
    let ret = -100.0 + 2.0*x + 3.0*y + 0.2*y*y + 0.1*x*y + 0.2*Math.sqrt(Math.abs(x))
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0
    ret += (20.0*Math.sin(y*PI) + 40.0*Math.sin(y/3.0*PI)) * 2.0/3.0
    ret += (160.0*Math.sin(y/12.0*PI) + 320*Math.sin(y*PI/30.0)) * 2.0/3.0
    return ret
  }
  const tLng = (x: number, y: number) => {
    let ret = 300.0 + x + 2.0*y + 0.1*x*x + 0.1*x*y + 0.1*Math.sqrt(Math.abs(x))
    ret += (20.0*Math.sin(6.0*x*PI) + 20.0*Math.sin(2.0*x*PI)) * 2.0/3.0
    ret += (20.0*Math.sin(x*PI) + 40.0*Math.sin(x/3.0*PI)) * 2.0/3.0
    ret += (150.0*Math.sin(x/12.0*PI) + 300.0*Math.sin(x/30.0*PI)) * 2.0/3.0
    return ret
  }
  let dLat = tLat(lng - 105.0, lat - 35.0)
  let dLng = tLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * PI)
  return [lat + dLat, lng + dLng]
}
```

- [ ] **Step 2: Write `tests/coords.test.ts`**

```typescript
import { describe, it, expect } from "bun:test"
import { toMapCoord } from "~/ui/client/coords"

// Reference values produced by running legacy/index.html wgs84ToGcj02 on the inputs
const REF: Array<[string, number, number, number, number]> = [
  // [city, wgsLat, wgsLng, expectedGcjLat, expectedGcjLng]
  ["beijing", 39.9042, 116.4074, 39.905487048943465, 116.41360078475788],
  ["xian",    34.3416, 108.9398, 34.347470114895244, 108.94539814049352],
  ["hangzhou",30.2741, 120.1551, 30.272220222948957, 120.15986182108948],
]

describe("WGS-84 → GCJ-02", () => {
  for (const [city, lat, lng, eLat, eLng] of REF) {
    it(`${city} matches legacy implementation within 1e-6`, () => {
      const [outLat, outLng] = toMapCoord(lat, lng)
      expect(outLat).toBeCloseTo(eLat, 6)
      expect(outLng).toBeCloseTo(eLng, 6)
    })
  }

  it("returns input unchanged for points outside China (Tokyo)", () => {
    expect(toMapCoord(35.6812, 139.7671)).toEqual([35.6812, 139.7671])
  })

  it("outOfChina edges return original coords", () => {
    expect(toMapCoord(30.0, 72.0)).toEqual([30.0, 72.0])      // lng < 72.004
    expect(toMapCoord(30.0, 137.9)).toEqual([30.0, 137.9])    // > 137.8347
    expect(toMapCoord(0.8, 100.0)).toEqual([0.8, 100.0])      // lat < 0.8293
    expect(toMapCoord(55.9, 100.0)).toEqual([55.9, 100.0])    // > 55.8271
  })
})
```

> **Note for engineer:** If your reference values from the legacy code differ at the 6th decimal, regenerate them by running the legacy `wgs84ToGcj02(...)` in a browser console with the inputs above and replacing `eLat`/`eLng`. Do not weaken the precision; align the constants instead.

- [ ] **Step 3: Run → PASS**

Run: `bun test tests/coords.test.ts`
Expected: PASS. (If reference values mismatch by >1e-6, see note above.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/client/coords.ts tests/coords.test.ts
git commit -m "feat(ui/client): WGS-84→GCJ-02 (browser + server) with regression tests"
```

---

## Task 6: Components — sidebar, timeline, drawer, chat-panel

**Files:**
- Create: `src/ui/components/sidebar.ts`
- Create: `src/ui/components/dynasty-timeline.ts`
- Create: `src/ui/components/drawer.ts`
- Create: `src/ui/components/chat-panel.ts`

- [ ] **Step 1: Write `src/ui/components/sidebar.ts`**

```typescript
import { raw } from "~/lib/html"

export function Sidebar(): string {
  return `<aside class="sidebar bg-elev" style="width:300px;border-right:0.5px solid var(--rule);overflow-y:auto;">
  <div style="padding:16px 20px;border-bottom:1px solid var(--ink);">
    <h2 class="display" style="margin:0;font-size:18px;">中国博物馆</h2>
    <input x-model="search" placeholder="搜索博物馆…"
      class="chat-input" style="margin-top:10px;font-size:13px;width:100%;border-bottom:0.5px solid var(--rule);" />
  </div>
  <ul style="list-style:none;margin:0;padding:0;">
    <template x-for="m in filteredMuseums" :key="m.id">
      <li @click="openMuseum(m.id)"
          class="rule"
          style="padding:12px 20px;cursor:pointer;"
          :style="selectedMuseumId === m.id ? 'background:var(--bg-soft);' : ''">
        <div class="museum-name" style="font-size:15px;" x-text="m.name"></div>
        <div style="font-size:11px;color:var(--ink-mute);margin-top:2px;" x-text="m.corePeriod || ''"></div>
      </li>
    </template>
  </ul>
</aside>`
}
```

- [ ] **Step 2: Write `src/ui/components/dynasty-timeline.ts`**

```typescript
export function DynastyTimeline(): string {
  return `<nav class="timeline rule-strong bg-elev">
  <template x-for="d in dynasties" :key="d.id">
    <div class="timeline-item"
         :class="currentDynastyId === d.id ? 'active accent' : ''"
         @click="selectDynasty(d.id)">
      <div style="font-size:15px;" x-text="d.name"></div>
      <div style="font-size:10px;color:var(--ink-mute);" x-text="d.period || ''"></div>
    </div>
  </template>
</nav>`
}
```

- [ ] **Step 3: Write `src/ui/components/drawer.ts`**

```typescript
export function Drawer(): string {
  return `<aside class="drawer" :class="drawer.open ? 'open' : ''">
  <div style="padding:20px;border-bottom:1px solid var(--ink);display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h2 class="display" style="margin:0;font-size:24px;" x-text="drawer.title"></h2>
      <div style="margin-top:6px;color:var(--ink-mute);font-size:13px;" x-text="drawer.subtitle"></div>
    </div>
    <button @click="closeDrawer()" style="border:none;background:transparent;font-size:20px;cursor:pointer;color:var(--ink-mute);">×</button>
  </div>
  <div x-show="drawer.loading" class="drawer-section" style="color:var(--ink-mute);">载入中…</div>
  <div x-show="drawer.error" class="drawer-section" style="color:var(--accent);">
    载入失败 · <a href="#" @click.prevent="reloadDrawer()" style="color:var(--accent);text-decoration:underline;">重试</a>
  </div>
  <template x-for="section in drawer.sections" :key="section.title">
    <div class="drawer-section">
      <h3 style="margin:0 0 8px;font-size:13px;color:var(--ink-mute);font-weight:400;letter-spacing:0.05em;" x-text="section.title"></h3>
      <div x-html="section.html"></div>
    </div>
  </template>
</aside>`
}
```

- [ ] **Step 4: Write `src/ui/components/chat-panel.ts`**

```typescript
export const QUICK_QUESTIONS = [
  "推荐看青铜器的博物馆",
  "唐代有哪些重要事件？",
  "北京有哪些值得去的博物馆？",
]

export function ChatPanel(): string {
  return `<div class="chat-overlay" :class="chat.open ? 'open' : ''" @click="chat.open = false"></div>
<div class="chat-panel" :class="chat.open ? 'open' : ''">
  <div style="padding:14px 20px;border-bottom:0.5px solid var(--rule);display:flex;justify-content:space-between;align-items:center;">
    <h3 class="display" style="margin:0;font-size:16px;">历史顾问</h3>
    <button @click="chat.open = false" style="border:none;background:transparent;font-size:20px;cursor:pointer;">×</button>
  </div>
  <div style="flex:1;overflow-y:auto;padding:16px 20px;">
    <template x-for="(msg, i) in chat.messages" :key="i">
      <div :style="msg.role === 'user' ? 'text-align:right;margin:10px 0;' : 'text-align:left;margin:10px 0;'">
        <div style="font-size:11px;color:var(--ink-mute);" x-text="msg.role === 'user' ? '你' : '模型'"></div>
        <div style="display:inline-block;max-width:80%;padding:8px 12px;border:0.5px solid var(--rule);margin-top:2px;text-align:left;white-space:pre-wrap;" x-text="msg.content"></div>
      </div>
    </template>
    <div x-show="chat.loading" style="color:var(--ink-mute);font-size:13px;">…</div>
  </div>
  <div style="padding:8px 20px;border-top:0.5px solid var(--rule);">
    ${QUICK_QUESTIONS.map((q) => `<span class="chip" @click="chat.input='${q.replace(/'/g, "\\'")}'">${q}</span>`).join("")}
  </div>
  <div style="padding:14px 20px;display:flex;gap:12px;border-top:0.5px solid var(--rule);">
    <input class="chat-input" x-model="chat.input" @keydown.enter="sendChat()" placeholder="问我任何问题…" />
    <button @click="sendChat()" :disabled="chat.loading" style="border:none;background:transparent;color:var(--accent);font-family:var(--font-cn);cursor:pointer;font-size:15px;">发送</button>
  </div>
</div>
<button @click="chat.open = true" class="display"
  style="position:fixed;bottom:24px;right:24px;background:var(--accent);color:var(--bg);border:none;padding:12px 20px;cursor:pointer;font-size:14px;z-index:1400;">
  问 AI
</button>`
}
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/
git commit -m "feat(ui/components): sidebar, dynasty-timeline, drawer, chat-panel"
```

---

## Task 7: Client app + map + chat scripts

**Files:**
- Create: `src/ui/client/map.ts`
- Create: `src/ui/client/app.ts`
- Create: `src/ui/client/chat.ts`

- [ ] **Step 1: Write `src/ui/client/map.ts`**

```typescript
export const MAP_SCRIPT = `
window.MuseumMap = {
  map: null,
  markersLayer: null,
  init: function(centerLat, centerLng) {
    this.map = L.map('map', {
      center: window.toMapCoord(centerLat, centerLng),
      zoom: 5,
      zoomControl: true,
    });
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      attribution: '© 高德地图', maxZoom: 18, subdomains: '1234'
    }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
  },
  setMarkers: function(museums, onClick) {
    this.markersLayer.clearLayers();
    var self = this;
    museums.forEach(function(m){
      var coord = window.toMapCoord(m.lat, m.lng);
      var icon = L.divIcon({ className: '', html: '<div class="museum-marker"></div>', iconSize: [14,14] });
      var marker = L.marker(coord, { icon: icon }).addTo(self.markersLayer);
      marker.on('click', function(){ onClick(m.id); });
    });
  },
  flyTo: function(lat, lng, zoom) {
    var c = window.toMapCoord(lat, lng);
    this.map.flyTo(c, zoom || 6, { duration: 0.8 });
  }
};
`
```

- [ ] **Step 2: Write `src/ui/client/chat.ts`**

```typescript
export const CHAT_SCRIPT = `
window.MuseumChat = {
  send: async function(messages) {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: messages, system: '你是中国历史顾问，回答简短、引用具体朝代或博物馆。' }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function(){return {};});
      throw new Error(err.error || ('http ' + res.status));
    }
    var data = await res.json();
    if (data && Array.isArray(data.content) && data.content[0] && data.content[0].text) {
      return data.content[0].text;
    }
    return JSON.stringify(data);
  }
};
`
```

- [ ] **Step 3: Write `src/ui/client/app.ts`**

```typescript
export const APP_SCRIPT = `
window.museumApp = function() {
  return {
    museums: [],
    dynasties: [],
    search: '',
    currentDynastyId: null,
    selectedMuseumId: null,
    drawer: { open: false, loading: false, error: false, title: '', subtitle: '', sections: [], _loadFn: null },
    chat: { open: false, messages: [], input: '', loading: false },

    init() {
      var bs = document.getElementById('bootstrap-data');
      if (!bs) { console.error('bootstrap-data missing'); return; }
      var data = JSON.parse(bs.textContent);
      this.museums = data.museums;
      this.dynasties = data.dynasties;

      window.MuseumMap.init(35.0, 105.0);
      var self = this;
      window.MuseumMap.setMarkers(this.museums, function(id){ self.openMuseum(id); });

      if (this.dynasties.length > 0) this.selectDynasty(this.dynasties[0].id);
    },

    get filteredMuseums() {
      var q = (this.search || '').trim().toLowerCase();
      if (!q) return this.museums;
      return this.museums.filter(function(m){
        return (m.name || '').toLowerCase().indexOf(q) >= 0
            || (m.corePeriod || '').toLowerCase().indexOf(q) >= 0;
      });
    },

    selectDynasty(id) {
      this.currentDynastyId = id;
      var d = this.dynasties.find(function(x){ return x.id === id; });
      if (!d) return;
      if (d.center && d.center.lat && d.center.lng) {
        window.MuseumMap.flyTo(d.center.lat, d.center.lng, 5);
      }
    },

    async openMuseum(id) {
      this.selectedMuseumId = id;
      this.drawer = { open: true, loading: true, error: false, title: '', subtitle: '', sections: [], _loadFn: () => this.openMuseum(id) };
      var head = this.museums.find(function(x){ return x.id === id; });
      if (head) {
        this.drawer.title = head.name;
        this.drawer.subtitle = head.corePeriod || '';
      }
      try {
        var res = await fetch('/api/museums/' + encodeURIComponent(id));
        if (!res.ok) throw new Error('http ' + res.status);
        var m = await res.json();
        this.drawer.title = m.name;
        this.drawer.subtitle = (m.location || '') + (m.level ? ' · ' + m.level : '');
        this.drawer.sections = this.buildMuseumSections(m);
        this.drawer.loading = false;
      } catch (e) {
        this.drawer.loading = false;
        this.drawer.error = true;
      }
    },

    reloadDrawer() {
      if (this.drawer._loadFn) this.drawer._loadFn();
    },

    closeDrawer() {
      this.drawer.open = false;
      this.selectedMuseumId = null;
    },

    buildMuseumSections(m) {
      var sections = [];
      if (m.specialty) sections.push({ title: '特色', html: this.escape(m.specialty) });
      if (m.dynastyCoverage) sections.push({ title: '年代覆盖', html: this.escape(m.dynastyCoverage) });
      if (m.treasures && m.treasures.length) {
        sections.push({ title: '镇馆之宝', html: '<ul style="margin:0;padding-left:20px;">' + m.treasures.map(function(t){ return '<li>' + escapeHtml(t) + '</li>'; }).join('') + '</ul>' });
      }
      if (m.halls && m.halls.length) {
        sections.push({ title: '展厅', html: m.halls.map(escapeHtml).join('、') });
      }
      if (m.artifacts && m.artifacts.length) {
        sections.push({ title: '文物', html: m.artifacts.map(function(a){
          return '<div style="margin-bottom:10px;"><div class="museum-name" style="font-size:14px;">' + escapeHtml(a.name) + (a.period ? ' <span style="font-size:11px;color:var(--ink-mute);">' + escapeHtml(a.period) + '</span>' : '') + '</div><div style="font-size:13px;color:var(--ink-soft);">' + escapeHtml(a.description || '') + '</div></div>';
        }).join('') });
      }
      if (m.dynastyConnections && m.dynastyConnections.length) {
        sections.push({ title: '朝代关联', html: m.dynastyConnections.map(function(c){
          return '<div style="margin-bottom:6px;"><b>' + escapeHtml(c.dynasty) + '</b>：' + escapeHtml(c.description || '') + '</div>';
        }).join('') });
      }
      if (m.sources && m.sources.length) {
        sections.push({ title: '信源', html: m.sources.map(function(s){
          var url = /^https?:\\/\\//.test(s) ? s : null;
          return url ? '<a href="' + url + '" target="_blank" rel="noopener" style="color:var(--accent);">' + escapeHtml(url) + '</a>' : '<div>' + escapeHtml(s) + '</div>';
        }).join('<br>') });
      }
      function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
      return sections;
    },

    escape(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

    async sendChat() {
      var text = (this.chat.input || '').trim();
      if (!text || this.chat.loading) return;
      this.chat.messages.push({ role: 'user', content: text });
      this.chat.input = '';
      this.chat.loading = true;
      try {
        var reply = await window.MuseumChat.send(this.chat.messages.slice(-10));
        this.chat.messages.push({ role: 'assistant', content: reply });
      } catch (e) {
        this.chat.messages.push({ role: 'assistant', content: '（出错：' + (e.message || 'unknown') + '）' });
      } finally {
        this.chat.loading = false;
      }
    },
  };
};
`
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/client/
git commit -m "feat(ui/client): map, app store (Alpine), chat client"
```

---

## Task 8: Home page + route

**Files:**
- Create: `src/ui/home.ts`
- Create: `src/routes/home.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write `src/ui/home.ts`**

```typescript
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
```

- [ ] **Step 2: Write `src/routes/home.ts`**

```typescript
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { MuseumsRepo } from "~/repo/museums"
import { DynastiesRepo } from "~/repo/dynasties"
import { HomePage, ErrorPage } from "~/ui/home"

export const homeRoute = new Elysia().get("/", async ({ env }: { env: Env }) => {
  try {
    const museumsRepo = new MuseumsRepo(env.DB)
    const dynastiesRepo = new DynastiesRepo(env.DB)
    const [museums, dynasties] = await Promise.all([museumsRepo.list(), dynastiesRepo.listFull()])
    if (museums.length === 0) {
      return new Response(ErrorPage("数据库为空。请先运行 `bun run seed`。"), {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    return new Response(HomePage({ museums, dynasties }), {
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  } catch (e: any) {
    return new Response(ErrorPage(`数据库读取失败：${e?.message ?? "unknown"}`), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  }
})
```

- [ ] **Step 3: Mount in `src/index.ts`**

Add `.use(homeRoute)`:

```typescript
import { homeRoute } from "~/routes/home"
// ...
    .use(cdnRoute)
    .use(homeRoute)
    .use(museumsRoute)
```

- [ ] **Step 4: Add bootstrap-shape route tests**

Append to `tests/routes.test.ts`:

```typescript
describe("GET /", () => {
  it("returns 200 with bootstrap-data containing 64 museums and 20 dynasties", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/"))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('id="bootstrap-data"')
    const m = html.match(/<script id="bootstrap-data" type="application\/json">([\s\S]+?)<\/script>/)
    expect(m).not.toBeNull()
    const data = JSON.parse(m![1]!.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">"))
    expect(data.museums).toHaveLength(64)
    expect(data.dynasties).toHaveLength(20)
  })

  it("includes Google Fonts link for Source Serif 4", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const html = await (await app.handle(new Request("http://localhost/"))).text()
    expect(html).toContain("fonts.googleapis.com/css2?family=Source+Serif+4")
  })

  it("includes 宣纸 palette tokens (--bg: #F5F1E8)", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const html = await (await app.handle(new Request("http://localhost/"))).text()
    expect(html).toContain("#F5F1E8")
    expect(html).toContain("#C04A1A")
  })
})
```

- [ ] **Step 5: Run all tests → PASS**

Run: `bun test`
Expected: all PASS.

- [ ] **Step 6: Smoke**

Run dev. Open http://localhost:4242/ in browser.
Expected: 宣纸底色 + 时间轴 + 64 个 marker + 侧栏列表 + 点 marker → drawer 滑入 → 显示完整字段 + 「问 AI」按钮 → 面板滑入 → 快捷问题 chip → 填入输入框（不自动发送） → 输入消息 → 收到回复（如果上游 chat 已配置）。Stop dev.

- [ ] **Step 7: Commit**

```bash
git add src/ui/home.ts src/routes/home.ts src/index.ts tests/routes.test.ts
git commit -m "feat(ui): home page with bootstrap-data + 宣纸 visual + drawer + chat"
```

---

## Self-Review Checklist

- Bootstrap inlined as `<script id="bootstrap-data" type="application/json">` ✓
- Alpine `init()` parses bootstrap synchronously, no first-paint fetch ✓
- Drawer fetches `/api/museums/:id` on demand with loading + error + retry ✓
- WGS-84 → GCJ-02 transform applied to all map coords (markers, center, fly) ✓
- `outOfChina` skip preserved ✓
- Quick-question chips fill input (do not auto-send) — matches legacy behavior ✓
- Source links open in new tab with `rel="noopener"` ✓
- Google Fonts directly linked (not via /cdn/*) ✓
- Single accent (`#C04A1A`); no purple gradient, no emoji icons, no rounded card+left-border ✓
- Tests: coords regression + bootstrap shape + fonts present + 宣纸 tokens present ✓

---

## Hand-off

When tasks pass: full UI works in `wrangler dev`. Plan 05 wires `bun run local` adapter so the same UI runs against remote D1 + KV.
