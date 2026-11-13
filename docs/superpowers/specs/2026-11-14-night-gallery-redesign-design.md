# 「夜展」改版 · Night Gallery Redesign

> 2026-11-14 · worktree `redesign`. The user handed over the direction ("发挥你的审美", "大胆设计", "发挥一些 3D 效果能力") and added the brief below.

## The brief, in the user's words

- Museums relate to dynasties and to places. Each dynasty's change of place is its evolution. Today's museums revisit where time and place meet: 「现代和古代的相逢」.
- There are two ways to travel, by route and by time. Neither dimension should be dropped. Where they cross, 「别有一番历史的宿命感」.
- 「博物馆实际上就是现在的历史书载体」.
- Some museums stand where the ancient place itself stood.
- 「打卡收集也是乐趣」. The site should feel tasteful: 「更显品味」.

## Why the old site needed more than a reskin

- It read like a paper magazine (cream paper, vermilion, small-caps English eyebrows, hard drop shadows), not like visiting an exhibition.
- Time and place were two separate controls: a dynasty filter, and a flat map. Nothing showed a dynasty's centre *moving*, or a museum standing on a dynasty's ground.
- Check-ins were a list. Nothing about them made collecting a pleasure.
- Fonts loaded from `fonts.googleapis.com`, which is unreachable from mainland China, so the serif design never actually appeared.
- Index thumbnails loaded 5–25 MB R2 originals and starved the bandwidth.

## Concept

**夜展 (Night Gallery)**: a hall with the ceiling lights off and only the vitrines lit.

- **暗场 (dark hall):** warm black, never pure black.
- **鎏金 (gilt):** marks lit information — numbers, the current dynasty, capitals, the stack of time.
- **朱砂 (cinnabar):** belongs to *you* — your seals, your visited places, your footprint.
- **展签 (exhibit labels):** mono metadata, bold serif Chinese names.

## The 时空 (3D strata) view — the new home

`src/ui/client/strata.ts` is a Three.js module, served at `/assets/strata.js?v=<hash>` and exposed as `window.MuseumStrata`.

- **Layers:**
  - 20 dynasties are stacked as translucent map layers: China outline, Yellow River, Yangtze.
  - Oldest is at the bottom; today's layer is on top, with the South China Sea inset drawn only on that layer.
  - Layer heights are uniform (ordering, not a time scale).
- **The trail of the centre (都城迁徙):**
  - A glowing tube follows each dynasty's capital(s) layer by layer and rises into today's layer.
  - Capitals that coexisted (南北朝, 五代十国, 宋/辽/金) get thinner side threads.
  - The Neolithic layer shows six cultures converging.
  - Data: hand-curated `src/data/dynasty-geo.ts`.
- **Museum beams:**
  - Every museum is a light point on today's layer.
  - Its beam drops through every dynasty layer it relates to (recommended/related lists), with a dot where it pierces each layer.
  - Museums that stand on a dynasty's ground (see 此地即彼时) glow brighter.
- **Recolouring by mode:**
  - all;
  - dynasty (layer lifted, its capitals labelled, unrelated beams dimmed);
  - footprint (cinnabar: your seals light their beams).
- **Interaction:**
  - drag to rotate, pinch or wheel to zoom;
  - tap a layer label or the ruler to open that dynasty;
  - tap a light point to open the museum.
  - When idle, the camera drifts slowly.
- **Camera:**
  - Frames the stack to the viewport; portrait screens stretch the stack vertically.
  - `setInset()` keeps the subject centred in whatever the drawer leaves visible.
- **Labels:**
  - A fixed time ruler on the left, with collision culling.
  - Capital labels try 16 slots around their point, capitals first; when there's no room they hide and the point stays lit.
  - The selected museum's tag is clamped clear of the view switch.
- **Fallback:**
  - If WebGL or the module fails, the app stays on the 2D map.
  - `时空 / 地图` is a view switch, remembered in `localStorage`.

## Two journeys

- **By time:** pick a dynasty and the layer lifts.
  - Its capitals move.
  - The drawer shows 都城迁徙 (from → to), 此地即彼时, culture, the chronicle, related museums and the AI guide's notes.
  - Previous/next steps walk through history.
- **By route:** a 行程 (trip) planner.
  - Add or remove from any museum.
  - Sort by geography (nearest-neighbour route) or by dynasty (chronological).
  - Shows legs in km, cities and the total distance.
  - On the map it draws a numbered gilt dashed route.
  - "让讲解员排行程" hands the trip to the AI guide.
- **此地即彼时 (crossings):** computed server-side in `src/services/crossings.ts` with haversine distance.
  - A museum within 5 km of a capital or site, or 3 km of an event, is **on-site** (原址) for any dynasty.
  - Within 30 km / 12 km counts only for dynasties already linked to the museum, so Beijing's 30 museums don't all claim every dynasty.
  - Shown in both the museum drawer and the dynasty drawer.

## Collecting: 馆印 (museum seals)

- Every museum has its own seal: `sealSpec()` in `src/services/museum-meta.ts`.
  - The text is the abbreviation people actually use (国博, 故宫, 陕历博, 兵马俑…), from overrides or rules.
  - Shape (square / rounded / circle / oval), 阴文/阳文 carving and tilt are derived from an FNV hash of the id. They are stable, and four-character seals are never round.
- 「盖章打卡」 plays a stamp-in animation, vibrates and plays a sound.
- **集章册 (passport):**
  - a seal wall;
  - collector titles (初入展厅 → 镇馆之宝级, `COLLECTOR_RANKS`, shared by app, profile and plaza);
  - per-dynasty progress bars;
  - the AI guide's notes on your collection (读后感).
