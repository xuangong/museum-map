import type { DynastyCulture, DynastyEvent, DynastyFull, DynastyRecommendedMuseum } from "./types"

interface DynastyHeadRow {
  id: string
  name: string
  period: string | null
  centerLat: number | null
  centerLng: number | null
  overview: string | null
  orderIndex: number
}

export class DynastiesRepo {
  constructor(private db: D1Database) {}

  async listFull(): Promise<DynastyFull[]> {
    await this.db.prepare("PRAGMA foreign_keys = ON").run()
    const heads = await this.db
      .prepare(
        "SELECT id, name, period, center_lat AS centerLat, center_lng AS centerLng, overview, order_index AS orderIndex FROM dynasties ORDER BY order_index",
      )
      .all<DynastyHeadRow>()

    const [culture, events, recos] = await Promise.all([
      this.db
        .prepare("SELECT dynasty_id AS dynastyId, category, description FROM dynasty_culture ORDER BY dynasty_id, order_index")
        .all<{ dynastyId: string } & DynastyCulture>(),
      this.db
        .prepare("SELECT dynasty_id AS dynastyId, date, event, lat, lng FROM dynasty_events ORDER BY dynasty_id, order_index")
        .all<{ dynastyId: string } & DynastyEvent>(),
      this.db
        .prepare(
          "SELECT dynasty_id AS dynastyId, museum_id AS museumId, name, location, reason FROM dynasty_recommended_museums ORDER BY dynasty_id, order_index",
        )
        .all<{ dynastyId: string } & DynastyRecommendedMuseum>(),
    ])

    const cultureBy = groupBy(culture.results, "dynastyId")
    const eventsBy = groupBy(events.results, "dynastyId")
    const recosBy = groupBy(recos.results, "dynastyId")

    return heads.results.map((h) => ({
      id: h.id,
      name: h.name,
      period: h.period,
      center: { lat: h.centerLat, lng: h.centerLng },
      overview: h.overview,
      culture: (cultureBy.get(h.id) ?? []).map(({ dynastyId, ...rest }) => rest),
      events: (eventsBy.get(h.id) ?? []).map(({ dynastyId, ...rest }) => rest),
      recommendedMuseums: (recosBy.get(h.id) ?? []).map(({ dynastyId, ...rest }) => rest),
    }))
  }

  async get(id: string): Promise<DynastyFull | null> {
    const list = await this.listFull()
    return list.find((d) => d.id === id) ?? null
  }
}

function groupBy<T extends Record<K, string>, K extends string>(rows: T[], key: K): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const row of rows) {
    const k = row[key]
    const arr = m.get(k)
    if (arr) arr.push(row)
    else m.set(k, [row])
  }
  return m
}
