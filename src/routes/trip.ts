// src/routes/trip.ts
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { searchCity, reverseCity } from "~/services/geocode"
import { getClientIp } from "~/lib/getClientIp"
import { checkAndIncrement, bucketKey } from "~/lib/rateLimit"
import { routeThrough, type LatLng } from "~/services/route"

interface Ctx { env: Env; query: any; set: any; request: Request }

const tooMany = () => new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers: { "content-type": "application/json" } })
/** 60 requests/min per IP across the trip endpoints; a KV hiccup never blocks the request. */
async function limited(c: Ctx): Promise<boolean> {
  try {
    const ip = getClientIp(c.request) || "unknown"
    const r = await checkAndIncrement(c.env.RATE, "trip:" + bucketKey("min", ip), 60, 90)
    return !r.ok
  } catch { return false }
}

const inChina = (p: LatLng) => p.lat > 3 && p.lat < 54 && p.lng > 73 && p.lng < 136
const bad = (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400, headers: { "content-type": "application/json" } })

export const tripRoute = new Elysia()
  .get("/api/geocode", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (await limited(c)) return tooMany()
    const q = String(c.query?.q || "").trim()
    if (!q) return Response.json([])
    try { return Response.json(await searchCity(c.env, q)) }
    catch { return new Response(JSON.stringify({ error: "geocode unavailable" }), { status: 502, headers: { "content-type": "application/json" } }) }
  })
  .get("/api/geocode/reverse", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (await limited(c)) return tooMany()
    const p = { lat: Number(c.query?.lat), lng: Number(c.query?.lng) }
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inChina(p)) return bad("lat/lng required")
    try { return Response.json(await reverseCity(c.env, p.lat, p.lng)) }
    catch { return new Response(JSON.stringify({ error: "geocode unavailable" }), { status: 502, headers: { "content-type": "application/json" } }) }
  })
  .get("/api/route", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (await limited(c)) return tooMany()
    const pts = String(c.query?.pts || "").split(";").filter(Boolean).map((s) => {
      const parts = s.split(",")
      const [lat, lng] = parts.length === 2 ? parts.map(Number) : [NaN, NaN]
      return { lat: lat as number, lng: lng as number }
    })
    if (pts.length < 2 || pts.length > 12 || pts.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !inChina(p))) {
      return bad("pts=lat,lng;lat,lng (2–12 points in China)")
    }
    return Response.json(await routeThrough(c.env, pts))
  })
