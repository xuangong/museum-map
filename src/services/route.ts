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
  const last = pts[pts.length - 1] as T
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

const round1 = (x: number) => Math.round(x * 10) / 10

function straight(pts: LatLng[]): Route {
  const legs = pts.slice(1).map((p, i) => ({ km: Math.round(kmBetween(pts[i] as LatLng, p)), h: null }))
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
    try { await env.RATE.put(key, JSON.stringify(out), { expirationTtl: 30 * 86400 }) } catch {}
    return out
  } catch {
    return straight(pts)
  }
}
