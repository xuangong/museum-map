# 脚下千年 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-press any map point (or "where I stand", or from a museum) and read that land down through the eras — its ancient names, nearby events, and museums holding that era — in a strata-list panel, with each layer sounding its era's instrument.

**Architecture:** Client-only. A curated city-level place-name lineage (`src/data/place-names.ts`) is served as a content-hashed JSON asset and fetched on first open. A pure module `HereCore` (script string, like `TripCore`) turns a point + bootstrap data into layers. The panel is a new Alpine component following the chat sheet's patterns. The instrument synth is extracted from the strata ES module into a shared classic script `EraSynth` so the panel can play notes without loading three.js.

**Tech Stack:** Bun + Elysia (Cloudflare Workers runtime), server-rendered HTML + Alpine.js, Leaflet 1.9.4, Web Audio via `window.MMAudio`, bun:test.

**Spec:** `docs/superpowers/specs/2026-11-25-jiaoxia-qiannian-design.md`

## Ground rules for every task

- `src/ui/client/app.ts`, `map.ts`, `strata.ts`, `trip-core.ts` and the new `here-core.ts` / `era-synth.ts` are **JS inside a template literal**. Every backslash in client JS must be doubled (`\\d`, `\\/`), and `${` must not appear except as intended interpolation.
- Coordinates in data are WGS-84 `{lat, lng}`. Leaflet works in GCJ-02: use `window.toMapCoord(lat, lng)` to draw and `window.fromMapCoord(gLat, gLng)` (returns `[lat, lng]`) to read a click.
- Copy is for young adults: warm, concrete, never child/parent tone.
- `bun test` reseeds the local D1 with legacy data. After running the full suite, run `bun run restore -- --target=local --confirm` before any manual check.
- Baseline: on `main` at 9dc260e, `bun test` has **10 pre-existing failures** (achievements route, scrolls, `/api/museums` count, image enricher, `/s/:id`). A task is green when it adds no new failures.
- Commit after each task with a `Co-Authored-By: Claude <noreply@anthropic.com>` trailer.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/data/place-names.ts` | create | `PLACE_LINEAGES` data + types |
| `tests/place-names.test.ts` | create | data validation |
| `src/ui/client/here-core.ts` | create | `HERE_CORE_SCRIPT` → `window.HereCore` (pure) |
| `tests/here-core.test.ts` | create | logic tests |
| `src/routes/assets.ts` | modify | serve `/assets/place-names.json`, export `PLACE_NAMES_SRC` |
| `tests/assets-place-names.test.ts` | create | route test |
| `src/ui/client/era-synth.ts` | create | `ERA_SYNTH_SCRIPT` → `window.EraSynth` |
| `src/ui/client/strata.ts` | modify | use `window.EraSynth` instead of its own synth block |
| `tests/era-synth.test.ts` | create | synth script loads, `note()` safe without audio |
| `src/ui/client/map.ts` | modify | `onLongPress`, `setHere`, `clearHere` |
| `src/ui/components/here-panel.ts` | create | `HerePanel()` markup |
| `src/ui/client/app.ts` | modify | `here` state, open/close, drag, hash route, entries, sound |
| `src/ui/home.ts` | modify | include scripts, panel, button, bootstrap `placeNamesUrl` |
| `src/ui/theme.ts` | modify | panel + pin CSS |

---

### Task 1: Place-name lineage data

**Files:**
- Create: `src/data/place-names.ts`
- Test: `tests/place-names.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/place-names.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { parse } from "yaml"
import { PLACE_LINEAGES } from "~/data/place-names"

const dyn = readdirSync("data/dynasties").map((f) => parse(readFileSync(`data/dynasties/${f}`, "utf8")))
const order: Record<string, number> = Object.fromEntries(dyn.map((d: any) => [d.id, d.order_index]))
const museums = readdirSync("data/museums").map((f) => parse(readFileSync(`data/museums/${f}`, "utf8")))