- In the index, uncollected museums show their seal as a faint ghost and collected ones in cinnabar. Seals replaced the photo thumbnails.
- **Plaza:** passport cards (title + latest 6 seals). **Public profile:** the full seal wall, notes and per-dynasty notes.

## Visual system

| token | value | use |
|---|---|---|
| `--bg` / `--bg-2` | `#0D0C0B` / `#131210` | hall / bars |
| `--surface` / `-2` / `-3` | `#1A1815` / `#23201C` / `#2C2823` | drawers, cards, pressed |
| `--text` … `--text-4` | `#EFE8DA` → `#5C564B` | bone white, descending |
| `--gilt` / `-hi` / `-lo` | `#D4B072` / `#E9C98D` / `#B8924F` | lit information |
| `--seal` / `-deep` | `#E0492F` / `#B7351F` | you |
| `--patina` | `#8DB8A9` | cultural sites (vs capitals) |

- The old variable names (`--paper`, `--ink*`, `--vermilion*`, `--rule*`) remain as aliases.
- **Type:**
  - Noto Serif SC 400/700/900 for titles and labels;
  - Inter plus system Chinese for UI;
  - JetBrains Mono for numbers and metadata.
- **Font loading:**
  - Fonts are proxied same-origin: `/fonts/css2` rewrites gstatic URLs to `/fonts/g/*`, both edge-cached.
  - Loaded with preload + `onload` so the CSS never blocks rendering.
- Pill buttons, soft glows, no hard offset shadows; spring curve `cubic-bezier(.2,.9,.25,1)`.
- `prefers-reduced-motion` disables all of it.
- Three.js r170 is proxied at `/cdn/three.module.js`.

## Screens

1. **Top bar:**
   - cinnabar 「博」 seal;
   - 「中国博物馆地图 · WHERE TIME MEETS PLACE」;
   - stats;
   - 广场, 行程 N, 集章 N.
2. **Dynasty timeline:**
   - SSR + imperative `syncTimeline()` as before.
   - Ruler styling, gilt underline on the current dynasty, cinnabar dot where you have seals.
   - No `mask-image`; the fades are pseudo-elements.
3. **Canvas:**
   - 时空 (3D) / 地图 view switch.
   - On desktop, floating controls re-centre on the part not covered by the drawer.
   - Map: night-filtered AutoNavi tiles, glowing markers, 附近 (locate), trip route.
4. **Dock (mobile):** 索引 / 摇一摇 / AI 讲解 (desktop has no 索引).
5. **Museum drawer:**
   - Header and seal:
     - full-bleed hero (first artifact image) with the name over it;
     - your seal (盖章打卡 / stamped with date and undo);
     - 加入行程.
   - Sections:
     - 此地即彼时;
     - 镇馆之宝;
     - 展柜 (one vitrine per artifact);
     - 馆史 (the `timeline` field, previously hidden);
     - labels;
     - related dynasties (jump into the layer);
     - sources.
   - **Mobile bottom-sheet behaviour:**
     - It opens at **peek** height so the 3D or map stays visible, and expands when you scroll or tap the grabber.
     - It never goes above the timeline.
     - A scrim fades scrolled text under the floating buttons.
     - Hopping museum → museum keeps it expanded.
6. **Dynasty drawer:**
   - glyph watermark;
   - 都城迁徙;
   - 此地即彼时;
   - culture cards;
   - chronicle;
   - recommended/related museums (with seals);
   - previous/next;
   - AI notes (guide card).
7. **Index (desktop sidebar / mobile sheet):**
   - Heads: 全部 (今天的历史书), dynasty, 集章册, 行程.
   - Tier segmented control, search, sort (default / by city / by distance), seal thumbnails.
8. **AI 讲解员** (formerly 历史顾问): dark panel, gilt-ruled guide cards, quick questions about time journeys and route journeys.
9. **Plaza / profile / share page:**
   - All three use the same tokens and components.
   - The poster SVG and the long-image export are untouched; they are prints, and they look good on a dark wall.

## Data changes (read-only, backward compatible)

- `MuseumListItem` gains `city` (from `deriveCity(location)`) and `seal` (`SealSpec`). `cover` was removed again: the index shows seals.
- Bootstrap JSON gains `dynastyGeo` (curated capitals/trails) and `crossings` (computed per request).
- `PlazaEntry.recentSeals`: one extra query (window function, ≤ 6 per user).
- No migrations, no writes, and no change to any API contract that other clients use.

## Constraints (from past incidents)

- The timeline stays pure SSR + imperative sync; no `mask-image` or `backdrop-filter` near it.
- Long strings in drawers keep `overflow-wrap: anywhere`.
- Inputs stay at 16px; safe-area insets apply.
- The long-image and poster generation logic is untouched (it carries the WeChat/HarmonyOS fixes).
- `x-data` placement is unchanged; no `x-init="init()"`.

## Verification

- `bun run typecheck`.
- `bun test`: the baseline was 163 pass with 2 old image-enricher failures. Now 173 pass and the same 2 fail; the new tests cover meta, crossings and font rewriting.
- Local `wrangler dev` plus Playwright with GPU-backed WebGL:
  - phone 390×844 and desktop 1440×900;
  - home, dynasty (open and closed), museum (peek, expanded, vitrines), stamp, 集章册, map, trip, index, AI, plaza, profile.
- Merge and deploy wait for the user's go-ahead.

## Follow-ups (not in this change)

- Many R2 originals are 5–25 MB, and the drawer hero and vitrines use them at full size. They need resized derivatives (e.g. generated on upload, or Cloudflare Image Resizing).
