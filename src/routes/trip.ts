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