describe("PLACE_LINEAGES", () => {
  it("has ~70 cities with unique ids", () => {
    expect(PLACE_LINEAGES.length).toBeGreaterThanOrEqual(60)
    expect(new Set(PLACE_LINEAGES.map((c) => c.id)).size).toBe(PLACE_LINEAGES.length)
  })
  it("every entry is well-formed", () => {
    for (const c of PLACE_LINEAGES) {
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.lat).toBeGreaterThan(15); expect(c.lat).toBeLessThan(55)
      expect(c.lng).toBeGreaterThan(70); expect(c.lng).toBeLessThan(140)
      expect(c.names.length).toBeGreaterThanOrEqual(3)
      let prev = -1
      for (const n of c.names) {
        expect(order[n.era]).toBeDefined()           // a real dynasty id
        expect(order[n.era]).toBeGreaterThan(prev)    // one name per era, oldest first
        prev = order[n.era]
        expect(n.name.trim().length).toBeGreaterThan(0)
      }
    }
  })
  it("covers most museum cities (a lineage within 40 km of ≥ 85% of museums)", () => {
    const km = (a: any, b: any) => {
      const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
      return 12742 * Math.asin(Math.sqrt(h))
    }
    const covered = museums.filter((m: any) => PLACE_LINEAGES.some((c) => km(c, m) <= 40))
    expect(covered.length / museums.length).toBeGreaterThanOrEqual(0.85)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/place-names.test.ts`
Expected: FAIL — cannot resolve `~/data/place-names`.

- [ ] **Step 3: Write the types and the data**

File header and types (exact):

```ts
/**
 * 脚下千年 — what a piece of land was called, era by era (city level).
 * `era` is a dynasty id (data/dynasties/<id>.yaml); names are listed oldest first, one per era,
 * only where a name is attested. `name` on the city is today's name; coords WGS-84 city centre.
 * Cross-checked against jiangshan-map's PLACE_GAZETTEER (GPL — used as a reference only;
 * no text copied). tests/place-names.test.ts validates ids, order and coverage.
 */
export interface PlaceName { era: string; name: string; note?: string }
export interface PlaceLineage { id: string; name: string; lat: number; lng: number; names: PlaceName[] }

export const PLACE_LINEAGES: PlaceLineage[] = [
  { id: "xian", name: "西安", lat: 34.26, lng: 108.94, names: [
    { era: "western-zhou", name: "丰镐", note: "丰京、镐京夹沣水而立" },
    { era: "qin", name: "咸阳", note: "秦都在渭北，今城西北" },
    { era: "western-han", name: "长安" },
    { era: "eastern-han", name: "长安", note: "西京" },
    { era: "sui", name: "大兴城" },
    { era: "tang", name: "长安" },
    { era: "song", name: "京兆府" },
    { era: "yuan", name: "奉元路" },
    { era: "ming", name: "西安府" },
    { era: "qing", name: "西安府" },
  ] },
  // … remaining cities
]
```

Build the city list, then fill it:

1. List candidate cities: every distinct museum city (`grep -h "^city:" data/museums/*.yaml | sort -u`) plus event hubs (run the snippet below and take places with ≥ 3 events that are > 40 km from any museum city).

```bash
bun -e 'import {parse} from "yaml";import {readdirSync,readFileSync} from "fs";const c=new Map();for(const f of readdirSync("data/dynasties")){for(const e of parse(readFileSync("data/dynasties/"+f,"utf8")).events){const k=e.lat.toFixed(1)+","+e.lng.toFixed(1);c.set(k,(c.get(k)||[]).concat(e.event.slice(0,12)))}}[...c].filter(([k,v])=>v.length>=3).forEach(([k,v])=>console.log(k,v.length,v[0]))'
```

2. For each city write the lineage from standard historical geography (e.g. 谭其骧《中国历史地图集》-level facts): the seat/name in each era where the city was a named seat. Use the dynasty ids exactly: `neolithic, xia, shang, western-zhou, eastern-zhou, qin, western-han, eastern-han, three-kingdoms, jin, nanbeichao, sui, tang, wudai, liao, song, jin-jurchen, yuan, ming, qing`. For prehistoric/early layers name a site only when the city sits on it (二里头→洛阳, 殷→安阳, 良渚→杭州). Use `note` (≤ 20 字) for useful context, e.g. "汉长安城在今城西北".
3. Cross-check each name against `/Users/xian/projects/jiangshan-map/js/lore_core.js` `PLACE_GAZETTEER` (names + aliases) — load with `new Function("window", src)(w)` as in `/tmp/jsm/dump.ts`. Where the gazetteer disagrees, resolve with a standard reference; never copy its wording.
4. Keep the array sorted by `id`.

- [ ] **Step 4: Run the test**

Run: `bun test tests/place-names.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/place-names.ts tests/place-names.test.ts
git commit -m "data(place-names): era-by-era names for ~70 cities — the ground 脚下千年 reads"
```

---

### Task 2: HereCore — the pure reading

**Files:**
- Create: `src/ui/client/here-core.ts`
- Test: `tests/here-core.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/here-core.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { parse } from "yaml"
import { HERE_CORE_SCRIPT } from "~/ui/client/here-core"
import { PLACE_LINEAGES } from "~/data/place-names"

const w: any = {}
new Function("window", HERE_CORE_SCRIPT)(w)
const H = w.HereCore

const XA = { lat: 34.26, lng: 108.94 }
const fx = {
  lineages: [{ id: "xian", name: "西安", lat: 34.26, lng: 108.94, names: [
    { era: "qin", name: "咸阳" }, { era: "western-han", name: "长安" }, { era: "tang", name: "长安" }, { era: "ming", name: "西安府" } ] }],
  museums: [
    { id: "shaanxi", name: "陕西历史博物馆", lat: 34.22, lng: 108.95 },
    { id: "far", name: "远馆", lat: 30.0, lng: 120.0 },
  ],
  dynasties: [
    { id: "qin", events: [{ date: "前246年", event: "骊山陵动工", lat: 34.38, lng: 109.27 }], recommendedMuseums: [], relatedMuseums: [] },
    { id: "western-han", events: [{ date: "前138年", event: "张骞出使", lat: 34.3, lng: 108.9 }, { date: "前202年", event: "定都长安", lat: 34.3, lng: 108.9 }],
      recommendedMuseums: [{ museumId: "shaanxi" }, { museumId: "far" }], relatedMuseums: [] },
    { id: "sui", events: [{ date: "605年", event: "远处的事", lat: 30.0, lng: 120.0 }], recommendedMuseums: [], relatedMuseums: [] },
    { id: "tang", events: [], recommendedMuseums: [], relatedMuseums: [{ museumId: "shaanxi" }] },
    { id: "ming", events: [], recommendedMuseums: [], relatedMuseums: [] },
  ],
}

describe("HereCore.year", () => {
  it("reads BCE, ranges and 约", () => {
    expect(H.year("前221年")).toBe(-221)
    expect(H.year("627—649年")).toBe(627)
    expect(H.year("约前1300年")).toBe(-1300)
    expect(H.year("")).toBe(0)
  })
})

describe("HereCore.read", () => {
  const r = H.read(XA, fx)
  it("finds the city within 40 km", () => {
    expect(r.city.name).toBe("西安")
    expect(r.city.km).toBeLessThan(1)
  })
  it("orders layers newest first and drops empty eras", () => {
    expect(r.layers.map((l: any) => l.dynastyId)).toEqual(["ming", "tang", "western-han", "qin"])
  })
  it("sorts events by year and keeps only those ≤ 50 km", () => {
    const han = r.layers.find((l: any) => l.dynastyId === "western-han")
    expect(han.events.map((e: any) => e.event)).toEqual(["定都长安", "张骞出使"])
    expect(r.layers.find((l: any) => l.dynastyId === "sui")).toBeUndefined()
  })
  it("lists linked museums ≤ 100 km with km", () => {
    const han = r.layers.find((l: any) => l.dynastyId === "western-han")
    expect(han.museums.map((m: any) => m.id)).toEqual(["shaanxi"])
    expect(han.museums[0].km).toBeGreaterThan(0)
    expect(r.layers.find((l: any) => l.dynastyId === "tang").museums[0].id).toBe("shaanxi")
  })
  it("headline = most frequent ancient name, ignoring today's name", () => {
    expect(H.headline(r)).toBe("长安")
  })
  it("no city in range → names absent, nearCity reported", () => {
    const p = { lat: 34.26, lng: 109.9 } // ~88 km east
    const q = H.read(p, fx)
    expect(q.city).toBeNull()
    expect(q.nearCity.name).toBe("西安")
    expect(q.nearCity.km).toBeGreaterThan(80)
    expect(q.layers.every((l: any) => !l.name)).toBe(true)
  })
  it("empty land → no layers, nearest story reported", () => {
    const q = H.read({ lat: 39.0, lng: 83.0 }, fx) // Taklamakan
    expect(q.layers).toEqual([])
    expect(q.nearest.event.event).toBeTruthy()
    expect(q.nearest.km).toBeGreaterThan(1000)
  })
})

describe("HereCore.read on real data", () => {
  const dynasties = readdirSync("data/dynasties").map((f) => parse(readFileSync(`data/dynasties/${f}`, "utf8")))
    .sort((a: any, b: any) => a.order_index - b.order_index)
    .map((d: any) => ({ id: d.id, events: d.events, recommendedMuseums: (d.recommended_museums || []).map((r: any) => ({ museumId: r.museum_id })), relatedMuseums: [] }))
  const museums = readdirSync("data/museums").map((f) => parse(readFileSync(`data/museums/${f}`, "utf8")))
    .map((m: any) => ({ id: m.id, name: m.name, lat: m.lat, lng: m.lng }))
  it("Xi'an reads as 长安 with a Tang layer full of events", () => {
    const r = H.read(XA, { dynasties, museums, lineages: PLACE_LINEAGES })
    expect(H.headline(r)).toBe("长安")
    const tang = r.layers.find((l: any) => l.dynastyId === "tang")
    expect(tang.name).toBe("长安")
    expect(tang.events.length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/here-core.test.ts`
Expected: FAIL — cannot resolve `~/ui/client/here-core`.

- [ ] **Step 3: Implement**

```ts
// src/ui/client/here-core.ts
// 脚下千年's pure logic, shipped to the page as window.HereCore and evaluated as-is by the tests.
// read(point, { dynasties (oldest first), museums, lineages }) → the land at that point, era by era.
// Coordinates are WGS-84 {lat, lng}; distances are km.
export const HERE_CORE_SCRIPT = `
(function(global){
  var R_NAME = 40, R_EVENT = 50, R_MUSEUM = 100, MAX_MUSEUMS = 2;
  function km(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /** First year in a date label: "前221年" → -221, "627—649年" → 627, "约前1300年" → -1300. */
  function year(date) {
    var m = String(date || '').match(/(前)?(\\d+)/);
    return m ? (m[1] ? -1 : 1) * Number(m[2]) : 0;
  }
  function nearestOf(p, list) {
    var best = null;
    (list || []).forEach(function(c){
      if (c.lat == null || c.lng == null) return;
      var d = km(p, c);
      if (!best || d < best.km) best = { item: c, km: d };
    });
    return best;
  }
  function read(p, ctx) {
    ctx = ctx || {};
    var near = nearestOf(p, ctx.lineages);
    var city = near && near.km <= R_NAME ? near.item : null;
    var byId = {};
    (ctx.museums || []).forEach(function(m){ byId[m.id] = m; });
    var layers = [];
    (ctx.dynasties || []).forEach(function(d){
      var nm = null;
      if (city) for (var i = 0; i < city.names.length; i++) if (city.names[i].era === d.id) { nm = city.names[i]; break; }
      var events = (d.events || []).filter(function(e){ return e.lat != null && e.lng != null; })
        .map(function(e){ return { date: e.date, event: e.event, lat: e.lat, lng: e.lng, km: km(p, e) }; })
        .filter(function(e){ return e.km <= R_EVENT; })
        .sort(function(a, b){ return year(a.date) - year(b.date); });
      var seen = {}, ms = [];
      (d.recommendedMuseums || []).concat(d.relatedMuseums || []).forEach(function(r){
        var m = r && r.museumId && byId[r.museumId];
        if (!m || seen[m.id] || m.lat == null) return;
        seen[m.id] = true;
        var k = km(p, m);
        if (k <= R_MUSEUM) ms.push({ id: m.id, name: m.name, km: k });
      });
      ms.sort(function(a, b){ return a.km - b.km; });
      if (nm || events.length || ms.length) layers.push({
        dynastyId: d.id, name: nm ? nm.name : null, note: nm && nm.note ? nm.note : null,
        events: events, museums: ms.slice(0, MAX_MUSEUMS),
      });
    });
    layers.reverse();
    var nearest = null;
    if (!layers.length) {
      (ctx.dynasties || []).forEach(function(d){
        (d.events || []).forEach(function(e){
          if (e.lat == null || e.lng == null) return;
          var k = km(p, e);
          if (!nearest || k < nearest.km) nearest = { event: { date: e.date, event: e.event, lat: e.lat, lng: e.lng, dynastyId: d.id }, km: k };
        });
      });
    }
    return {
      point: { lat: p.lat, lng: p.lng },
      city: city ? { id: city.id, name: city.name, km: near.km } : null,
      nearCity: near ? { id: near.item.id, name: near.item.name, km: near.km } : null,
      layers: layers,
      nearest: nearest,
    };
  }
  /** The name the land is best remembered by: most frequent ancient name that isn't today's; ties → the newer. */
  function headline(r) {
    if (!r || !r.city) return null;
    var count = {}, best = null;
    r.layers.forEach(function(l){            // newest first, so the first to reach a count wins ties
      if (!l.name || l.name === r.city.name) return;
      count[l.name] = (count[l.name] || 0) + 1;
    });
    r.layers.forEach(function(l){
      if (!l.name || !count[l.name]) return;
      if (!best || count[l.name] > count[best]) best = l.name;
    });
    return best;
  }
  global.HereCore = { read: read, headline: headline, year: year, km: km, R_NAME: R_NAME, R_EVENT: R_EVENT, R_MUSEUM: R_MUSEUM };
})(window);
`
```

- [ ] **Step 4: Run the tests**

Run: `bun test tests/here-core.test.ts`
Expected: PASS (all). If the real-data test fails on the headline, check `PLACE_LINEAGES` for Xi'an — the data, not the rule, is wrong.

- [ ] **Step 5: Commit**

```bash
git add src/ui/client/here-core.ts tests/here-core.test.ts
git commit -m "feat(here): HereCore reads a point era by era — names ≤ 40 km, events ≤ 50 km, museums ≤ 100 km"
```

---

### Task 3: Serve the lineage as a hashed asset

**Files:**
- Modify: `src/routes/assets.ts`
- Test: `tests/assets-place-names.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/assets-place-names.test.ts
import { describe, it, expect } from "bun:test"
import { assetsRoute, PLACE_NAMES_SRC } from "~/routes/assets"
import { PLACE_LINEAGES } from "~/data/place-names"

describe("/assets/place-names.json", () => {
  it("serves the lineages, immutable-cached, under a content-hashed URL", async () => {
    expect(PLACE_NAMES_SRC).toMatch(/^\/assets\/place-names\.json\?v=[0-9a-z]+$/)
    const res = await assetsRoute.handle(new Request("http://x/assets/place-names.json"))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("immutable")
    const body = await res.json()
    expect(body.length).toBe(PLACE_LINEAGES.length)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/assets-place-names.test.ts`
Expected: FAIL — `PLACE_NAMES_SRC` is not exported.

- [ ] **Step 3: Implement** — in `src/routes/assets.ts` add:

```ts
import { PLACE_LINEAGES } from "~/data/place-names"

const PLACE_NAMES_JSON = JSON.stringify(PLACE_LINEAGES)
/** City-level era names for 脚下千年, fetched the first time the panel opens. */
export const PLACE_NAMES_SRC = `/assets/place-names.json?v=${shortHash(PLACE_NAMES_JSON)}`
```

and chain onto `assetsRoute`:

```ts
  .get(
    "/assets/place-names.json",
    () =>
      new Response(PLACE_NAMES_JSON, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": IMMUTABLE },
      }),
  )
```

- [ ] **Step 4: Run the test**

Run: `bun test tests/assets-place-names.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/assets.ts tests/assets-place-names.test.ts
git commit -m "feat(here): serve the place-name lineages as a hashed, immutable asset"
```

---

### Task 4: Extract the era synth into `EraSynth`

The strata module (`src/ui/client/strata.ts`, lines ~62–232: `PENTA` … end of `stringSound`) holds the whole synth. Move it verbatim into a classic script that exposes `window.EraSynth`; strata then reads from it. Strata behaviour must not change.

**Files:**
- Create: `src/ui/client/era-synth.ts`
- Modify: `src/ui/client/strata.ts`
- Modify: `src/ui/home.ts` (include script before the strata module)
- Test: `tests/era-synth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/era-synth.test.ts
import { describe, it, expect } from "bun:test"
import { ERA_SYNTH_SCRIPT } from "~/ui/client/era-synth"
import { ERA_VOICES } from "~/data/era-voices"

describe("EraSynth", () => {
  const w: any = {}
  new Function("window", ERA_SYNTH_SCRIPT)(w)
  const S = w.EraSynth
  it("exposes the synth surface strata relies on", () => {
    for (const k of ["degFreq", "MAX_DEG", "VOICES", "makeGraph", "stringSound", "audioCtx", "unlock", "ctx", "master", "note"]) expect(S[k]).toBeDefined()
    expect(S.degFreq(0)).toBeCloseTo(98, 5)
  })
  it("maps every era to a known voice", () => {
    for (const id of Object.keys(ERA_VOICES)) expect(S.VOICES[S.voiceOf(id)]).toBeDefined()
    expect(S.voiceOf("nope")).toBe("ks")
  })
  it("note() is a silent no-op without Web Audio", () => {
    expect(() => S.note("tang", 7)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test tests/era-synth.test.ts`
Expected: FAIL — cannot resolve `~/ui/client/era-synth`.

- [ ] **Step 3: Create `src/ui/client/era-synth.ts`**

```ts
// src/ui/client/era-synth.ts
// The era instruments, shared by 时空地层 (strata.ts) and 脚下千年. A classic script that sets
// window.EraSynth; audio goes through window.MMAudio (follows the silent switch, survives iOS
// interruptions). Moved verbatim from strata.ts — keep the two in step only through this file.
import { ERA_VOICES } from "../../data/era-voices"

export const ERA_SYNTH_SCRIPT = `
(function(global){
  var window = global;
  // ⟨PASTE strata.ts lines from "// Pitches are degrees of a pentatonic ladder" through the closing
  //  brace of stringSound(), EXCEPT the two lines "const ERA = …" and "const TUNES = …" and "const esc = …",
  //  converting nothing else — const/let/arrow functions are fine in a classic script.⟩
  const ERA = ${JSON.stringify(ERA_VOICES)};
  function voiceOf(eraId) { const e = ERA[eraId]; return e && VOICES[e.voice] ? e.voice : 'ks'; }
  /** One note of an era's instrument, inside a user gesture. Silent if audio is unavailable. */
  function note(eraId, deg, vel) {
    try {
      unlockAudio();
      const ac = audioCtx();
      if (!ac || !master) return [];
      return stringSound(deg == null ? 7 : deg, vel == null ? 0.9 : vel, 0, ac.currentTime + 0.01, voiceOf(eraId));
    } catch (e) { return []; }
  }
  global.EraSynth = {
    PENTA: PENTA, MAX_DEG: MAX_DEG, degFreq: degFreq, VOICES: VOICES, ERA: ERA,
    makeGraph: makeGraph, ksBuffer: ksBuffer, stringSound: stringSound,
    audioCtx: audioCtx, unlock: unlockAudio, ctx: function(){ return actx; }, master: function(){ return master; },
    voiceOf: voiceOf, note: note,
  };
})(window);
`
```

The `⟨PASTE …⟩` comment is an instruction, not code: replace it with the exact block cut from strata (Step 4). In a Workers/bun test environment `window.MMAudio`, `AudioContext` are absent, so `audioCtx()` returns `null` and `note()` returns `[]`.

- [ ] **Step 4: Rewire strata**

In `src/ui/client/strata.ts`:
1. Cut the synth block (from `// Pitches are degrees of a pentatonic ladder` through the end of `stringSound`), leaving `const ERA = …`, `const TUNES = …`, `const esc = …` in place (strata uses them).
2. Where the block was, insert:

```js
// The instruments live in window.EraSynth (src/ui/client/era-synth.ts), shared with 脚下千年.
const SYN = window.EraSynth;
const { PENTA, MAX_DEG, degFreq, VOICES, makeGraph, ksBuffer, stringSound } = SYN;
const audioCtx = () => SYN.audioCtx();
const unlockAudio = () => SYN.unlock();
```

3. Replace the three remaining direct uses outside the block (find with `grep -n "actx\|\bmaster\b" src/ui/client/strata.ts`): `master` → `SYN.master()`, `actx.currentTime` → `SYN.ctx().currentTime`.
4. Remove the now-unused `import`? No — `ERA_VOICES` is still used by strata's `const ERA`. Keep imports.

In `src/ui/home.ts`, add `import { ERA_SYNTH_SCRIPT } from "./client/era-synth"` and insert `<script>${ERA_SYNTH_SCRIPT}</script>` **after** `<script>${APP_SCRIPT}</script>` (MMAudio is defined in APP_SCRIPT) and before the strata `<script type="module">`.

- [ ] **Step 5: Run tests + typecheck**

Run: `bun test tests/era-synth.test.ts tests/era-voices.test.ts && bun run typecheck`
Expected: PASS, no type errors. Then `grep -c "function stringSound" src/ui/client/strata.ts` → `0`.

- [ ] **Step 6: Manual strata check**

`bun run restore -- --target=local --confirm && bun run dev`, open `http://localhost:8787`, switch to 时空 view, tap a stratum and play 奏一曲: same sounds as before, no console errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/client/era-synth.ts src/ui/client/strata.ts src/ui/home.ts tests/era-synth.test.ts
git commit -m "refactor(audio): the era instruments move out of the strata module into a shared EraSynth"
```

---

### Task 5: Map hooks — long-press and the here pin

**Files:**
- Modify: `src/ui/client/map.ts`
- Modify: `src/ui/theme.ts`

Leaflet 1.9.4 already fires `contextmenu` for desktop right-click, Android long-press, and iOS Safari long-press (`tapHold`). A small timer covers webviews where `tapHold` is off (WeChat iOS). Both paths are de-duplicated.

- [ ] **Step 1: Add the layer** — in `init`, after `this.userLayer = …`:

```js
    this.hereLayer = L.layerGroup().addTo(this.map);
```

- [ ] **Step 2: Add the methods** (after `onMapClick`):

```js
  /** Long-press / right-click on the map (GCJ latlng); null to stop. */
  onLongPress: function(cb) {
    this._longPress = cb;
    if (this._lpBound || !this.map) return;
    this._lpBound = true;
    var self = this, map = this.map, el = map.getContainer(), timer = null, start = null, firedAt = 0;
    function fire(ll) {
      if (!self._longPress || Date.now() - firedAt < 800) return;
      firedAt = Date.now();
      self._suppressClickUntil = firedAt + 600;
      self._longPress(ll);
    }
    map.on('contextmenu', function(e){
      if (e.originalEvent && e.originalEvent.preventDefault) e.originalEvent.preventDefault();
      fire(e.latlng);
    });
    function cancel(){ if (timer) { clearTimeout(timer); timer = null; } }
    el.addEventListener('touchstart', function(e){
      cancel();
      if (e.touches.length !== 1) return;
      var t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      timer = setTimeout(function(){
        timer = null;
        var r = el.getBoundingClientRect();
        fire(map.containerPointToLatLng(L.point(start.x - r.left, start.y - r.top)));
      }, 550);
    }, { passive: true });
    el.addEventListener('touchmove', function(e){
      if (!timer || !start) return;
      var t = e.touches[0];
      if (e.touches.length !== 1 || Math.abs(t.clientX - start.x) > 8 || Math.abs(t.clientY - start.y) > 8) cancel();
    }, { passive: true });
    el.addEventListener('touchend', cancel, { passive: true });
    el.addEventListener('touchcancel', cancel, { passive: true });
  },
  /** 脚下千年: the point being read and its 50 km event ring (WGS-84 in). */
  setHere: function(lat, lng, km) {
    this.hereLayer.clearLayers();
    var c = window.toMapCoord(lat, lng);
    L.circle(c, { radius: (km || 50) * 1000, color: '#D4B072', weight: 1, opacity: 0.6, dashArray: '4 6', fill: false, interactive: false }).addTo(this.hereLayer);
    L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="here-pin"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false, zIndexOffset: 950 }).addTo(this.hereLayer);
  },
  clearHere: function() { if (this.hereLayer) this.hereLayer.clearLayers(); },
  /** Fly to an event of the reading and open its popup if it is on the map. */
  focusPoint: function(lat, lng, zoom) {
    this.map.flyTo(window.toMapCoord(lat, lng), Math.max(this.map.getZoom(), zoom || 8), { duration: 0.6 });
  },
