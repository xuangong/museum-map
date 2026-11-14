# 行程 · 沿途找馆 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn 行程 from "a list of museums I picked" into "tell me where I'm going (a drive route or an ordered list of cities) → show the museums worth seeing along the way, with reasons; pick some; split into days". No navigation hand-off.

**Spec:** `docs/superpowers/specs/行程-沿途找馆.md` (phases 1 and 2).

**Architecture:**
- Server: two keyless upstreams behind our Worker with KV caching — Nominatim (city search / reverse) and OSRM (driving route), falling back to straight lines. New `src/routes/trip.ts` exposes `/api/geocode`, `/api/geocode/reverse`, `/api/route`.
- Client: pure, testable logic in a new script module `src/ui/client/trip-core.ts` (string injected into the page like `coords.ts`; tests evaluate the same string). `app.ts` holds trip state (v2) and Alpine methods; `map.ts` draws the route, corridor, city stops and a click-to-add-city popup; `sidebar.ts` gets a new 行程 panel.
- Coordinates: everything stored and routed in WGS-84 (like museums); converted to GCJ-02 only for drawing (`toMapCoord`); map clicks converted back with a new `fromMapCoord`.

**Tech Stack:** Bun + Elysia on Cloudflare Workers, KV (`env.RATE`, prefixed keys), Alpine.js, Leaflet, bun:test + miniflare.

**Conventions to follow:**
- Route handlers cast context: `const c = ctx as unknown as Ctx` (see `src/routes/plaza.ts`).
- Client code is plain ES5-ish JS inside template strings; `${` must not appear in those strings except for intended interpolation.
- Inputs use `font-size: 16px` (iOS zoom). Long text containers carry `overflow-wrap: anywhere`.
- `bun test` reseeds local D1 to 64 legacy museums; afterwards run `bun run restore -- --target=local --confirm` before browser checks. Known pre-existing failures: 2 in `image-enricher`.
- Commit locally on `worktree-redesign`; never push.

---

## File map

| File | Responsibility |
|---|---|
| Create `src/services/geocode.ts` | Nominatim search + reverse, normalized `Place`, KV cache |
| Create `src/services/route.ts` | OSRM route through points, thinning, straight-line fallback, KV cache, `kmBetween` |
| Create `src/routes/trip.ts` | HTTP endpoints for the two services |
| Modify `src/index.ts` | register `tripRoute` |
| Create `src/ui/client/trip-core.ts` | `TRIP_CORE_SCRIPT`: geometry along a line, near-city grouping, scoring, day split, transit hint, migration, history-run |
| Modify `src/ui/client/coords.ts` | add `fromMapCoord` (GCJ → WGS, iterative) |
| Modify `src/ui/home.ts` | inject `TRIP_CORE_SCRIPT`; stage class for trip; legend; top-bar count |
| Modify `src/ui/client/app.ts` | trip v2 state, migration on load, trip methods, refreshMarkers trip branch, ledger anchor, AI prompt, drawer button |
| Modify `src/ui/client/map.ts` | `setTripLine`, `askCity`, `onMapClick` |
| Modify `src/ui/components/sidebar.ts` | new 行程 panel; ledger "加入行程" button uses picks |
| Modify `src/ui/theme.ts` | panel + map styles; mobile bottom sheet in trip mode |
| Create `tests/trip-services.test.ts` | geocode + route services with stubbed fetch |
| Create `tests/trip-routes.test.ts` | endpoints via `createApp` |
| Create `tests/trip-core.test.ts` | pure client logic |
| Modify `tests/coords.test.ts` | `fromMapCoord` round-trip |

---

### Task 1: Geocode service

**Files:**
- Create: `src/services/geocode.ts`
- Test: `tests/trip-services.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/trip-services.test.ts
import { describe, it, expect } from "bun:test"
import { searchCity, reverseCity } from "~/services/geocode"

function memKV() {
  const m = new Map<string, string>()
  return {
    async get(k: string, type?: string) { const v = m.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v },
    async put(k: string, v: string) { m.set(k, v) },
    _m: m,
  } as any
}
const env = () => ({ RATE: memKV() }) as any
const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

describe("geocode", () => {
  it("searchCity normalizes Nominatim rows and caches them", async () => {
    let calls = 0
    const f = (async (url: string) => {
      calls++
      expect(url).toContain("nominatim.openstreetmap.org/search")
      expect(url).toContain("countrycodes=cn")
      return jsonRes([
        { name: "石家庄市", lat: "38.0429742", lon: "114.5088385", addresstype: "city", address: { state: "河北省" } },
        { name: "某某路", lat: "38", lon: "114", addresstype: "road", address: {} },
      ])
    }) as any
    const e = env()
    const a = await searchCity(e, "石家庄", f)
    expect(a).toEqual([{ name: "石家庄市", lat: 38.0429742, lng: 114.5088385, province: "河北省" }])
    const b = await searchCity(e, "石家庄", f)
    expect(b).toEqual(a)
    expect(calls).toBe(1)
  })

  it("reverseCity picks the city-level name", async () => {
    const f = (async (url: string) => {
      expect(url).toContain("/reverse")
      return jsonRes({ name: "长安区", lat: "38.04", lon: "114.51", address: { city: "石家庄市", state: "河北省" } })
    }) as any
    const p = await reverseCity(env(), 38.041, 114.512, f)
    expect(p).toEqual({ name: "石家庄市", lat: 38.04, lng: 114.51, province: "河北省" })
  })

  it("searchCity throws on upstream error (caller maps to 502)", async () => {
    const f = (async () => jsonRes({}, 503)) as any
    await expect(searchCity(env(), "西安", f)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/trip-services.test.ts`
Expected: FAIL — `Cannot find module '~/services/geocode'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/services/geocode.ts
// City search and reverse lookup for 行程, via OpenStreetMap Nominatim (no key). Results are
// cached in KV for 30 days; Nominatim asks for low volume and a descriptive User-Agent.
import type { Env } from "~/index"

export interface Place { name: string; lat: number; lng: number; province?: string }

const UA = "museum-map/1.0 (personal trip planner; https://museum.xianliao.de5.net)"
const TTL = 30 * 86400
const KINDS = new Set(["city", "town", "county", "municipality", "district", "state", "province", "village", "suburb"])
type Fetch = (input: string, init?: RequestInit) => Promise<Response>

function province(addr: any): string | undefined {
  return (addr && (addr.state || addr.province)) || undefined
}

export async function searchCity(env: Env, q: string, f: Fetch = fetch): Promise<Place[]> {
  const query = q.trim().slice(0, 40)
  if (!query) return []
  const key = "geo:q:" + query
  const hit = (await env.RATE.get(key, "json")) as Place[] | null
  if (hit) return hit
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
    q: query, countrycodes: "cn", format: "jsonv2", limit: "6", "accept-language": "zh-CN", addressdetails: "1",
  })
  const res = await f(url, { headers: { "user-agent": UA } })
  if (!res.ok) throw new Error("geocode upstream " + res.status)
  const rows = (await res.json()) as any[]
  const out: Place[] = rows
    .filter((r) => KINDS.has(r.addresstype))
    .map((r) => ({ name: String(r.name), lat: Number(r.lat), lng: Number(r.lon), province: province(r.address) }))
  await env.RATE.put(key, JSON.stringify(out), { expirationTtl: TTL })
  return out
}

export async function reverseCity(env: Env, lat: number, lng: number, f: Fetch = fetch): Promise<Place | null> {
  const key = "geo:r:" + lat.toFixed(2) + "," + lng.toFixed(2)
  const hit = (await env.RATE.get(key, "json")) as Place | null
  if (hit) return hit
  const url = "https://nominatim.openstreetmap.org/reverse?" + new URLSearchParams({
    lat: String(lat), lon: String(lng), zoom: "10", format: "jsonv2", "accept-language": "zh-CN", addressdetails: "1",
  })
  const res = await f(url, { headers: { "user-agent": UA } })
  if (!res.ok) throw new Error("reverse upstream " + res.status)
  const r = (await res.json()) as any
  if (!r || r.error) return null
  const a = r.address || {}
  const name = a.city || a.county || a.town || a.municipality || r.name
  if (!name) return null
  const out: Place = { name: String(name), lat: Number(r.lat), lng: Number(r.lon), province: province(a) }
  await env.RATE.put(key, JSON.stringify(out), { expirationTtl: TTL })
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/trip-services.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/geocode.ts tests/trip-services.test.ts
git commit -m "feat(trip): city search and reverse lookup via Nominatim, KV-cached"
```

---

### Task 2: Route service

**Files:**
- Create: `src/services/route.ts`
- Test: `tests/trip-services.test.ts` (append)

- [ ] **Step 1: Write the failing test** — append to `tests/trip-services.test.ts`:

```ts
import { routeThrough, kmBetween, thin } from "~/services/route"

describe("route", () => {
  const BJ = { lat: 39.909, lng: 116.397 }, LY = { lat: 34.619, lng: 112.454 }, XA = { lat: 34.341, lng: 108.94 }

  it("kmBetween is haversine km", () => {
    expect(Math.round(kmBetween(BJ, XA))).toBe(911)
  })

  it("thin keeps first and last and caps length", () => {
    const pts = Array.from({ length: 1001 }, (_, i) => [i, i] as [number, number])
    const t = thin(pts, 100)
    expect(t.length).toBeLessThanOrEqual(101)
    expect(t[0]).toEqual([0, 0])
    expect(t[t.length - 1]).toEqual([1000, 1000])
  })

  it("uses OSRM when available (lng,lat order in, lat,lng out) and caches", async () => {
    let calls = 0
    const f = (async (url: string) => {
      calls++
      expect(url).toContain("router.project-osrm.org/route/v1/driving/116.397,39.909;112.454,34.619;108.94,34.341")
      return jsonRes({
        code: "Ok",
        routes: [{
          distance: 1174000, duration: 47880,
          geometry: { coordinates: [[116.397, 39.909], [112.454, 34.619], [108.94, 34.341]] },
          legs: [{ distance: 800000, duration: 32000 }, { distance: 374000, duration: 15880 }],
        }],
      })
    }) as any
    const e = env()
    const r = await routeThrough(e, [BJ, LY, XA], f)
    expect(r.provider).toBe("osrm")
    expect(r.km).toBe(1174)
    expect(r.h).toBe(13.3)
    expect(r.legs).toEqual([{ km: 800, h: 8.9 }, { km: 374, h: 4.4 }])
    expect(r.line[0]).toEqual([39.909, 116.397])
    await routeThrough(e, [BJ, LY, XA], f)
    expect(calls).toBe(1)
  })

  it("falls back to straight lines when OSRM fails", async () => {
    const f = (async () => { throw new Error("down") }) as any
    const r = await routeThrough(env(), [BJ, XA], f)
    expect(r.provider).toBe("line")
    expect(r.h).toBeNull()
    expect(r.km).toBe(911)
    expect(r.line).toEqual([[39.909, 116.397], [34.341, 108.94]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/trip-services.test.ts`
Expected: FAIL — `Cannot find module '~/services/route'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/services/route.ts
// A driving route through points (WGS-84) for 行程: OSRM's public server (OpenStreetMap, no key),
// thinned to keep the payload small, cached in KV; straight lines if OSRM is unavailable.
import type { Env } from "~/index"

export interface LatLng { lat: number; lng: number }
export interface Route {
  provider: "osrm" | "line"
  km: number
  h: number | null
  legs: { km: number; h: number | null }[]
  line: [number, number][] // [lat, lng], WGS-84
}
type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export function kmBetween(a: LatLng, b: LatLng): number {
  const R = 6371, r = Math.PI / 180
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Every k-th point so at most ~max remain, always keeping the last. */
export function thin<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts
  const k = Math.ceil(pts.length / max)
  const out = pts.filter((_, i) => i % k === 0)
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1])
  return out
}

const round1 = (x: number) => Math.round(x * 10) / 10

function straight(pts: LatLng[]): Route {
  const legs = pts.slice(1).map((p, i) => ({ km: Math.round(kmBetween(pts[i], p)), h: null }))
  return { provider: "line", km: legs.reduce((s, l) => s + l.km, 0), h: null, legs, line: pts.map((p) => [p.lat, p.lng]) }
}

export async function routeThrough(env: Env, pts: LatLng[], f: Fetch = fetch): Promise<Route> {
  if (pts.length < 2) throw new Error("need at least two points")
  const key = "route:v1:" + pts.map((p) => p.lat.toFixed(3) + "," + p.lng.toFixed(3)).join(";")
  const hit = (await env.RATE.get(key, "json")) as Route | null
  if (hit) return hit
  try {
    const coords = pts.map((p) => p.lng + "," + p.lat).join(";")
    const res = await f(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
      headers: { "user-agent": "museum-map/1.0 (personal trip planner)" },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) throw new Error("osrm " + res.status)
    const d = (await res.json()) as any
    if (d.code !== "Ok" || !d.routes?.length) throw new Error("osrm " + d.code)
    const r = d.routes[0]
    const out: Route = {
      provider: "osrm",
      km: Math.round(r.distance / 1000),
      h: round1(r.duration / 3600),
      legs: r.legs.map((l: any) => ({ km: Math.round(l.distance / 1000), h: round1(l.duration / 3600) })),
      line: thin(r.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]), 500),
    }
    await env.RATE.put(key, JSON.stringify(out), { expirationTtl: 30 * 86400 })
    return out
  } catch {
    return straight(pts)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/trip-services.test.ts`
Expected: 7 pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/route.ts tests/trip-services.test.ts
git commit -m "feat(trip): driving route via OSRM with straight-line fallback, KV-cached"
```

---

### Task 3: HTTP endpoints

**Files:**
- Create: `src/routes/trip.ts`
- Modify: `src/index.ts` (import + `.use(tripRoute)` after `.use(plazaRoute)`)
- Test: `tests/trip-routes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/trip-routes.test.ts
import { describe, it, expect, afterEach } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"],
    r2Buckets: ["IMAGES"],
  })
  return { DB: await mf.getD1Database("DB"), RATE: await mf.getKVNamespace("RATE"), IMAGES: await mf.getR2Bucket("IMAGES") } as any
}
const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })
const json = (b: unknown) => new Response(JSON.stringify(b), { headers: { "content-type": "application/json" } })

describe("trip endpoints", () => {
  it("GET /api/geocode returns places", async () => {
    globalThis.fetch = (async () => json([{ name: "洛阳市", lat: "34.62", lon: "112.45", addresstype: "city", address: { state: "河南省" } }])) as any
    const app = createApp(await makeEnv())
    const res = await app.handle(new Request("http://localhost/api/geocode?q=" + encodeURIComponent("洛阳-test-" + Date.now())))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ name: "洛阳市", lat: 34.62, lng: 112.45, province: "河南省" }])
  })

  it("GET /api/route validates points", async () => {
    const app = createApp(await makeEnv())
    const res = await app.handle(new Request("http://localhost/api/route?pts=abc"))
    expect(res.status).toBe(400)
  })

  it("GET /api/route falls back to a straight line", async () => {
    globalThis.fetch = (async () => { throw new Error("offline") }) as any
    const app = createApp(await makeEnv())
    const res = await app.handle(new Request("http://localhost/api/route?pts=39.909,116.397;34.341,108.94"))
    expect(res.status).toBe(200)
    const r = (await res.json()) as any
    expect(r.provider).toBe("line")
    expect(r.line.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/trip-routes.test.ts`
Expected: FAIL — 404s (routes not registered).

- [ ] **Step 3: Write the implementation**

```ts
// src/routes/trip.ts
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { searchCity, reverseCity } from "~/services/geocode"
import { routeThrough, type LatLng } from "~/services/route"

interface Ctx { env: Env; query: any; set: any }

const inChina = (p: LatLng) => p.lat > 3 && p.lat < 54 && p.lng > 73 && p.lng < 136
const bad = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "content-type": "application/json" } })

export const tripRoute = new Elysia()
  .get("/api/geocode", async (ctx) => {
    const c = ctx as unknown as Ctx
    const q = String(c.query?.q || "").trim()
    if (!q) return Response.json([])
    try { return Response.json(await searchCity(c.env, q)) }
    catch { return new Response(JSON.stringify({ error: "geocode unavailable" }), { status: 502, headers: { "content-type": "application/json" } }) }
  })
  .get("/api/geocode/reverse", async (ctx) => {
    const c = ctx as unknown as Ctx
    const p = { lat: Number(c.query?.lat), lng: Number(c.query?.lng) }
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inChina(p)) return bad("lat/lng required")
    try { return Response.json(await reverseCity(c.env, p.lat, p.lng)) }
    catch { return new Response(JSON.stringify({ error: "geocode unavailable" }), { status: 502, headers: { "content-type": "application/json" } }) }
  })
  .get("/api/route", async (ctx) => {
    const c = ctx as unknown as Ctx
    const pts = String(c.query?.pts || "").split(";").filter(Boolean).map((s) => {
      const [lat, lng] = s.split(",").map(Number)
      return { lat, lng }
    })
    if (pts.length < 2 || pts.length > 12 || pts.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inChina(p))) {
      return bad("pts=lat,lng;lat,lng (2–12 points in China)")
    }
    return Response.json(await routeThrough(c.env, pts))
  })
```

In `src/index.ts` add `import { tripRoute } from "~/routes/trip"` with the other route imports, and `.use(tripRoute)` right after `.use(plazaRoute)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/trip-routes.test.ts && bun run typecheck`
Expected: 3 pass; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/routes/trip.ts src/index.ts tests/trip-routes.test.ts
git commit -m "feat(trip): /api/geocode, /api/geocode/reverse, /api/route"
```

---

### Task 4: GCJ → WGS for map clicks

**Files:**
- Modify: `src/ui/client/coords.ts`
- Test: `tests/coords.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/coords.test.ts`:

```ts
import { fromMapCoord } from "~/ui/client/coords"

describe("GCJ-02 → WGS-84", () => {
  it("round-trips within 1e-6 degrees", () => {
    for (const [lat, lng] of [[39.9042, 116.4074], [34.3416, 108.9398], [30.2741, 120.1551]]) {
      const [gLat, gLng] = toMapCoord(lat, lng)
      const [wLat, wLng] = fromMapCoord(gLat, gLng)
      expect(wLat).toBeCloseTo(lat, 6)
      expect(wLng).toBeCloseTo(lng, 6)
    }
  })
})
```

- [ ] **Step 2: Run** `bun test tests/coords.test.ts` — Expected: FAIL (`fromMapCoord` not exported).

- [ ] **Step 3: Implement.** In `COORDS_SCRIPT`, before `global.outOfChina = outOfChina;` add:

```js
  // Inverse by fixed-point iteration: find w with wgs84ToGcj02(w) = g.
  function gcj02ToWgs84(gLat, gLng) {
    if (outOfChina(gLat, gLng)) return [gLat, gLng];
    var w = [gLat, gLng];
    for (var i = 0; i < 6; i++) {
      var g = wgs84ToGcj02(w[0], w[1]);
      w = [w[0] + (gLat - g[0]), w[1] + (gLng - g[1])];
    }
    return w;
  }
  global.fromMapCoord = gcj02ToWgs84;
```

And after the exported `toMapCoord` function add the TS mirror:

```ts
/** Server-side mirror of the client's gcj02ToWgs84 (tests). */
export function fromMapCoord(gLat: number, gLng: number): [number, number] {
  if (gLng < 72.004 || gLng > 137.8347 || gLat < 0.8293 || gLat > 55.8271) return [gLat, gLng]
  let w: [number, number] = [gLat, gLng]
  for (let i = 0; i < 6; i++) {
    const g = toMapCoord(w[0], w[1])
    w = [w[0] + (gLat - g[0]), w[1] + (gLng - g[1])]
  }
  return w
}
```

- [ ] **Step 4: Run** `bun test tests/coords.test.ts` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/client/coords.ts tests/coords.test.ts
git commit -m "feat(coords): fromMapCoord (GCJ-02 → WGS-84) for map clicks"
```

---

### Task 5: Pure trip logic (`TripCore`)

**Files:**
- Create: `src/ui/client/trip-core.ts`
- Test: `tests/trip-core.test.ts`

All functions take/return WGS-84 `{lat,lng}` and km. They are shipped as a script string; tests evaluate that exact string.

- [ ] **Step 1: Write the failing test**

```ts
// tests/trip-core.test.ts
import { describe, it, expect } from "bun:test"
import { TRIP_CORE_SCRIPT } from "~/ui/client/trip-core"

const w: any = {}
new Function("window", TRIP_CORE_SCRIPT)(w)
const T = w.TripCore

const BJ = { lat: 39.909, lng: 116.397 }, LY = { lat: 34.619, lng: 112.454 }, XA = { lat: 34.341, lng: 108.94 }

describe("TripCore geometry", () => {
  it("along(): distance to a line and position along it", () => {
    const line = [[BJ.lat, BJ.lng], [LY.lat, LY.lng], [XA.lat, XA.lng]]
    const zz = { lat: 34.75, lng: 113.62 } // 郑州, a little off the 北京→洛阳 straight line
    const r = T.along(zz, line)
    expect(r.km).toBeLessThan(120)
    expect(r.at).toBeGreaterThan(500)
    expect(r.at).toBeLessThan(T.lineKm(line))
    expect(T.along(BJ, line).at).toBeCloseTo(0, 5)
  })

  it("stopsAlong(): museums within radius, ordered by position", () => {
    const line = [[BJ.lat, BJ.lng], [XA.lat, XA.lng]]
    const ms = [
      { id: "far", lat: 30, lng: 100 },
      { id: "xa", lat: 34.34, lng: 108.95 },
      { id: "bj", lat: 39.91, lng: 116.39 },
    ]
    const s = T.stopsAlong(ms, line, 30)
    expect(s.map((x: any) => x.m.id)).toEqual(["bj", "xa"])
  })

  it("stopsNearCities(): each museum goes to its nearest city in range", () => {
    const cities = [{ name: "北京", ...BJ }, { name: "西安", ...XA }]
    const ms = [{ id: "a", lat: 39.92, lng: 116.4 }, { id: "b", lat: 34.3, lng: 108.9 }, { id: "c", lat: 30, lng: 100 }]
    const s = T.stopsNearCities(ms, cities, 30)
    expect(s.map((x: any) => [x.m.id, x.city])).toEqual([["a", 0], ["b", 1]])
  })
})

describe("TripCore planning", () => {
  it("transitHint() by distance", () => {
    expect(T.transitHint(100).mode).toBe("高铁或大巴")
    expect(T.transitHint(700)).toEqual({ mode: "高铁", h: 3.8 })
    expect(T.transitHint(2000).mode).toBe("飞机")
  })

  it("splitDays(): per-city days, at most perDay each, overflow flagged", () => {
    const groups = [{ days: 1, stops: ["a", "b", "c", "d"] }, { days: 2, stops: ["e"] }]
    const plan = T.splitDays(groups, 3)
    expect(plan).toEqual([
      { day: 1, group: 0, stops: ["a", "b", "c", "d"], over: true },
      { day: 2, group: 1, stops: ["e"], over: false },
      { day: 3, group: 1, stops: [], over: false },
    ])
  })

  it("splitDays(): groups without days chunk by perDay (drive)", () => {
    const plan = T.splitDays([{ stops: ["a", "b", "c", "d"] }], 3)
    expect(plan.map((d: any) => d.stops)).toEqual([["a", "b", "c"], ["d"]])
  })

  it("longestRun(): the longest run of consecutive eras that includes one of `must`", () => {
    expect(T.longestRun([3, 4, 5, 7, 8], [4])).toEqual([3, 5])
    expect(T.longestRun([3, 4, 5, 7, 8], [8])).toEqual([7, 8])
    expect(T.longestRun([1, 9], [5])).toBeNull()
  })

  it("score(): must-see, fills, connects, on-site, near", () => {
    expect(T.score({ must: true, fills: 0, connects: false, onSite: false, km: 0 })).toBeCloseTo(3, 5)
    expect(T.score({ must: false, fills: 2, connects: true, onSite: true, km: 50 })).toBeCloseTo(2 * 2 + 2 + 1 - 0.5, 5)
  })

  it("migrate(): old {ids} becomes v2 transit with cities from museums", () => {
    const byId: any = {
      gugong: { id: "gugong", city: "北京", lat: 39.916, lng: 116.397 },
      guobo: { id: "guobo", city: "北京", lat: 39.905, lng: 116.401 },
      shaanxi: { id: "shaanxi", city: "西安", lat: 34.22, lng: 108.95 },
    }
    const t = T.migrate({ ids: ["gugong", "guobo", "shaanxi", "gone"], order: "route" }, byId)
    expect(t.v).toBe(2)
    expect(t.mode).toBe("transit")
    expect(t.picks).toEqual(["gugong", "guobo", "shaanxi"])
    expect(t.cities.map((c: any) => c.name)).toEqual(["北京", "西安"])
    expect(t.cities[0].lat).toBeCloseTo(39.9105, 3)
    expect(t.radius).toBe(30)
  })

  it("migrate(): keeps a valid v2 trip and drops unknown picks", () => {
    const t = T.migrate({ v: 2, mode: "drive", cities: [{ name: "北京", lat: 1, lng: 2, days: 1 }], radius: 80, picks: ["x"] }, {})
    expect(t).toEqual({ v: 2, mode: "drive", cities: [{ name: "北京", lat: 1, lng: 2, days: 1 }], radius: 80, picks: [], route: null })
  })
})
```

- [ ] **Step 2: Run** `bun test tests/trip-core.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 3: Write the implementation**

