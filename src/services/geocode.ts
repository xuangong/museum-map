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
  const key = "geo:v1:q:" + query
  const hit = (await env.RATE.get(key, "json")) as Place[] | null
  if (hit) return hit
  const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({
    q: query, countrycodes: "cn", format: "jsonv2", limit: "6", "accept-language": "zh-CN", addressdetails: "1",
  })
  const res = await f(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error("geocode upstream " + res.status)
  const rows = (await res.json()) as any[]
  const out: Place[] = rows
    .filter((r) => KINDS.has(r.addresstype))
    .map((r) => ({ name: String(r.name), lat: Number(r.lat), lng: Number(r.lon), province: province(r.address) }))
  try { await env.RATE.put(key, JSON.stringify(out), { expirationTtl: out.length ? TTL : 86400 }) } catch {}
  return out
}

export async function reverseCity(env: Env, lat: number, lng: number, f: Fetch = fetch): Promise<Place | null> {
  const key = "geo:v1:r:" + lat.toFixed(2) + "," + lng.toFixed(2)
  const hit = (await env.RATE.get(key, "json")) as Place | null
  if (hit) return hit
  const url = "https://nominatim.openstreetmap.org/reverse?" + new URLSearchParams({
    lat: String(lat), lon: String(lng), zoom: "10", format: "jsonv2", "accept-language": "zh-CN", addressdetails: "1",
  })
  const res = await f(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error("reverse upstream " + res.status)
  const r = (await res.json()) as any
  if (!r || r.error) return null
  const a = r.address || {}
  const name = a.city || a.county || a.town || a.municipality || r.name
  if (!name) return null
  const out: Place = { name: String(name), lat: Number(r.lat), lng: Number(r.lon), province: province(a) }
  try { await env.RATE.put(key, JSON.stringify(out), { expirationTtl: TTL }) } catch {}
  return out
}