```

- [ ] **Step 3: Don't let the click after a long-press reach trip mode** — in `onMapClick`'s handler change the body to:

```js
      this.map.on('click', function(e){
        if (self._suppressClickUntil && Date.now() < self._suppressClickUntil) return;
        if (self._mapClick) self._mapClick(e.latlng);
      });
```

- [ ] **Step 4: CSS** — append to `src/ui/theme.ts` near `.event-marker`:

```css
#map { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
.here-pin { width: 14px; height: 14px; border-radius: 50%; background: var(--seal); box-shadow: 0 0 0 6px rgba(var(--seal-rgb), .25), 0 0 0 14px rgba(var(--seal-rgb), .1); }
```

- [ ] **Step 5: Typecheck + commit**

Run: `bun run typecheck` → clean.

```bash
git add src/ui/client/map.ts src/ui/theme.ts
git commit -m "feat(map): long-press / right-click hook and the 脚下千年 pin with its 50 km ring"
```

---

### Task 6: The panel — state, markup, sheet, route

**Files:**
- Create: `src/ui/components/here-panel.ts`
- Modify: `src/ui/client/app.ts`
- Modify: `src/ui/home.ts`
- Modify: `src/ui/theme.ts`

- [ ] **Step 1: Bootstrap + scripts** — in `src/ui/home.ts`:
  - `import { HERE_CORE_SCRIPT } from "./client/here-core"`, `import { HerePanel } from "./components/here-panel"`, and add `PLACE_NAMES_SRC` to the existing `~/routes/assets` import.
  - In the bootstrap object add `placeNamesUrl: PLACE_NAMES_SRC,`.
  - Add `<script>${HERE_CORE_SCRIPT}</script>` right after `<script>${TRIP_CORE_SCRIPT}</script>`.
  - Render `${HerePanel()}` right after `${ChatPanel()}`.

- [ ] **Step 2: Markup** — `src/ui/components/here-panel.ts`:

```ts
import { icon } from "../icons"

