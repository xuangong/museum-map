# 循迹 — design

2026-11-26 · status: approved in brainstorming, awaiting spec review

## What it is

A new kind of content: a **thread** — places in order plus the story that ties them — told on the
map. Two kinds in v1: **古人** (a person's journey) and **诗** (a poem whose lines trace a real
route). A thread is content in its own right; it then turns into a **trip** (行程规划), and the
trip lands on museums along the way — the loop. Museums, eras and 脚下千年 link back into threads.

Name: 循迹 (works for both 古人 and 诗). Tone: young adults, emotional value, never parent/child.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Presentation | B (auto-tour) leads; touching the sheet pauses into A (one card per stop) |
| Name | 循迹 |
| v1 threads | 古人: 苏轼 · 黄州惠州儋州, 玄奘 · 西行求法, 张骞 · 凿空西域, 李白 · 仗剑去国; 诗: 杜甫《闻官军收河南河北》, 文天祥《过零丁洋》, 李白《早发白帝城》, 王维《送元二使安西》 |
| Entry | third top tab 「循迹」 (after 时空 · 地图), map as its stage |
| Architecture | static data `src/data/threads.ts` + pure `ThreadCore` + Alpine UI, all client-side |
| Sound | every stop is a note on its era's instrument (EraSynth); the route becomes a tune |
| Pace | ~7 s per stop |
| Back-links | museum drawer, dynasty drawer, 脚下千年 — all in v1 |

## 1. Data — `src/data/threads.ts`

```ts
export interface ThreadStop {
  name: string          // ancient name as the story uses it (黄州)
  modern: string        // today's place (湖北黄冈)
  lat: number; lng: number   // WGS-84
  year: number          // negative = BCE; first year of the stay
  when: string          // display label (1080—1084)
  title: string         // ≤ 12 字 (东坡)
  story: string         // ≤ 120 字, our own words
  line?: string         // a verse / quote tied to this stop, exact text
  trip: boolean         // false for stops abroad / unreachable (story only)
  source: string        // 正史卷次 / 诗集, for fact-checking (not shown)
}
export interface Thread {
  id: string            // slug: sushi, xuanzang, zhangqian, libai, dufu-763, wentianxiang, libai-baidi, wangwei-anxi
  kind: "person" | "poem"
  title: string         // 苏轼 · 黄州惠州儋州
  who: string           // 苏轼
  era: string           // dynasty id (song)
  span: string          // 1056—1101
  intro: string         // ≤ 80 字 hook
  poem?: { title: string; text: string }   // poem threads: full text, exact
  stops: ThreadStop[]   // in travel order, ≥ 3 (poem threads may have 3)
  recording?: string    // era key into GUQIN_RECORDINGS for an end-card 听原曲 (wangwei-anxi → tang)
}
export const THREADS: Thread[]
```

- Written in our own words from standard sources (正史, 年谱, 全唐诗/全宋词). jiangshan-map's
  HISTORICAL_JOURNEYS / featured_topics (GPL) are a reference for routes only — no copied text.
- Independent fact-check pass before merge (same as the place names).
- `tests/threads.test.ts`: ids unique; `era` is a dynasty id; stops ≥ 3, years non-decreasing;
  coords in −10–60°N / 40–150°E; `trip` stops inside China (15–55°N / 73–135°E); every `line`
  of a poem thread is a substring of `poem.text`; lengths (title ≤ 12, story ≤ 120, intro ≤ 80);
  `recording` keys exist in GUQIN_RECORDINGS.

Bundled into the page bootstrap? No — served as `/assets/threads.json` (content-hashed, immutable)
and fetched the first time the 循迹 tab or a back-link opens, like place names.

## 2. Logic — `src/ui/client/thread-core.ts` (`window.ThreadCore`, pure, tested)

- `toTrip(thread) → [{ name, lat, lng, days: 1 }]`: `trip` stops in order, the city name from
  `modern` (strip the province: 湖北黄冈 → 黄冈), consecutive stops < 30 km apart merged.
