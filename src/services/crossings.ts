// 「此地即彼时」— where a museum stands on ground a dynasty itself stood on.
// A museum "crosses" a dynasty when it is close to one of that dynasty's capitals /
// cultural centres (DYNASTY_GEO) or to the location of one of its recorded events.
//
//   on-site  (≤ 5 km to a capital/site, ≤ 3 km to an event): counted for any dynasty
//   same area (≤ 30 km / ≤ 12 km): only for dynasties already linked to the museum,
//            so the 40-odd Beijing museums don't all claim every dynasty that touched Beijing.

import type { DynastyFull, MuseumListItem } from "~/repo/types"
import { DYNASTY_GEO } from "~/data/dynasty-geo"

export interface Crossing {
  dynastyId: string
  /** site name ("洛阳（北魏）") or the event text */
  place: string
  kind: "capital" | "site" | "event"
  /** event date, for kind === "event" */
  date?: string
  km: number
  onSite: boolean
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function computeCrossings(
  museums: Pick<MuseumListItem, "id" | "lat" | "lng">[],
  dynasties: DynastyFull[],
): Record<string, Crossing[]> {
  const linked: Record<string, Set<string>> = {}
  for (const d of dynasties) {
    for (const r of [...(d.recommendedMuseums || []), ...(d.relatedMuseums || [])]) {
      if (!r.museumId) continue
      ;(linked[r.museumId] ??= new Set()).add(d.id)
    }
  }
  const out: Record<string, Crossing[]> = {}
  for (const m of museums) {
    if (!m.lat || !m.lng) continue
    const found: Crossing[] = []
    for (const d of dynasties) {
      const isLinked = !!linked[m.id]?.has(d.id)
      let best: Crossing | null = null
      for (const s of DYNASTY_GEO[d.id]?.sites ?? []) {
        const km = haversineKm(m.lat, m.lng, s.lat, s.lng)
        if (km > (isLinked ? 30 : 5)) continue
        if (!best || km < best.km) {
          best = { dynastyId: d.id, place: s.name, kind: s.role === "culture" ? "site" : "capital", km, onSite: km <= 5 }
        }
      }
      for (const e of d.events || []) {
        if (e.lat == null || e.lng == null) continue
        const km = haversineKm(m.lat, m.lng, e.lat, e.lng)
        if (km > (isLinked ? 12 : 3)) continue
        // A capital match reads better than an event a few km closer.
        if (!best || (best.kind === "event" && km < best.km) || (best.kind !== "event" && km + 2 < best.km && !best.onSite)) {
          best = { dynastyId: d.id, place: e.event, kind: "event", date: e.date, km, onSite: km <= 3 }
        }
      }
      if (best) found.push({ ...best, km: Math.round(best.km * 10) / 10 })
    }
    if (found.length) {
      found.sort((a, b) => Number(b.onSite) - Number(a.onSite) || a.km - b.km)
      out[m.id] = found
    }
  }
  return out
}