/** 脚下千年 — a point's land read down through the eras (newest on top). */
export function HerePanel(): string {
  return `<div class="here-panel" x-show="here.open" x-cloak :class="here.mini ? 'mini' : ''" role="dialog" aria-label="脚下千年">
  <button type="button" class="here-grabber" @click="sheetTap('here')" @touchstart.passive="hereDragStart($event)" @touchmove="hereDragMove($event)" @touchend="hereDragEnd()" @touchcancel="hereDragEnd()" :aria-label="here.mini ? '展开' : '收起'"></button>
  <header class="here-head" @touchstart.passive="hereDragStart($event)" @touchmove="hereDragMove($event)" @touchend="hereDragEnd()" @touchcancel="hereDragEnd()">
    <div class="here-id" @click="here.mini && !justDragged() && (here.mini = false)">
      <div class="here-kick" x-text="hereKicker()"></div>
      <div class="here-title" x-html="hereTitle()"></div>
      <div class="here-sub" x-text="hereSub()"></div>
    </div>
    <div class="here-tools">
      <button class="icon-btn" @click="shareHere()" title="分享这片土地">${icon("share", 17)}</button>
      <button class="icon-btn" @click="closeHere()" aria-label="关闭">${icon("close", 18)}</button>
    </div>
  </header>
  <div class="here-body">
    <template x-if="here.loading"><p class="here-empty">正在翻开这片土地…</p></template>
    <template x-if="!here.loading && here.result && !here.result.layers.length">
      <div class="here-empty">
        <p>这里的千年还没写进我们的地图。</p>
        <button class="chip" x-show="here.result.nearest" @click="hereGoNearest()" x-text="'最近的故事在 ' + Math.round((here.result.nearest||{}).km || 0) + ' km 外 →'"></button>
      </div>
    </template>
    <ol class="here-layers" x-show="!here.loading && here.result && here.result.layers.length">
      <template x-for="l in (here.result ? here.result.layers : [])" :key="l.dynastyId">
        <li class="here-layer" :class="(here.openEra === l.dynastyId ? 'open ' : '') + (l.events.length ? '' : 'dim')" :style="'--c:' + hereTint(l.dynastyId)">
          <button type="button" class="hl-head" @click="hereToggle(l.dynastyId)">
            <span class="hl-era" x-text="hereEraName(l.dynastyId)"></span>
            <span class="hl-name" x-show="l.name" x-text="l.name"></span>
            <span class="hl-years" x-text="hereEraYears(l.dynastyId)"></span>
          </button>
          <p class="hl-note" x-show="l.note && here.openEra === l.dynastyId" x-text="l.note"></p>
          <p class="hl-peek" x-show="here.openEra !== l.dynastyId && l.events.length" x-text="herePeek(l)"></p>
          <ol class="hl-events" x-show="here.openEra === l.dynastyId">
            <template x-for="e in l.events" :key="e.date + e.event">
              <li><button type="button" @click="hereFocusEvent(e)"><span class="hl-date" x-text="e.date"></span><span x-text="e.event"></span></button></li>
            </template>
          </ol>
          <div class="hl-museums" x-show="l.museums.length">
            <template x-for="m in l.museums" :key="m.id">
              <button type="button" class="chip" @click="openMuseum(m.id)"><span x-text="m.name"></span> <small x-text="Math.round(m.km) < 1 ? '就在此地' : Math.round(m.km) + ' km'"></small></button>
            </template>
          </div>
        </li>
      </template>
    </ol>
  </div>
</div>`
}
```

Icons `share`, `close`, `layers` exist in `src/ui/icons.ts`.

- [ ] **Step 3: State and methods** — in `src/ui/client/app.ts`, add to the data object next to `geo:`:

```js
    here: { open: false, mini: false, loading: false, point: null, result: null, openEra: null },
    _lineages: null,
