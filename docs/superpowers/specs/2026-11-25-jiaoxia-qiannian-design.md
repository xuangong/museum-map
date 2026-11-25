# 脚下千年 — design

2026-11-25 · status: approved in brainstorming, awaiting spec review

## What it is

Pick any point on the map — or "where I stand" — and read that piece of land down through time:
what it was called in each era, what happened near it, and which museum holds that era's things
close by. Today's name sits on top, the oldest layer at the bottom — the same metaphor as 时空地层.

Tone: young adults, emotional value, never a parent/child voice (see user-preferences memory).
Header copy: "此地曾是 长安" / "你脚下这片土地，走过了这些年".

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Ancient names | B — curate a city-level place-name lineage (~70 cities) |
| Entry points | A — long-press / right-click map, a button next to locate, a line in the museum drawer |
| Layout | A — strata list, newest on top, tap a layer to expand |
| Architecture | client-only; place names as a lazily loaded static asset; pure logic module |
| Sound | yes, in v1 — tapping a layer plays that era's instrument |
| Radii | names ≤ 40 km, events ≤ 50 km, museums ≤ 100 km |

## 1. Data — `src/data/place-names.ts`

```ts
export interface PlaceName { era: string; name: string; note?: string } // era = dynasty id
export interface PlaceLineage { id: string; name: string; lat: number; lng: number; names: PlaceName[] }
export const PLACE_LINEAGES: PlaceLineage[]
```

- `name` = today's name (e.g. 西安); `lat/lng` WGS-84 city centre; `names` in dynasty order,
  only eras where a name is attested (e.g. 西周 丰镐, 秦 咸阳, 西汉 长安, 隋 大兴城, 唐 长安,
  宋 京兆府, 元 奉元, 明 西安府; `note` for short context like "汉长安城在今城西北").
- Coverage: every city that hosts one of our museums, plus capitals/sites that recur in
  `data/dynasties/*.yaml` events. About 70 entries.
- Drafted by AI from standard sources, cross-checked against jiangshan-map's
  `PLACE_GAZETTEER` (GPL — reference only, no copied text), worded by us.
- `tests/place-names.test.ts`: every `era` is a real dynasty id; names ordered by dynasty
  `order_index`; coords inside 15–55°N / 70–140°E; ≥ 3 names per city; no duplicate ids.

Served as `/assets/place-names.js` (sets `window.PLACE_LINEAGES`), fetched the first time the
panel opens, long-cached like the other assets.

## 2. Logic — `src/ui/client/here-core.ts` (`window.HereCore`)

Pure, shipped as a script string like `trip-core.ts` and evaluated as-is by tests.

```
HereCore.read(point, { dynasties, museums, lineages, links }) → {
  point, city: { id, name, km } | null,      // nearest lineage city within 40 km
  layers: [{ dynastyId, name?, note?,         // ancient name for this era (from city)
             events: [{ ...event, km }],       // ≤ 50 km, sorted by year
             museums: [{ id, name, km }] }],   // linked to this dynasty, ≤ 100 km, ≤ 2, nearest first
  nearest: { event, km } | null               // only when layers is empty
}
```

- `links` = dynasty → museum ids (recommendedMuseums with museumId + era links already in
  bootstrap).
- A layer appears only if it has a name, an event or a museum. Layers ordered newest first.
- Headline name: the most recent era's ancient name; with no city in range the header reads
  "此地（距 西安 85 km）".
- Empty result (desert, sea): "这里的千年还没写进我们的地图 —— 最近的故事在 X km 外" + jump.
- Distances via the same haversine as TripCore.

## 3. UI

- **Panel**: header (kicker `脚下千年 · 34.26°N 108.94°E`, title `此地曾是 长安`, subtitle),
  then the layers. Collapsed layer: era · ancient name · years, first 1–2 events in one line,
  museum chips with km. Expanded: all events + museums. Layers without events are dimmed.
- **Map**: vermilion pin + dashed 50 km ring at the point; tapping an event flies to it and
  highlights its marker; tapping a museum chip opens the museum drawer.
- **Mobile**: bottom sheet, full → half → title bar, follows the finger by its handle
  (same `*Drag*` pattern as chat/trip; tap = `sheetTap`). **Desktop**: right-side panel.
- **Route**: hash `#here=34.26,108.94` so a reading can be shared/reopened; closing clears it
  without `history.back()` (same as closeDrawer).
- Long strings must wrap (`overflow-wrap:anywhere`).

## 4. Entry points

1. Map long-press (~500 ms, cancelled by move > 8 px or a second touch) / desktop `contextmenu`.
   Disabled in trip mode (its single-click stays as is).
2. A `脚下千年` button beside the locate button — locates, then opens the panel at the user.
3. Museum drawer: a line `此馆所在 · 脚下千年 →` opening the panel at the museum.

## 5. Sound

Extract the instrument synth from `strata.ts` (VOICES, `stringSound` and helpers, ERA voices)
into `src/ui/client/era-synth.ts` (`window.EraSynth.note(eraId, deg)`), used by both strata and
the panel. It goes through `window.MMAudio` (follows the silent switch). Expanding a layer plays
one note of that era's instrument; no autoplay on open. Strata behaviour must not change.

## 6. Testing

- `tests/here-core.test.ts`: Xi'an point → 长安 headline, 唐/西汉 layers with events, museum
  chips within 100 km; a Taklamakan point → empty with `nearest`; a point 60 km from any city →
  no names but events; radius edges.
- `tests/place-names.test.ts` (above).
- Existing strata/audio tests still pass after the synth extraction; typecheck.
- Manual on phone: long-press doesn't fire during pan/pinch; trip-mode click unaffected;
  sheet drags; sound follows silent switch.

## Out of scope (v1)

Server API for the AI guide, stamps/achievements for readings, journeys (古人行迹), sharing
posters.