```ts
// src/ui/client/trip-core.ts
// 行程's pure logic, shipped to the page as window.TripCore and evaluated as-is by the tests.
// Coordinates are WGS-84 {lat, lng}; lines are [[lat, lng], ...]; distances are km.
export const TRIP_CORE_SCRIPT = `
(function(global){
  function km(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function pt(p) { return { lat: p[0], lng: p[1] }; }
  // Distance from p to segment a–b on a local flat projection, and how far along it (0..1).
  function seg(p, a, b) {
    var kx = 111.32 * Math.cos(p.lat * Math.PI / 180), ky = 110.57;
    var ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky, bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky;
    var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    var x = ax + t * dx, y = ay + t * dy;
    return { km: Math.sqrt(x * x + y * y), t: t };
  }
  function lineKm(line) {
    var s = 0;
    for (var i = 1; i < line.length; i++) s += km(pt(line[i - 1]), pt(line[i]));
    return s;
  }
  // Nearest distance from p to the line, and the km along the line where that happens.
  function along(p, line) {
    if (line.length === 1) return { km: km(p, pt(line[0])), at: 0 };
    var best = { km: Infinity, at: 0 }, acc = 0;
    for (var i = 1; i < line.length; i++) {
      var a = pt(line[i - 1]), b = pt(line[i]), L = km(a, b), r = seg(p, a, b);
      if (r.km < best.km) best = { km: r.km, at: acc + r.t * L };
      acc += L;
    }
    return best;
  }
  function stopsAlong(museums, line, radius) {
    var out = [];
    museums.forEach(function(m){
      if (m.lat == null || m.lng == null) return;
      var r = along(m, line);
      if (r.km <= radius) out.push({ m: m, km: r.km, at: r.at });
    });
    return out.sort(function(a, b){ return a.at - b.at; });
  }
  function stopsNearCities(museums, cities, radius) {
    var out = [];
    museums.forEach(function(m){
      if (m.lat == null || m.lng == null) return;
      var best = -1, bk = Infinity;
      cities.forEach(function(c, i){ var d = km(m, c); if (d < bk) { bk = d; best = i; } });
      if (best >= 0 && bk <= radius) out.push({ m: m, km: bk, city: best });
    });
    return out.sort(function(a, b){ return a.city - b.city || a.km - b.km; });
  }
  // 必看 3 · each empty era it fills 2 · continues your line 2 · on site 1 · nearness up to 1.
  function score(t) {
    return (t.must ? 3 : 0) + t.fills * 2 + (t.connects ? 2 : 0) + (t.onSite ? 1 : 0) - Math.min(1, (t.km || 0) / 100);
  }
  function transitHint(d) {
    if (d < 150) return { mode: '高铁或大巴', h: Math.round(d / 100 * 10) / 10 + 0.5 };
    if (d <= 1200) return { mode: '高铁', h: Math.round((d / 250 + 1) * 10) / 10 };
    return { mode: '飞机', h: Math.round((d / 700 + 2.5) * 10) / 10 };
  }
  // groups: [{days?, stops: [...]}] → [{day, group, stops, over}]. With days: one day per day of
  // the city, stops spread at most perDay a day (the last day takes the rest, flagged over).
  // Without days (drive): chunk by perDay.
  function splitDays(groups, perDay) {
    var plan = [], day = 0;
    groups.forEach(function(g, gi){
      var s = g.stops.slice();
      if (g.days) {
        for (var d = 0; d < g.days; d++) {
          var last = d === g.days - 1, take = last ? s.splice(0) : s.splice(0, perDay);
          plan.push({ day: ++day, group: gi, stops: take, over: take.length > perDay });
        }
      } else {
        while (s.length) plan.push({ day: ++day, group: gi, stops: s.splice(0, perDay), over: false });
      }
    });
    return plan;
  }
  // Longest run of consecutive integers in eras that contains one of must; [from, to] or null.
  function longestRun(eras, must) {
    var set = {}; eras.forEach(function(e){ set[e] = true; });
    var best = null;
    must.forEach(function(x){
      if (!set[x]) return;
      var a = x, b = x;
      while (set[a - 1]) a--;
      while (set[b + 1]) b++;
      if (!best || b - a > best[1] - best[0]) best = [a, b];
    });
    return best;
  }
  // Old trips were a list of museum ids; the new trip is cities + picks.
  function migrate(saved, byId) {
    var fresh = { v: 2, mode: 'transit', cities: [], radius: 30, picks: [], route: null };
    if (!saved) return fresh;
    if (saved.v === 2) {
      return { v: 2, mode: saved.mode === 'drive' ? 'drive' : 'transit', cities: (saved.cities || []).filter(function(c){ return c && c.name && c.lat != null && c.lng != null; }),
        radius: saved.radius || 30, picks: (saved.picks || []).filter(function(id){ return byId[id]; }), route: null };
    }
    if (!Array.isArray(saved.ids)) return fresh;
    var picks = saved.ids.filter(function(id){ return byId[id]; }), order = [], acc = {};
    picks.forEach(function(id){
      var m = byId[id], c = m.city || m.name;
      if (!acc[c]) { acc[c] = { name: c, lat: 0, lng: 0, n: 0 }; order.push(c); }
      if (m.lat != null) { acc[c].lat += m.lat; acc[c].lng += m.lng; acc[c].n++; }
    });
    fresh.picks = picks;
    fresh.cities = order.filter(function(c){ return acc[c].n; }).map(function(c){ var a = acc[c]; return { name: a.name, lat: a.lat / a.n, lng: a.lng / a.n, days: 1 }; });
    return fresh;
  }
  global.TripCore = { km: km, lineKm: lineKm, along: along, stopsAlong: stopsAlong, stopsNearCities: stopsNearCities,
    score: score, transitHint: transitHint, splitDays: splitDays, longestRun: longestRun, migrate: migrate };
})(window);
`
```

Check the `transitHint` test values: 700 km → `700/250 + 1 = 3.8` ✓; 100 km → mode 高铁或大巴 ✓; 2000 → 飞机 ✓.

- [ ] **Step 4: Run** `bun test tests/trip-core.test.ts` — Expected: all pass. If `along` for 郑州 fails the `< 120` bound, print `r.km` and adjust the test point, not the geometry.

- [ ] **Step 5: Commit**

```bash
git add src/ui/client/trip-core.ts tests/trip-core.test.ts
git commit -m "feat(trip): TripCore — along-route geometry, near-city grouping, scoring, day split, migration"
```

---

### Task 6: Page wiring (script, stage class, legend, count)

**Files:**
- Modify: `src/ui/home.ts`

- [ ] **Step 1:** Import and inject the core next to coords:

```ts
import { TRIP_CORE_SCRIPT } from "./client/trip-core"
```
and directly after `<script>${COORDS_SCRIPT}</script>` add `<script>${TRIP_CORE_SCRIPT}</script>`.

- [ ] **Step 2:** Stage class for the mobile sheet: change `<div class="stage">` to
`<div class="stage" :class="tripMode ? 'is-trip' : ''">`.

- [ ] **Step 3:** Top-bar count uses picks: replace both `trip.ids.length` in the `tb-trip` button with `trip.picks.length`.

- [ ] **Step 4:** Legend in trip mode — replace the `x-if="tripMode"` template body with:

```html
<div class="row"><span class="dot g"></span><span x-text="trip.mode === 'drive' ? '路线与沿途' : '城市与周边'"></span></div>
<div class="row"><span class="dot c"></span><span>推荐 · 点开可加入</span></div>
```

- [ ] **Step 5:** `bun run typecheck` → clean. Commit:

```bash
git add src/ui/home.ts
git commit -m "feat(trip): inject TripCore; stage class, legend, count for the new trip"
```

---

### Task 7: Trip state, migration and methods in `app.ts`

**Files:**
- Modify: `src/ui/client/app.ts`

- [ ] **Step 1: State.** Replace `trip: { ids: [], order: '' },` with:

```js
    trip: { v: 2, mode: 'transit', cities: [], radius: 30, picks: [], route: null },
    tripQ: '',
    tripResults: [],
    tripBusy: false,
```

- [ ] **Step 2: Load + migrate.** Replace the `savedTrip` block in init with:

```js
        var savedTrip = JSON.parse(window.localStorage.getItem('mmTrip') || 'null');
        var byId = {};
        this.museums.forEach(function(m){ byId[m.id] = m; });
        this.trip = window.TripCore.migrate(savedTrip, byId);
        if (this.trip.mode === 'drive' && this.trip.cities.length > 1) this.tripFetchRoute();
```

- [ ] **Step 3: Replace the whole `// ─── 行程 (route planning) ───` section** (from `saveTrip()` through `planTripWithAI()`, ending before the next section) with the methods below. Keep `kmBetween`, `eraIndex`, `tripEraLabel` (still used elsewhere) — re-add them unchanged inside this block.

```js
    // ─── 行程 · 沿途找馆 ───
    // You say where you are going (a drive route, or cities in order); we find the museums worth
    // seeing along the way and why; you pick; we split it into days. Logic lives in TripCore.
    saveTrip() {
      var t = this.trip;
      try { window.localStorage.setItem('mmTrip', JSON.stringify({ v: 2, mode: t.mode, cities: t.cities, radius: t.radius, picks: t.picks })); } catch(_) {}
      __tripView = null;
      if (this.tripMode) this.refreshMarkers();
      else if (this.ledgerOpt.tab === 'near' && this.ledgerOpt.anchor === 'trip') this.syncLedgerViews();
    },

    inTrip(id) { return this.trip.picks.indexOf(id) >= 0; },

    /** Pick or unpick a museum; picking one outside the trip adds its city. */
    toggleTrip(id) {
      var i = this.trip.picks.indexOf(id), m = this.museumById(id);
      if (i >= 0) { this.trip.picks.splice(i, 1); this.flashToast('已从这一趟移出'); }
      else {
        this.trip.picks.push(id);
        var self = this, near = m && this.trip.cities.some(function(c){ return self.kmBetween(c, m) <= Math.max(self.trip.radius, 60); });
        if (m && m.lat != null && !near) this.trip.cities.push({ name: m.city || m.name, lat: m.lat, lng: m.lng, days: 1 });
        this.flashToast('已加入这一趟 · 共 ' + this.trip.picks.length + ' 座');
      }
      this.saveTrip();
      if (this.trip.mode === 'drive') this.tripFetchRoute();
      if (this.drawer.open && this.drawer.kind === 'museum' && this._drawerMuseum && this._drawerMuseum.id === id) {
        this.drawer.sections = this.buildMuseumSections(this._drawerMuseum);
      }
    },

    toggleTripMode() {
      this.tripMode = !this.tripMode;
      if (this.tripMode) {
        this.visits.footprintMode = false;
        this.tocOpen = true;
        if (this.view !== 'map') this.setView('map');
      }
      if (window.MuseumMap.onMapClick) window.MuseumMap.onMapClick(this.tripMode ? this.tripMapClick.bind(this) : null);
      this.refreshMarkers();
    },

    tripSetMode(mode) {
      if (this.trip.mode === mode) return;
      this.trip.mode = mode;
      this.trip.radius = mode === 'drive' ? 30 : 30;
      this.saveTrip();
      if (mode === 'drive') this.tripFetchRoute();
    },

    tripSetRadius(r) { this.trip.radius = r; this.saveTrip(); },

    tripRadii() { return this.trip.mode === 'drive' ? [10, 30, 80] : [15, 30, 60]; },

    /** Cities that have museums, most first: quick picks and local search. */
    tripKnownCities() {
      if (__tripCities) return __tripCities;
      var acc = {}, order = [];
      this.museums.forEach(function(m){
        if (!m.city || m.lat == null) return;
        if (!acc[m.city]) { acc[m.city] = { name: m.city, lat: 0, lng: 0, n: 0 }; order.push(m.city); }
        acc[m.city].lat += m.lat; acc[m.city].lng += m.lng; acc[m.city].n++;
      });
      __tripCities = order.map(function(c){ var a = acc[c]; return { name: a.name, lat: a.lat / a.n, lng: a.lng / a.n, n: a.n }; })
        .sort(function(a, b){ return b.n - a.n; });
      return __tripCities;
    },

    async tripSearch() {
      var q = (this.tripQ || '').trim();
      if (!q) { this.tripResults = []; return; }
      var local = this.tripKnownCities().filter(function(c){ return c.name.indexOf(q) >= 0 || q.indexOf(c.name) >= 0; }).slice(0, 4)
        .map(function(c){ return { name: c.name, lat: c.lat, lng: c.lng, note: c.n + ' 座馆' }; });
      this.tripResults = local;
      try {
        var res = await fetch('/api/geocode?q=' + encodeURIComponent(q));
        if (!res.ok || (this.tripQ || '').trim() !== q) return;
        var remote = await res.json(), seen = {};
        local.forEach(function(r){ seen[r.name.replace(/市$/, '')] = true; });
        var more = (remote || []).filter(function(r){ var k = r.name.replace(/市$/, ''); if (seen[k]) return false; seen[k] = true; return true; })
          .map(function(r){ return { name: r.name, lat: r.lat, lng: r.lng, note: r.province || '' }; });
        this.tripResults = local.concat(more).slice(0, 6);
      } catch(_) {}
    },

    tripAddFirst() { if (this.tripResults.length) this.tripAddCity(this.tripResults[0]); },

    tripAddCity(p) {
      var name = String(p.name || '').replace(/市$/, '');
      if (this.trip.cities.some(function(c){ return c.name === name; })) { this.flashToast(name + ' 已在行程里'); return; }
      this.trip.cities.push({ name: name, lat: p.lat, lng: p.lng, days: 1 });
      this.tripQ = ''; this.tripResults = [];
      this.saveTrip();
      if (this.trip.mode === 'drive') this.tripFetchRoute();
    },

    tripRemoveCity(i) { this.trip.cities.splice(i, 1); this.saveTrip(); if (this.trip.mode === 'drive') this.tripFetchRoute(); },

    tripMoveCity(i, dir) {
      var j = i + dir, cs = this.trip.cities.slice();
      if (j < 0 || j >= cs.length) return;
      var t = cs[i]; cs[i] = cs[j]; cs[j] = t;
      this.trip.cities = cs; this.saveTrip();
      if (this.trip.mode === 'drive') this.tripFetchRoute();
    },

    tripSetDays(i, d) {
      var c = this.trip.cities[i];
      c.days = Math.max(1, Math.min(9, (c.days || 1) + d));
      this.saveTrip();
    },

    /** Tap the map in 行程: ask which city that is, offer to add it. */
    async tripMapClick(ll) {
      var w = window.fromMapCoord(ll.lat, ll.lng), self = this;
      try {
        var res = await fetch('/api/geocode/reverse?lat=' + w[0].toFixed(4) + '&lng=' + w[1].toFixed(4));
        var p = res.ok ? await res.json() : null;
        if (!p || !p.name) return;
        window.MuseumMap.askCity(p, '把「' + p.name.replace(/市$/, '') + '」加入行程', function(){ self.tripAddCity(p); });
      } catch(_) {}
    },

    tripRouteKey() { return this.trip.cities.map(function(c){ return c.lat.toFixed(3) + ',' + c.lng.toFixed(3); }).join(';'); },

    async tripFetchRoute() {
      var key = this.tripRouteKey();
      if (this.trip.mode !== 'drive' || this.trip.cities.length < 2) { this.trip.route = null; return; }
      if (this.trip.route && this.trip.route.key === key) return;
      this.tripBusy = true;
      try {
        var res = await fetch('/api/route?pts=' + encodeURIComponent(key));
        if (res.ok && this.tripRouteKey() === key) { var r = await res.json(); r.key = key; this.trip.route = r; __tripView = null; this.refreshMarkers(); }
      } catch(_) {}
      this.tripBusy = false;
    },

    /** The line we search along: the real route if we have it, else city to city. */
    tripLine() {
      var r = this.trip.route;
      if (this.trip.mode === 'drive' && r && r.key === this.tripRouteKey()) return r.line;
      return this.trip.cities.map(function(c){ return [c.lat, c.lng]; });
    },

    tripHopLabel(i) {
      var a = this.trip.cities[i], b = this.trip.cities[i + 1];
      if (!a || !b) return '';
      if (this.trip.mode === 'drive') {
        var r = this.trip.route, leg = r && r.key === this.tripRouteKey() && r.legs[i];
        if (leg) return '开车 · ' + leg.km + ' km' + (leg.h ? ' · 约 ' + leg.h + ' 小时' : '');
        return '开车 · 直线 ' + Math.round(this.kmBetween(a, b)) + ' km';
      }
      var d = Math.round(this.kmBetween(a, b)), h = window.TripCore.transitHint(d);
      return h.mode + ' · 约 ' + h.h + ' 小时 · ' + d + ' km';
    },

    tripTitle() {
      var cs = this.trip.cities;
      return cs.length ? cs.map(function(c){ return c.name; }).join(' → ') : '要去哪儿？';
    },

    /** Your held eras (layer numbers) — shared by tags and the history line. */
    tripHeldEras() {
      var self = this, held = {};
      this.visitedMuseums().forEach(function(m){ self.linkedDynasties(m.id).forEach(function(d){ held[self.layerNo(d.id)] = true; }); });
      return held;
    },

    /** Why a museum is worth it on this trip. */
    tripTags(m, kmOff, held) {
      var self = this, tiers = m.tiers || [];
      var ds = this.linkedDynasties(m.id);
      var fills = ds.filter(function(d){ return !held[self.layerNo(d.id)]; });
      var connects = fills.some(function(d){ var n = self.layerNo(d.id); return held[n - 1] || held[n + 1]; });
      var onSite = ds.some(function(d){ return self.isOnSite(m.id, d.id); });
      var must = tiers.indexOf('tier1') >= 0 || tiers.indexOf('heritage-site') >= 0;
      var chips = [];
      if (must) chips.push({ k: 'must', t: tiers.indexOf('heritage-site') >= 0 ? '必看 · 世遗/国保' : '必看 · 一级馆' });
      if (fills.length && this.visits.ids.length) chips.push({ k: 'fill', t: '补' + fills.slice(0, 2).map(function(d){ return self.dynastyShortName(d).replace(/[：:].*$/, ''); }).join('、') });
      if (connects && this.visits.ids.length) chips.push({ k: 'link', t: '接得上' });
      if (onSite) chips.push({ k: 'site', t: '原址' });
      if (this.trip.mode === 'drive' && kmOff <= 5) chips.push({ k: 'near', t: '顺路' });
      var t = { must: must, fills: this.visits.ids.length ? fills.length : 0, connects: connects && this.visits.ids.length > 0, onSite: onSite, km: kmOff };
      return { chips: chips, score: window.TripCore.score(t), eras: ds.map(function(d){ return self.layerNo(d.id); }) };
    },

    /** Recommended museums grouped by city (transit) or by leg (drive), best first in each. */
    tripAlong() {
      var t = this.trip, key = [t.mode, this.tripRouteKey(), t.radius, t.picks.join(','), this.visits.ids.join(','), t.route ? t.route.key : ''].join('|');
      if (__tripView && __tripViewKey === key) return __tripView;
      var self = this, held = this.tripHeldEras(), groups = [];
      var ms = this.museums.filter(function(m){ return m.lat != null && !self.isVisited(m.id); });
      var cities = t.cities;
      var mk = function(s){ var g = self.tripTags(s.m, s.km, held); return { m: s.m, km: Math.round(s.km), chips: g.chips, score: g.score, eras: g.eras, picked: self.inTrip(s.m.id) }; };
      if (t.mode === 'drive' && cities.length > 1) {
        var line = this.tripLine();
        var at = cities.map(function(c){ return window.TripCore.along(c, line).at; });
        var stops = window.TripCore.stopsAlong(ms, line, t.radius);
        for (var i = 0; i < cities.length - 1; i++) {
          var inLeg = stops.filter(function(s){ return s.at >= at[i] - t.radius && (i === cities.length - 2 ? true : s.at < at[i + 1] - t.radius); });
          groups.push({ key: 'leg' + i, title: cities[i].name + ' → ' + cities[i + 1].name, stops: inLeg.map(mk) });
        }
      } else if (cities.length) {
        var near = window.TripCore.stopsNearCities(ms, cities, t.radius);
        cities.forEach(function(c, i){
          groups.push({ key: 'city' + i, title: c.name + (t.mode === 'transit' ? ' · ' + (c.days || 1) + ' 天' : ''), days: c.days || 1,
            stops: near.filter(function(s){ return s.city === i; }).map(mk) });
        });
      }
      groups.forEach(function(g){ g.stops.sort(function(a, b){ return (b.picked - a.picked) || (b.score - a.score) || a.km - b.km; }); g.shown = g.stops.slice(0, 8); });
      __tripView = { groups: groups, count: groups.reduce(function(s, g){ return s + g.stops.length; }, 0) };
      __tripViewKey = key;
      return __tripView;
    },

    /** One line about the history this trip walks through. */
    tripTheme() {
      var v = this.tripAlong(), self = this, held = this.tripHeldEras();
      var picked = [], rec = [];
      v.groups.forEach(function(g){ g.stops.forEach(function(s){ (s.picked ? picked : rec).push(s); }); });
      var from = picked.length ? picked : rec.slice().sort(function(a, b){ return b.score - a.score; }).slice(0, 6);
      if (!from.length) return '';
      var mine = {}; from.forEach(function(s){ s.eras.forEach(function(e){ mine[e] = true; }); });
      var all = Object.keys(held).map(Number).concat(Object.keys(mine).map(Number));
      var run = window.TripCore.longestRun(all, Object.keys(mine).map(Number));
      var name = function(n){ var d = self.dynasties[n - 1]; return d ? self.dynastyShortName(d).replace(/[：:].*$/, '') : ''; };
      if (run && run[1] - run[0] >= 2) {
        var names = []; for (var n = run[0]; n <= run[1]; n++) names.push(name(n));
        return '这一趟能走通 <b>' + names.join(' → ') + '</b>';
      }
      var fills = Object.keys(mine).map(Number).filter(function(e){ return !held[e]; }).sort(function(a, b){ return a - b; }).map(name);
      return fills.length ? '这一趟会补上 <b>' + fills.slice(0, 4).join('、') + '</b>' : '';
    },

    /** Picked museums split into days. */
    tripDays() {
      var self = this, v = this.tripAlong();
      var groups = v.groups.map(function(g){ return { days: self.trip.mode === 'transit' ? g.days : 0, title: g.title, stops: g.stops.filter(function(s){ return s.picked; }).map(function(s){ return s.m.name; }) }; });
      return window.TripCore.splitDays(groups, 3).map(function(d){ return { day: d.day, title: groups[d.group].title.replace(/ · \d+ 天$/, ''), stops: d.stops, over: d.over }; })
        .filter(function(d){ return d.stops.length || self.trip.mode === 'transit'; });
    },

    tripPicksOutside() {
      var v = this.tripAlong(), inView = {};
      v.groups.forEach(function(g){ g.stops.forEach(function(s){ inView[s.m.id] = true; }); });
      var self = this;
      return this.trip.picks.filter(function(id){ return !inView[id]; }).map(function(id){ return self.museumById(id); }).filter(Boolean);
    },

    clearTrip() {
      if (!window.confirm('清空这一趟？')) return;
      this.trip = { v: 2, mode: this.trip.mode, cities: [], radius: 30, picks: [], route: null };
      this.saveTrip();
    },

    planTripWithAI() {
      var self = this, t = this.trip;
      if (!t.cities.length) return;
      var mode = t.mode === 'drive' ? '自驾' : '坐高铁/飞机';
      var route = t.cities.map(function(c){ return c.name + (t.mode === 'transit' ? '（' + (c.days || 1) + ' 天）' : ''); }).join(' → ');
      var picks = t.picks.map(function(id){ var m = self.museumById(id); return m ? '· ' + m.name + (m.city ? '（' + m.city + '）' : '') : ''; }).filter(Boolean);
      var prompt = '我准备' + mode + '出行：' + route + '。' + (picks.length ? '想去这些博物馆：\\n' + picks.join('\\n') + '\\n' : '')
        + '请帮我按天排一个行程：每天去哪几座、为什么这样排、每座馆最值得看的镇馆之宝和展厅；如果沿途还有特别值得去的馆，也一并推荐。';
      this.askGuide(prompt);
    },

    kmBetween(a, b) {
      if (!a || !b) return 0;
      return window.TripCore.km(a, b);
    },

    /** The earliest dynasty layer a museum holds — used to walk history in order. */
    eraIndex(m) {
      var ds = this.linkedDynasties(m.id);
      if (!ds.length) return 999;
      var self = this;
      return Math.min.apply(null, ds.map(function(d){ return self.layerNo(d.id); }));
    },

    tripEraLabel(m) {
      var i = this.eraIndex(m);
      return i < 999 ? this.dynastyShortName(this.dynasties[i - 1]).replace(/[：:].*$/, '') : '';
    },
```

- [ ] **Step 4: Module-level caches.** Next to the existing `var __ledger, __ledgerKey` declarations (search `__ledgerKey`), add:

```js
var __tripView = null, __tripViewKey = '', __tripCities = null;
```

- [ ] **Step 5: Remove now-dead code.** Delete `tripMuseums`, `tripLegKm`, `tripTotalKm`, `tripCities`, `moveTrip`, `sortTripByRoute`, `sortTripByTime` if still present. Then `grep -n "trip\.ids\|tripMuseums\|trip\.order\|sortTripBy\|moveTrip\|tripLegKm\|tripTotalKm\|tripCities()" src/ui/client/app.ts src/ui/components/*.ts src/ui/home.ts` and fix each hit:
  - `ledgerView` key: replace `this.trip.ids.join(',')` with `this.tripRouteKey() + '/' + this.trip.radius`.
  - `ledgerAnchors` trip branch:
    ```js
      if (o.anchor === 'trip') {
        var cs = this.trip.cities;
        return cs.length ? cs.map(function(c){ return { lat: c.lat, lng: c.lng }; }) : null;
      }
    ```
  - `setLedgerAnchor`/`ensureLedgerAnchor`: `!this.trip.ids.length` → `!this.trip.cities.length`; toast text `'行程里还没有城市'`.
  - Drawer stamp button (search `trip-toggle trip-line`): use `this.trip.picks.indexOf(m.id) + 1` and text `inTrip ? '已在这一趟 · 点击移出' : '加入这一趟 · 沿途找馆'`.
  - Any other `trip.ids` → `trip.picks`.

- [ ] **Step 6:** Build check:

```bash
bun -e 'import {APP_SCRIPT} from "./src/ui/client/app.ts"; console.log(typeof APP_SCRIPT)' 2>/dev/null || true
bun run typecheck
```
(If `app.ts` exports under another name, check its first `export const` line and adapt.) Then load the page in the browser check of Task 10. Commit:

```bash
git add src/ui/client/app.ts
git commit -m "feat(trip): v2 trip state, migration, city search/add, route fetch, along-route recommendations, day split"
```

---

### Task 8: Map — route, corridor, city stops, click-to-add

**Files:**
- Modify: `src/ui/client/map.ts`
- Modify: `src/ui/client/app.ts` (`refreshMarkers` trip branch)

- [ ] **Step 1:** In `map.ts`, after `clearRoute`, add:

```js
  /** 行程: the line we travel (WGS [[lat,lng]]), a soft corridor when driving, numbered city stops. */
  setTripLine: function(line, cities, opts) {
    opts = opts || {};
    this.routeLayer.clearLayers();
    var pts = (line || []).map(function(p){ return window.toMapCoord(p[0], p[1]); });
    if (pts.length > 1) {
      if (opts.corridor) L.polyline(pts, { className: 'route-corridor', weight: 26, opacity: 0.16, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(this.routeLayer);
      L.polyline(pts, { className: 'route-glow', weight: 6, opacity: 0.12, interactive: false }).addTo(this.routeLayer);
      L.polyline(pts, opts.real
        ? { className: 'route-line', weight: 2.6, opacity: 0.95, lineCap: 'round', interactive: false }
        : { className: 'route-line', weight: 2, opacity: 0.95, dashArray: '2 7', lineCap: 'round', interactive: false }).addTo(this.routeLayer);
    }
    var self = this, cs = [];
    (cities || []).forEach(function(c, i){
      var p = window.toMapCoord(c.lat, c.lng); cs.push(p);
      L.marker(p, {
        icon: L.divIcon({ className: '', html: '<div class="route-city"><b>' + (i + 1) + '</b><span>' + String(c.name).replace(/[<&]/g, '') + '</span></div>', iconSize: [0, 0], iconAnchor: [11, 11] }),
        interactive: false, zIndexOffset: 600,
      }).addTo(self.routeLayer);
    });
    var all = pts.length ? pts : cs;
    var key = all.length + ':' + (all[0] || []).join(',') + ':' + (all[all.length - 1] || []).join(',');
    if (all.length && key !== this._tripKey) {
      this._tripKey = key;
      try { this.map.flyToBounds(L.latLngBounds(all).pad(0.25), { duration: 0.8, maxZoom: 10 }); } catch(_) {}
    }
  },
  /** A small popup at a place (WGS) with one action button. */
  askCity: function(p, label, onAdd) {
    var c = window.toMapCoord(p.lat, p.lng), self = this;
    var el = document.createElement('button');
    el.className = 'ask-city'; el.type = 'button'; el.textContent = label;
    el.addEventListener('click', function(){ self.map.closePopup(); onAdd(); });
    L.popup({ closeButton: false, className: 'ask-city-pop', offset: [0, -4] }).setLatLng(c).setContent(el).openOn(this.map);
  },
  /** Map taps (GCJ latlng) while a mode wants them; null to stop. */
  onMapClick: function(cb) {
    this._mapClick = cb;
    if (!this._mapClickBound && this.map) {
      this._mapClickBound = true;
      var self = this;
      this.map.on('click', function(e){ if (self._mapClick) self._mapClick(e.latlng); });
    }
  },
```

- [ ] **Step 2:** In `app.ts` `refreshMarkers`, replace the `if (this.tripMode) { ... }` branch with:

```js
      if (this.tripMode) {
        var tv = this.tripAlong(), shownIds = {}, shown = [];
        tv.groups.forEach(function(g){ g.shown.forEach(function(s){ if (!shownIds[s.m.id]) { shownIds[s.m.id] = true; shown.push(s.m); } }); });
        this.trip.picks.forEach(function(id){ var m = self.museumById(id); if (m && !shownIds[id]) { shownIds[id] = true; shown.push(m); } });
        window.MuseumMap.setMarkers(shown, function(id){ self.openMuseum(id); }, {
          recommended: true,
          isVisited: function(id){ return self.isVisited(id) || self.inTrip(id); },
          isCandidate: function(id){ return !self.inTrip(id); },
        });
        window.MuseumMap.clearEvents();
        var r = this.trip.route, real = this.trip.mode === 'drive' && r && r.key === this.tripRouteKey() && r.provider === 'osrm';
        window.MuseumMap.setTripLine(this.tripLine(), this.trip.cities, { real: real, corridor: this.trip.mode === 'drive' });
        if (this.trip.mode === 'transit' && this.trip.cities.length && window.MuseumMap.setRange) window.MuseumMap.setRange(this.trip.cities, this.trip.radius);
      } else if (this.visits.footprintMode) {
```

Also make sure `toggleTripMode` (Task 7) and any code leaving trip mode clears the click handler: in the place that sets `this.tripMode = false` (search `this.tripMode = false;`), add `if (window.MuseumMap.onMapClick) window.MuseumMap.onMapClick(null);`.

- [ ] **Step 3:** Typecheck and commit:

```bash
bun run typecheck
git add src/ui/client/map.ts src/ui/client/app.ts
git commit -m "feat(trip): draw route/corridor and city stops; tap the map to add a city"
```

---

### Task 9: Sidebar panel + styles (desktop and mobile sheet)

**Files:**
- Modify: `src/ui/components/sidebar.ts` (the `trip` section; the ledger rec button at the `lg-rec-trip` line; the `trip-dot` in the list; the `行程 ·` ghost button)
- Modify: `src/ui/theme.ts`

- [ ] **Step 1:** Replace the `const trip = \`...\`` section with:

```ts
  // ── 行程 · 沿途找馆 ──
  const trip = `<section class="toc-hero is-trip" x-show="tripMode" x-cloak>
  <div class="hero-kicker">${icon("route", 15)}<span>我的出行</span><span class="mono">TRIP</span></div>
  <h1 class="hero-title trip-title" x-text="tripTitle()"></h1>
  <div class="seg trip-mode" role="tablist">
    <button class="seg-btn" :class="trip.mode === 'transit' ? 'active' : ''" @click="tripSetMode('transit')">坐车 / 坐飞机</button>
    <button class="seg-btn" :class="trip.mode === 'drive' ? 'active' : ''" @click="tripSetMode('drive')">自驾</button>
  </div>
  <p class="hero-lede" x-show="!trip.cities.length">先说要去哪儿：坐车就把城市按先后排好，自驾就排出起点、途经和终点。我们沿着这一路，把值得看的馆找出来。</p>
  <ol class="trip-cities" x-show="trip.cities.length">
    <template x-for="(c, i) in trip.cities" :key="c.name + i">
      <li>
        <div class="trip-city-row">
          <span class="trip-no" x-text="i + 1"></span>
          <span class="trip-city-name" x-text="c.name"></span>
          <span class="trip-days" x-show="trip.mode === 'transit'">
            <button class="icon-btn" @click="tripSetDays(i, -1)" :disabled="(c.days || 1) <= 1" title="少一天">−</button>
            <span x-text="(c.days || 1) + ' 天'"></span>
            <button class="icon-btn" @click="tripSetDays(i, 1)" title="多一天">＋</button>
          </span>
          <span class="trip-ops">
            <button class="icon-btn" @click="tripMoveCity(i, -1)" :disabled="i === 0" title="前移">${icon("arrowUp", 14)}</button>
            <button class="icon-btn" @click="tripMoveCity(i, 1)" :disabled="i === trip.cities.length - 1" title="后移">${icon("arrowDown", 14)}</button>
            <button class="icon-btn" @click="tripRemoveCity(i)" title="移除">${icon("close", 14)}</button>
          </span>
        </div>
        <div class="trip-hop" x-show="i < trip.cities.length - 1" x-text="tripHopLabel(i)"></div>
      </li>
    </template>
  </ol>
  <div class="trip-add">
    <input class="trip-search" type="search" enterkeyhint="done" x-model="tripQ" @input.debounce.350ms="tripSearch()" @keydown.enter.prevent="tripAddFirst()"
      :placeholder="trip.cities.length ? '再加一个城市（也可以直接点地图）' : '搜一个城市，或者直接点地图'">
    <div class="trip-suggest" x-show="tripResults.length">
      <template x-for="r in tripResults" :key="r.name + r.lat">
        <button @click="tripAddCity(r)"><b x-text="r.name"></b><small x-text="r.note"></small></button>
      </template>
    </div>
    <div class="trip-chips" x-show="!trip.cities.length && !tripResults.length">
      <template x-for="c in tripKnownCities().slice(0, 10)" :key="c.name">
        <button class="chip" @click="tripAddCity(c)"><span x-text="c.name"></span><small x-text="c.n"></small></button>
      </template>
    </div>
  </div>
  <template x-if="trip.cities.length">
    <div class="trip-find">
      <div class="trip-radius">
        <span x-text="trip.mode === 'drive' ? '沿途两侧' : '城市周边'"></span>
        <div class="seg">
          <template x-for="r in tripRadii()" :key="r">
            <button class="seg-btn" :class="trip.radius === r ? 'active' : ''" @click="tripSetRadius(r)" x-text="r + ' km'"></button>
          </template>
        </div>
        <span class="trip-busy" x-show="tripBusy">规划路线…</span>
      </div>
      <p class="trip-theme" x-show="tripTheme()" x-html="tripTheme()"></p>
      <template x-for="g in tripAlong().groups" :key="g.key">
        <div class="trip-group">
          <div class="trip-group-head"><span x-text="g.title"></span><small x-text="g.stops.length ? g.stops.length + ' 座' : '这一段没有收录的馆'"></small></div>
          <template x-for="s in g.shown" :key="s.m.id">
            <div class="trip-pick" :class="s.picked ? 'on' : ''">
              <button class="trip-check" @click="toggleTrip(s.m.id)" :title="s.picked ? '移出这一趟' : '加入这一趟'">${icon("check", 14)}</button>
              <button class="trip-main" @click="openMuseum(s.m.id)">
                <span class="trip-name" x-text="s.m.name"></span>
                <span class="trip-why">
                  <template x-for="t in s.chips" :key="t.t"><span class="why" :class="'why-' + t.k" x-text="t.t"></span></template>
                  <span class="why-km" x-text="trip.mode === 'drive' ? '绕路 ' + s.km + ' km' : s.km + ' km'"></span>
                </span>
              </button>
            </div>
          </template>
        </div>
      </template>
      <template x-if="tripPicksOutside().length">
        <div class="trip-group">
          <div class="trip-group-head"><span>已选 · 不在这条线上</span></div>
          <template x-for="m in tripPicksOutside()" :key="m.id">
            <div class="trip-pick on">
              <button class="trip-check" @click="toggleTrip(m.id)" title="移出这一趟">${icon("check", 14)}</button>
              <button class="trip-main" @click="openMuseum(m.id)"><span class="trip-name" x-text="m.name"></span><span class="trip-why"><span class="why-km" x-text="m.city"></span></span></button>
            </div>
          </template>
        </div>
      </template>
      <div class="trip-plan" x-show="trip.picks.length">
        <div class="trip-group-head"><span>按天</span><small x-text="trip.picks.length + ' 座'"></small></div>
        <template x-for="d in tripDays()" :key="d.day">
          <div class="trip-day" :class="d.over ? 'over' : ''">
            <b x-text="'第 ' + d.day + ' 天'"></b><span x-text="d.title"></span>
            <span class="trip-day-stops" x-text="d.stops.length ? d.stops.join('、') : '自由安排'"></span>
            <small x-show="d.over">这一天可能看不完</small>
          </div>
        </template>
      </div>
    </div>
  </template>
  <div class="hero-actions">
    <button class="btn btn-primary" x-show="trip.cities.length" @click="planTripWithAI()">${icon("sparkle", 16)}让讲解员排行程</button>
    <button class="btn btn-text" x-show="trip.cities.length || trip.picks.length" @click="clearTrip()">清空</button>
    <button class="btn btn-text" @click="toggleTripMode()">${icon("arrowLeft", 16)}收起</button>
  </div>
</section>`
```

- [ ] **Step 2:** Other sidebar references:
  - `lg-rec-trip` button text: `inTrip(r.m.id) ? '已在这一趟' : '加入这一趟'`.
  - The ghost button `行程 · <span x-text="trip.ids.length">` → `trip.picks.length`.

- [ ] **Step 3:** Styles — append to `src/ui/theme.ts` near the other trip styles (search `.trip-list`), replacing obsolete `.trip-sort`, `.trip-list`, `.trip-stop`, `.trip-leg` rules:

```css
/* 行程 · 沿途找馆 */
.trip-title { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.25; overflow-wrap: anywhere; }
.trip-mode { margin: 4px 0 14px; }
.trip-cities { list-style: none; margin: 0 0 10px; padding: 0; }
.trip-city-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.trip-city-name { flex: 1; font-family: var(--serif); font-size: 17px; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.trip-days { display: inline-flex; align-items: center; gap: 4px; font-family: var(--mono); font-size: 12px; color: var(--text-2); }
.trip-hop { margin: 0 0 2px 13px; padding: 4px 0 6px 18px; border-left: 1px dashed var(--line-strong); font-family: var(--mono); font-size: 11.5px; color: var(--text-3); }
.trip-add { position: relative; margin-bottom: 12px; }
.trip-search { width: 100%; font-size: 16px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--bg2); color: var(--text); }
.trip-suggest { margin-top: 6px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg2); }
.trip-suggest button { display: flex; width: 100%; justify-content: space-between; gap: 10px; padding: 9px 14px; border: 0; background: none; color: var(--text); text-align: left; cursor: pointer; }
.trip-suggest button + button { border-top: 1px solid var(--line); }
.trip-suggest small { color: var(--text-3); }
.trip-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.trip-chips .chip small { margin-left: 4px; color: var(--text-3); font-family: var(--mono); }
.trip-radius { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-2); margin-bottom: 10px; }
.trip-busy { font-family: var(--mono); font-size: 11.5px; color: var(--text-3); }
.trip-theme { margin: 4px 0 14px; padding: 10px 12px; border-radius: 12px; background: rgba(var(--seal-rgb), 0.07); color: var(--text-2); font-size: 13.5px; overflow-wrap: anywhere; }
.trip-theme b { color: var(--seal-ink-strong); font-weight: 600; }
.trip-group { margin-bottom: 14px; }
.trip-group-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); font-family: var(--serif); font-weight: 600; }
.trip-group-head small { font-family: var(--mono); font-weight: 400; font-size: 11.5px; color: var(--text-3); }
.trip-pick { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid var(--line); }
.trip-check { flex: none; width: 24px; height: 24px; border-radius: 7px; border: 1.5px solid var(--line-strong); background: none; color: transparent; display: grid; place-items: center; cursor: pointer; margin-top: 2px; }
.trip-pick.on .trip-check { background: var(--seal); border-color: var(--seal); color: #FFF2E8; }
.trip-pick .trip-main { flex: 1; min-width: 0; text-align: left; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; }
.trip-pick .trip-name { display: block; font-size: 15px; overflow-wrap: anywhere; }
.trip-why { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
.trip-why .why { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--text-2); }
.trip-why .why-must { color: var(--seal-ink-strong); border-color: rgba(var(--seal-rgb), 0.45); }
.trip-why .why-fill, .trip-why .why-link { color: var(--gilt-ink, var(--text)); border-color: rgba(var(--gilt-rgb), 0.5); }
.trip-why .why-km { font-family: var(--mono); font-size: 11px; color: var(--text-3); padding: 1px 0; }
.trip-plan { margin: 6px 0 14px; }
.trip-day { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
.trip-day b { font-family: var(--mono); font-weight: 500; color: var(--text-2); }
.trip-day .trip-day-stops { grid-column: 2; color: var(--text-2); overflow-wrap: anywhere; }
.trip-day small { grid-column: 2; color: var(--seal-ink-strong); font-size: 11.5px; }
.route-city { display: inline-flex; align-items: center; gap: 5px; transform: translate(-11px, -11px); white-space: nowrap; }
.route-city b { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--gilt); color: var(--bg); font: 600 12px/1 var(--mono); box-shadow: 0 0 0 3px rgba(var(--bg-rgb), 0.7); }
.route-city span { font-family: var(--serif); font-weight: 600; font-size: 13px; color: var(--text); text-shadow: 0 0 4px var(--bg), 0 0 8px var(--bg); }
path.route-corridor { stroke: var(--gilt); }
.ask-city-pop .leaflet-popup-content-wrapper { border-radius: 999px; padding: 0; background: var(--bg2); }
.ask-city-pop .leaflet-popup-content { margin: 0; }
.ask-city { border: 0; background: none; color: var(--seal-ink-strong); font: 600 13px var(--sans); padding: 8px 14px; cursor: pointer; white-space: nowrap; }
/* Phones: in 行程 the panel is a bottom sheet, the map stays in view above it. */
@media (max-width: 640px) {
  .stage.is-trip .toc-wrap { top: auto; bottom: 0; left: 0; right: 0; width: auto; height: 62dvh; transform: translateY(104%); }
  .stage.is-trip .toc-wrap.open { transform: translateY(0); }
  .stage.is-trip .toc-wrap .toc { border-right: 0; border-top: 1px solid var(--line-strong); border-radius: 22px 22px 0 0; padding-top: 6px; box-shadow: 0 -24px 60px -30px var(--sh-95); }
  .stage.is-trip .toc-overlay { display: none; }
}
```

Check the variables used exist in `theme.ts` (`--gilt-ink` falls back; `--bg-rgb`, `--gilt-rgb`, `--seal-rgb`, `--sh-95`, `--line`, `--line-strong`, `--bg2` are already used elsewhere). If `.chip` has no base style, add `.trip-chips .chip { font: inherit; font-size: 13px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--bg2); color: var(--text); cursor: pointer; }`.

- [ ] **Step 4:** Typecheck and commit:

```bash
bun run typecheck
git add src/ui/components/sidebar.ts src/ui/theme.ts
git commit -m "feat(trip): new 行程 panel — mode, cities, search, along-route picks with reasons, days; mobile bottom sheet"
```

---

### Task 10: Browser verification

**Files:**
- Create (scratch, not committed): `$TMPDIR/pwscripts/trip2.mjs`

- [ ] **Step 1:** Make sure local data is complete: `bun run restore -- --target=local --confirm`. Start `bun run dev` if it isn't already serving `http://127.0.0.1:4343`.

- [ ] **Step 2:** Write the check script:

```js
// trip2.mjs — transit and drive, desktop and mobile. Usage: node trip2.mjs <outPrefix> [m|d]
import { chromium } from "/var/folders/t0/2qmkg0kj32v257jsyb4026280000gn/T/pwtools/node_modules/playwright/index.mjs"
const out = process.argv[2], dev = process.argv[3] || "d"
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] })
const ctx = await browser.newContext(dev === "m"
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1440, height: 900 } })
await ctx.addInitScript(() => {
  localStorage.setItem("mmTrip", JSON.stringify({ ids: ["gugong", "shaanxi"], order: "" }))   // old format → migration
  localStorage.setItem("museumAnonVisits", JSON.stringify([{ museumId: "yinxu", visitedAt: Date.now() }, { museumId: "erlitou", visitedAt: Date.now() }]))
  localStorage.setItem("museumChatWelcomed", "1"); localStorage.setItem("mmTheme", "paper")
})
const page = await ctx.newPage(), logs = []
page.on("pageerror", (e) => logs.push("PAGEERROR " + e))
page.on("console", (m) => { if (m.type() === "error" && !/401/.test(m.text())) logs.push(m.text()) })
await page.goto("http://127.0.0.1:4343/", { waitUntil: "domcontentloaded" })
await page.waitForTimeout(3500)
await page.locator(".tb-trip").first().click()
await page.waitForTimeout(1200)
const st = () => page.evaluate(() => { const d = Alpine.$data(document.querySelector("[x-data]")); const v = d.tripAlong(); return { title: d.tripTitle(), mode: d.trip.mode, picks: d.trip.picks.length, groups: v.groups.map((g) => g.title + ":" + g.stops.length), theme: d.tripTheme().replace(/<[^>]+>/g, "") } })
console.log("migrated:", JSON.stringify(await st()))
// Add 洛阳 between them via search.
await page.fill(".trip-search", "洛阳"); await page.waitForTimeout(1500)
await page.locator(".trip-suggest button").first().click(); await page.waitForTimeout(500)
await page.evaluate(() => { const d = Alpine.$data(document.querySelector("[x-data]")); d.tripMoveCity(2, -1) })
await page.waitForTimeout(800)
console.log("transit:", JSON.stringify(await st()))
await page.screenshot({ path: out + "-transit.png" })
// Drive.
await page.locator(".trip-mode .seg-btn").nth(1).click(); await page.waitForTimeout(6000)
console.log("drive:", JSON.stringify(await st()), "route:", await page.evaluate(() => { const r = Alpine.$data(document.querySelector("[x-data]")).trip.route; return r ? r.provider + " " + r.km + "km " + r.line.length + "pts" : "none" }))
await page.screenshot({ path: out + "-drive.png" })
// Pick the first recommendation; days appear.
await page.locator(".trip-pick:not(.on) .trip-check").first().click(); await page.waitForTimeout(500)
console.log("days:", await page.evaluate(() => JSON.stringify(Alpine.$data(document.querySelector("[x-data]")).tripDays())))
console.log(logs.slice(0, 6).join(" | ") || "no errors")
await browser.close()
```

- [ ] **Step 3:** Run desktop and mobile:

```bash
node /var/folders/t0/2qmkg0kj32v257jsyb4026280000gn/T/pwscripts/trip2.mjs /var/folders/t0/2qmkg0kj32v257jsyb4026280000gn/T/shots/trip2-d d
node /var/folders/t0/2qmkg0kj32v257jsyb4026280000gn/T/pwscripts/trip2.mjs /var/folders/t0/2qmkg0kj32v257jsyb4026280000gn/T/shots/trip2-m m
```

Expected:
- `migrated`: title `北京 → 西安`, mode transit, picks 2, two city groups with stops.
- `transit`: title `北京 → 洛阳 → 西安`, three groups, a theme line.
- `drive`: route `osrm …km …pts` (or `line` if OSRM is unreachable — still renders), two leg groups `北京 → 洛阳`, `洛阳 → 西安` with stops along the way.
- `days`: a non-empty plan.
- `no errors`.

Read both screenshots: the route line and city stops are visible; on mobile the panel is a bottom sheet with the map above it; nothing overlaps the search input.

- [ ] **Step 4:** Full test run (twice, because the first run after a restore shows 2 extra 64-museum failures), then restore:

```bash
bun test > /dev/null 2>&1; bun test 2>&1 | grep -E "\(fail\)|^\s*[0-9]+ (pass|fail)"
bun run restore -- --target=local --confirm
```
Expected: only the 2 known `image-enricher` failures.

- [ ] **Step 5:** Deploy the preview and commit any fixes:

```bash
bunx wrangler deploy --name museum-map-preview --domains museum-preview.xianliao.de5.net
```

---

## Self-review notes

- Spec §3 (input both modes, search, map tap, known cities) → Tasks 1, 3, 4, 7, 8, 9.
- Spec §4 (OSRM + straight fallback, KV cache, WGS→GCJ for drawing) → Tasks 2, 3, 8; no navigation, no 高德 (decided 2026-11-15).
- Spec §5 (corridor/city radius, reason tags 必看/补空层/接得上/原址/顺路, ordering, history line) → Tasks 5, 7, 9.
- Spec §6 (pick, warn > 2–3 a day, days, AI prompt, transit hints) → Tasks 5, 7, 9. Navigation removed per decision.
- Spec §7 (trip v2, migration, `/api/route`) → Tasks 3, 5, 7.
- Spec §8 (mobile bottom sheet, 16px input) → Task 9.
- Spec §9 ledger 沿行程 anchor → Task 7 Step 5.
- Deviations from the spec, deliberate: no static 340-city table — cities come from museum cities (local, instant) plus Nominatim search/reverse (any city, cached); pinyin search works only for museum cities via existing `pinyin` fields if added later. Bottom sheet has one height (62dvh) rather than three; revisit after use.
- Names used consistently: `TripCore.{km, lineKm, along, stopsAlong, stopsNearCities, score, transitHint, splitDays, longestRun, migrate}`; app: `tripAlong, tripTheme, tripDays, tripTags, tripHeldEras, tripLine, tripRouteKey, tripFetchRoute, tripHopLabel, tripTitle, tripKnownCities, tripSearch, tripAddCity, tripAddFirst, tripRemoveCity, tripMoveCity, tripSetDays, tripSetMode, tripSetRadius, tripRadii, tripMapClick, tripPicksOutside, toggleTrip, inTrip`; map: `setTripLine, askCity, onMapClick`.