```

and add these methods next to `locateMe()`:

```js
    // ─── 脚下千年 ───
    async loadLineages() {
      if (this._lineages) return this._lineages;
      try {
        var r = await fetch(this.placeNamesUrl || '/assets/place-names.json');
        this._lineages = r.ok ? await r.json() : [];
      } catch (_) { this._lineages = []; }
      return this._lineages;
    },
    /** Read the land at a WGS-84 point. opts.fromHash: don't touch the URL. */
    async openHere(lat, lng, opts) {
      opts = opts || {};
      if (!window.HereCore || lat == null || lng == null) return;
      if (this.chat && this.chat.open) this.chat.mini = true;
      if (this.drawer.open) this.closeDrawer();
      this.here.open = true; this.here.mini = false; this.here.loading = true;
      this.here.point = { lat: lat, lng: lng }; this.here.openEra = null;
      if (window.MuseumMap && window.MuseumMap.setHere) window.MuseumMap.setHere(lat, lng, window.HereCore.R_EVENT);
      var lineages = await this.loadLineages();
      this.here.result = window.HereCore.read({ lat: lat, lng: lng }, { dynasties: this.dynasties, museums: this.museums, lineages: lineages });
      this.here.loading = false;
      if (!opts.fromHash) this.setHereHash(lat, lng);
    },
    closeHere() {
      this.here.open = false; this.here.result = null; this.here.point = null;
      if (window.MuseumMap && window.MuseumMap.clearHere) window.MuseumMap.clearHere();
      if (/^#\\/h\\//.test(location.hash || '')) this.setHashRoute(null);
    },
    setHereHash(lat, lng) {
      var target = '#/h/' + lat.toFixed(4) + ',' + lng.toFixed(4);
      if (location.hash === target) return;
      this._suppressHashChange = true;
      try { history.replaceState({ kind: 'mm-route' }, '', target); } catch (_) {}
      var self = this; setTimeout(function(){ self._suppressHashChange = false; }, 0);
    },
    hereKicker() {
      var p = this.here.point; if (!p) return '脚下千年';
      return '脚下千年 · ' + Math.abs(p.lat).toFixed(2) + '°' + (p.lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(p.lng).toFixed(2) + '°' + (p.lng >= 0 ? 'E' : 'W');
    },
    hereTitle() {
      var r = this.here.result; if (!r) return '你脚下这片土地';
      var h = window.HereCore.headline(r);
      if (h) return '此地曾是 <span class="gilt">' + this.escapeAttr(h) + '</span>';
      if (r.city) return '此地 · <span class="gilt">' + this.escapeAttr(r.city.name) + '</span>';
      if (r.nearCity) return '此地 <small>距 ' + this.escapeAttr(r.nearCity.name) + ' ' + Math.round(r.nearCity.km) + ' km</small>';
      return '你脚下这片土地';
    },
    hereSub() {
      var r = this.here.result; if (!r || !r.layers.length) return '';
      return '从今天往下，' + r.layers.length + ' 个朝代在这里留下了痕迹';
    },
    hereEraName(id) {
      var d = this.dynastyById(id);
      return d ? this.dynastyShortName(d).replace(/[：:].*$/, '').replace(/（.*$/, '') : id;
    },
    hereEraYears(id) {
      var d = this.dynastyById(id);
      return d && d.period ? d.period.replace(/^约?公元/, '').replace(/年/g, '') : '';
    },
    hereTint(id) {
      var n = this.dynasties.length, i = this.layerNo(id);
      return 'rgba(var(--gilt-rgb),' + (0.35 + 0.65 * (i / Math.max(1, n))).toFixed(2) + ')';
    },
    herePeek(l) {
      return l.events.slice(0, 2).map(function(e){ return e.date.replace(/年$/, '') + ' ' + e.event; }).join(' · ') + (l.events.length > 2 ? ' …' : '');
    },
    hereToggle(id) {
      this.here.openEra = this.here.openEra === id ? null : id;
      if (this.here.openEra && window.EraSynth) window.EraSynth.note(id, 7);
    },
    hereFocusEvent(e) {
      if (window.MuseumMap && window.MuseumMap.focusPoint) window.MuseumMap.focusPoint(e.lat, e.lng, 9);
      if (window.innerWidth <= 920) this.here.mini = true;
    },
    hereGoNearest() {
      var n = this.here.result && this.here.result.nearest; if (!n) return;
      this.openHere(n.event.lat, n.event.lng);
      if (window.MuseumMap && window.MuseumMap.focusPoint) window.MuseumMap.focusPoint(n.event.lat, n.event.lng, 8);
    },
    async shareHere() {
      var p = this.here.point; if (!p) return;
      var url = location.origin + location.pathname + '#/h/' + p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
      var title = '脚下千年 · ' + (window.HereCore.headline(this.here.result) || (this.here.result && this.here.result.city && this.here.result.city.name) || '这片土地');
      try { if (navigator.share) { await navigator.share({ title: title, url: url }); return; } } catch (_) {}
      try { await navigator.clipboard.writeText(url); this.flashToast('已备好，寄给友人吧'); } catch (_) { prompt('复制下面的地址寄给友人：', url); }
    },
```

Bootstrap keys are copied onto the component explicitly, like `territoryUrl`: add `placeNamesUrl: '',` next to `territoryUrl: '',` (~line 136) and `this.placeNamesUrl = data.placeNamesUrl || '';` next to `this.territoryUrl = data.territoryUrl || '';` (~line 159).

- [ ] **Step 4: Sheet drag** — add next to `tripDrag*` (same shape as the trip sheet: open ↔ bar):

```js
    // ── 脚下千年's sheet on phones follows the finger by its handle / header: open ↔ bar.
    hereDragStart(e) {
      this._hg = null;
      if (!this.here.open || window.innerWidth > 920) return;
      var t = e.changedTouches && e.changedTouches[0], el = document.querySelector('.here-panel');
      if (!t || !el) return;
      var barOff = el.offsetHeight - 84 - (parseFloat(getComputedStyle(el).paddingBottom) || 0);
      this._hg = { id: t.identifier, el: el, y0: t.clientY, x0: t.clientX, lastY: t.clientY, lastT: Date.now(), v: 0, on: false,
        span: Math.max(1, barOff), base: this.here.mini ? Math.max(1, barOff) : 0, off: 0 };
    },
    hereDragMove(e) {
      var g = this._hg; if (!g) return;
      var t = this._ownTouch(e, g.id); if (!t) return;
      var dy = t.clientY - g.y0, dx = t.clientX - g.x0;
      if (!g.on) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) { this._hg = null; return; }
        if (Math.abs(dy) < 6) return;
        g.on = true; g.el.style.transition = 'none';
        if (this.here.mini) { this.here.mini = false; }
      }
      var now = Date.now(), step = t.clientY - g.lastY;
      if (now > g.lastT) g.v = 0.7 * (step / (now - g.lastT)) + 0.3 * g.v;
      g.lastY = t.clientY; g.lastT = now;
      g.off = Math.max(0, Math.min(g.span + 30, g.base + dy));
      g.el.style.transform = 'translateY(' + g.off + 'px)';
      if (e.cancelable) e.preventDefault();
    },
    hereDragEnd() {
      var g = this._hg; this._hg = null;
      if (!g || !g.on) return;
      this._swAt = Date.now();
      var el = g.el;
      var open = g.v > 0.45 ? false : g.v < -0.45 ? true : (g.off + g.v * 160) < g.span / 2;
      this.here.mini = !open;
      el.style.transition = '';
      this.$nextTick(function(){ el.style.transform = ''; });
    },