- `near(threads, point, km) → [{ thread, stop, index, km }]`: stops within `km` of a point (for
  museum / 脚下千年 back-links), nearest first, one entry per thread.
- `byEra(threads, eraId)`: threads whose `era` matches (dynasty drawer).
- `notes(thread) → deg[]`: one pentatonic degree per stop — a gentle rising-and-falling contour
  (degree = 5 + round(4·sin(π·i/(n−1))) clamped to EraSynth's range), so the tune arcs and
  comes home.

## 3. Playback

State: `xunji = { list, thread, stop, playing, ended }`.

- **Play (B)**: each stop dwells 7 s: map `flyTo` the stop (zoom ~7, 1.2 s), the route so far drawn
  as a vermilion polyline with numbered stop dots (future stops faint), `EraSynth.note(era, deg)`
  on arrival. Bottom caption: `when · name` + `line` (or the story's first sentence).
- **Pause (A)**: touching/dragging the sheet, or ❚❚, pauses and expands the current stop's card
  (title, modern place, story, line). Scrolling / swiping cards moves the stop (map follows, a
  note sounds). ▶ resumes from the current stop.
- **End**: card with the whole route (map fits all stops), intro recap, and
  「把这条路变成我的行程 →」; `recording` threads add 「听原曲 · 《阳关三叠》」 (plays the excerpt via
  the same decode-and-play path as strata's 听原曲 — extract it into EraSynth as
  `EraSynth.playRecording(src) / stopRecording()` so both share it).
- Audio only after a user gesture (opening a thread is one); follows the silent switch.
- Leaving the tab / opening a drawer stops playback.

## 4. Trip conversion (the loop)

`把这条路变成我的行程`: if `trip.cities` is non-empty, confirm "替换当前行程？"; then
`trip.cities = ThreadCore.toTrip(thread)`, `trip.mode = 'transit'`, `trip.picks = []`, save,
switch to the 地图 view in trip mode (museums along the route marked by the existing trip
logic), toast "已把 N 站放进行程，沿途的馆都标出来了". Stops with `trip: false` are skipped and
the toast says "（境外的 M 站只在故事里）" when M > 0.

## 5. Back-links

- **Museum drawer**: `ThreadCore.near(threads, museum, 30)` → a line per hit
  "这座馆在 苏轼 的路上 · 第 5 站 黄州 →" opening that thread at that stop (paused, card view).
- **Dynasty drawer**: section 「循迹」 listing `byEra` threads.
- **脚下千年**: a layer whose era matches a thread and has a stop ≤ 50 km gets a chip
  "循迹 · 苏轼 第 5 站 →".
- Back-links need the threads asset; fetch lazily when the drawer/panel opens.

## 6. Interface

- **Tab**: 「循迹」 after 时空 · 地图 (`view = 'xunji'`): the map stays visible (Leaflet container
  shared with 地图 view); museum markers hidden; panel shows the picker — two groups 古人 / 诗,
  a card per thread (title, who · span, intro, stop count).
- **Phone**: bottom sheet, picker ↔ playing caption ↔ card; follows the finger by its handle
  (same `*Drag*` pattern; tap = `sheetTap('xunji')`). **Desktop**: left side panel.
- **Route**: `#/x/<id>` and `#/x/<id>/<stop>` (1-based); opening via route starts paused on
  that stop (no autoplay without a gesture). Uses `setHashRoute` with kind `'thread'`.
- Long text wraps (`overflow-wrap:anywhere`).

## 7. Testing

- `tests/threads.test.ts` (data, above), `tests/thread-core.test.ts` (toTrip merge/skip, near,
  byEra, notes range), asset route test, era-synth test for `playRecording` presence.
- Served-script parse check (`node --check` on inline scripts), typecheck, targeted tests.
- Phone checklist: tab switch keeps the map; play → pause on touch → swipe stops → resume; notes
  follow the silent switch; trip conversion lands in trip mode with museums; back-links open the
  right stop; `#/x/sushi/5` deep link.

## Out of scope (v1)

More threads (战役 / 迁都 / 丝路商队…), user-made threads, sharing posters, stamps/achievements
for completing a thread, narration (TTS).