```

and extend `sheetTap` / `sheetStep`:

```js
      else if (kind === 'here') this.here.mini = !this.here.mini;   // in sheetTap
      else if (kind === 'here') this.here.mini = dir > 0;           // in sheetStep
```

Note on `fromBar` in `hereDragMove`: when the sheet is mini, the `.mini` class sets the panel's height to the bar; clearing `mini` on drag start lays out the full panel, and `g.base` (= `span`) keeps it at the bar position so nothing jumps — same as the trip sheet.

- [ ] **Step 5: Hash route** — in `applyHashRoute()`, before the existing `var m = h.match(...)`:

```js
      var hm = h.match(/^#\\/h\\/(-?[\\d.]+),(-?[\\d.]+)$/);
      if (hm) { this.openHere(Number(hm[1]), Number(hm[2]), { fromHash: true }); return; }
      if (this.here.open && !/^#\\/h\\//.test(h)) { this.here.open = false; if (window.MuseumMap && window.MuseumMap.clearHere) window.MuseumMap.clearHere(); }
```

- [ ] **Step 6: CSS** — append to `src/ui/theme.ts` (reuse chat panel variables; check `.chat-panel` rules at ~line 1136 and the `@media (max-width: 920px)` block for the mobile pattern):

```css
.here-panel { position: fixed; z-index: 1150; right: 16px; top: 76px; bottom: 16px; width: min(380px, calc(100vw - 32px)); display: flex; flex-direction: column; background: var(--bg-2); border: 1px solid rgba(var(--gilt-rgb), .25); border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.45); overflow: hidden; }
.here-grabber { display: none; }
.here-head { display: flex; gap: 10px; align-items: flex-start; padding: 14px 14px 10px 18px; border-bottom: 1px solid rgba(var(--fg-rgb), .08); }
.here-id { flex: 1; min-width: 0; }
.here-kick { font-family: var(--mono); font-size: 10px; letter-spacing: .16em; color: var(--gilt); }
.here-title { font-size: 20px; margin-top: 4px; overflow-wrap: anywhere; }
.here-title .gilt { color: var(--gilt); }
.here-title small { font-size: 12px; color: var(--text-3); }
.here-sub { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.here-tools { display: flex; gap: 4px; }
.here-body { flex: 1; overflow-y: auto; padding: 6px 16px 18px; overscroll-behavior: contain; }
.here-empty { color: var(--text-3); font-size: 13px; padding: 18px 2px; }
.here-layers { list-style: none; margin: 0; padding: 0; }
.here-layer { position: relative; border-top: 1px solid rgba(var(--fg-rgb), .1); padding: 10px 0 10px 12px; min-width: 0; overflow-wrap: anywhere; }
.here-layer::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 2px; background: var(--c); }
.here-layer.dim { opacity: .55; }
.hl-head { all: unset; cursor: pointer; display: flex; align-items: baseline; gap: 8px; width: 100%; }
.hl-era { font-size: 14px; }
.hl-name { color: var(--gilt); font-size: 14px; }
.hl-years { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--text-3); }
.hl-note, .hl-peek { font-size: 12px; color: var(--text-2); margin: 4px 0 0; line-height: 1.5; }
.hl-events { list-style: none; margin: 6px 0 0; padding: 0; }
.hl-events button { all: unset; cursor: pointer; display: flex; gap: 8px; font-size: 12.5px; line-height: 1.5; padding: 3px 0; color: var(--text-1, inherit); }
.hl-events button:hover { color: var(--gilt-hi); }
.hl-date { flex: 0 0 auto; font-family: var(--mono); font-size: 10.5px; color: var(--gilt); padding-top: 2px; }
.hl-museums { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
.hl-museums small { color: var(--text-3); font-family: var(--mono); font-size: 10px; }
@media (max-width: 920px) {
  .here-panel { left: 0; right: 0; bottom: 0; top: auto; width: auto; height: min(72dvh, 620px); border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom); transition: transform .3s var(--ease), height .3s var(--ease); }
  .here-panel.mini { height: calc(84px + env(safe-area-inset-bottom)); }
  .here-panel.mini .here-body, .here-panel.mini .here-sub, .here-panel.mini .here-tools > .icon-btn:not(:last-child) { display: none; }
  .here-grabber { display: block; touch-action: none; width: 100%; height: 18px; background: none; border: 0; position: relative; }
  .here-grabber::after { content: ""; position: absolute; left: 50%; top: 7px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: rgba(var(--fg-rgb), .3); }
  .here-head { touch-action: none; padding-top: 2px; }
}
```

Verify variable names used here exist (`grep -n "\-\-text-2\|\-\-text-3\|\-\-ease\|\-\-gilt-hi" src/ui/theme.ts | head`); substitute the nearest existing ones if not. Check the chat panel's z-index and use the same.

- [ ] **Step 7: Typecheck, test, manual**

Run: `bun run typecheck && bun test tests/here-core.test.ts tests/assets-place-names.test.ts`
Expected: clean / PASS.

Manual (after `bun run restore -- --target=local --confirm && bun run dev`): open `http://localhost:8787/#/h/34.26,108.94` → panel shows 此地曾是 长安, layers newest-first, pin + dashed ring at Xi'an; tap 唐 → expands, one note sounds; tap an event → map flies; tap a museum chip → museum drawer opens and the panel closes.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/here-panel.ts src/ui/client/app.ts src/ui/home.ts src/ui/theme.ts
git commit -m "feat(here): 脚下千年 panel — the land at a point, era by era, newest on top; phone sheet follows the finger; #/h/lat,lng"
```

---

### Task 7: The three entry points

**Files:**
- Modify: `src/ui/client/app.ts`
- Modify: `src/ui/home.ts`
- Modify: `src/ui/theme.ts`

- [ ] **Step 1: Long-press / right-click** — where the map is initialised in `app.ts` (`window.MuseumMap.init(35.0, 105.0);` ~line 205), right after the following `var self = this;`:

```js
        if (window.MuseumMap.onLongPress) window.MuseumMap.onLongPress(function(ll){
          if (self.tripMode) return;
          var w = window.fromMapCoord(ll.lat, ll.lng);
          self.openHere(w[0], w[1]);
        });
```


- [ ] **Step 2: 「脚下千年」 button by locate** — in `src/ui/home.ts`, right after the `locate-btn` button:

```html
      <button class="locate-btn here-btn" x-show="view === 'map'" x-cloak @click="hereAtMe()" :disabled="geo.locating" title="看看你脚下这片土地的千年">
        ${icon("layers", 16)}<span>脚下千年</span>
      </button>
```

and in `app.ts` next to `openHere`:

```js
    hereAtMe() {
      var self = this;
      if (this.geo.lat != null) { this.openHere(this.geo.lat, this.geo.lng); return; }
      if (!navigator.geolocation) { this.flashToast('当前浏览器不支持定位，可以在地图上长按任意一点'); return; }
      this.geo.locating = true;
      navigator.geolocation.getCurrentPosition(function(pos){
        self.geo.lat = pos.coords.latitude; self.geo.lng = pos.coords.longitude; self.geo.locating = false;
        if (window.MuseumMap && window.MuseumMap.setUser) window.MuseumMap.setUser(self.geo.lat, self.geo.lng);
        self.openHere(self.geo.lat, self.geo.lng);
      }, function(){
        self.geo.locating = false;
        self.flashToast('没能获取位置，可以在地图上长按任意一点');
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
    },
```

CSS: position `.here-btn` next to `.locate-btn` — read the `.locate-btn` rule (`grep -n "\.locate-btn" src/ui/theme.ts`) and offset `.here-btn` so the two sit side by side (same `top`, `left`/`right` shifted by the first button's width + 8px), on both desktop and the mobile media query.

- [ ] **Step 3: Museum drawer line** — in the museum drawer builder, at the end of the `// ── 此地即彼时 ──` block (after the `if (cross.length) { … }`), add a standalone section so it shows even with no crossings:

```js
      if (m.lat != null && m.lng != null) {
        sections.push({ key: 'here', title: '', cls: 'sec-here', html: '<button class="here-link" data-here-lat="' + m.lat + '" data-here-lng="' + m.lng + '">此馆所在 · 脚下千年 →</button>' });
      }
```

and in `onDrawerClick`, before `var el = e.target.closest('.dynasty-rec');`:

```js
      var hereBtn = e.target.closest('[data-here-lat]');
      if (hereBtn) { this.openHere(Number(hereBtn.getAttribute('data-here-lat')), Number(hereBtn.getAttribute('data-here-lng'))); return; }
```

CSS:

```css
.here-link { all: unset; cursor: pointer; display: inline-block; font-size: 13px; color: var(--gilt); border-bottom: 1px solid rgba(var(--gilt-rgb), .35); padding-bottom: 1px; }
.here-link:hover { color: var(--gilt-hi); }
```

- [ ] **Step 4: Opening a museum from the panel closes the panel** — at the top of `openMuseum(id)` add:

```js
      if (this.here && this.here.open) { this.here.open = false; if (window.MuseumMap && window.MuseumMap.clearHere) window.MuseumMap.clearHere(); }
```

- [ ] **Step 5: Typecheck + manual**

Run: `bun run typecheck` → clean.

Manual on desktop: right-click near 洛阳 → panel opens; trip mode on → right-click does nothing, single-click still adds a city. Museum drawer for 陕西历史博物馆 → "此馆所在 · 脚下千年 →" opens the panel at the museum. 脚下千年 button → asks for location, opens at you.

Manual on a phone (local network `bun run dev -- --ip 0.0.0.0` or after deploy): long-press ~0.5 s opens the panel; panning/pinching never opens it; no iOS text-selection callout; sheet drags between open and bar; sound follows the silent switch.

- [ ] **Step 6: Commit**

```bash
git add src/ui/client/app.ts src/ui/home.ts src/ui/theme.ts
git commit -m "feat(here): three ways in — long-press / right-click the map, 脚下千年 by locate, and from a museum"
```

---

### Task 8: Full verification and deploy

- [ ] **Step 1: Full suite** — `bun run typecheck && bun test 2>&1 | tail -4`
Expected: typecheck clean; failures = the 10 pre-existing ones only (`bun test 2>&1 | grep "(fail)"` lists no new names).

- [ ] **Step 2: Restore local** — `bun run restore -- --target=local --confirm`.

- [ ] **Step 3: Served-script sanity** — the template literal must not have eaten backslashes:

```bash
bun run dev &   # wait until ready
curl -s http://localhost:8787/ | grep -c 'HereCore'                 # ≥ 1
curl -s http://localhost:8787/ | grep -o 'match(/(前)?(\\d+)/)'      # prints the regex with \d intact
curl -s "http://localhost:8787$(curl -s http://localhost:8787/ | grep -o '/assets/place-names.json?v=[0-9a-z]*' | head -1)" | head -c 120
```

- [ ] **Step 4: Ask the user before deploying.** On approval: `git push origin main`, then on the VM (see memory `vm-copy-songlines`): back up `deploy/vm/state`, `git pull --ff-only`, `docker compose -f deploy/vm/docker-compose.yml up -d --build`. No database changes in this feature. Verify with `curl --resolve museum.xianliao.de5.net:443:20.193.231.97 https://museum.xianliao.de5.net/ | grep -c HereCore`.
