import type { MuseumFull, MuseumListItem } from "./types"

export class MuseumsRepo {
  constructor(private db: D1Database) {}

  async list(): Promise<MuseumListItem[]> {
    await this.db.prepare("PRAGMA foreign_keys = ON").run()
    const { results } = await this.db
      .prepare(
        "SELECT id, name, lat, lng, level, core_period AS corePeriod, dynasty_coverage AS dynastyCoverage FROM museums ORDER BY id",
      )
      .all<MuseumListItem>()
    return results
  }

  async get(id: string): Promise<MuseumFull | null> {
    await this.db.prepare("PRAGMA foreign_keys = ON").run()
    const head = await this.db
      .prepare(
        "SELECT id, name, lat, lng, location, level, core_period AS corePeriod, specialty, dynasty_coverage AS dynastyCoverage, timeline FROM museums WHERE id = ?",
      )
      .bind(id)
      .first<Omit<MuseumFull, "treasures" | "halls" | "artifacts" | "dynastyConnections" | "sources">>()
    if (!head) return null

    const [treasures, halls, artifacts, conns, sources] = await Promise.all([
      this.db.prepare("SELECT name FROM museum_treasures WHERE museum_id = ? ORDER BY order_index").bind(id).all<{ name: string }>(),
      this.db.prepare("SELECT name FROM museum_halls WHERE museum_id = ? ORDER BY order_index").bind(id).all<{ name: string }>(),
      this.db
        .prepare("SELECT name, period, description FROM museum_artifacts WHERE museum_id = ? ORDER BY order_index")
        .bind(id)
        .all<{ name: string; period: string | null; description: string | null }>(),
      this.db
        .prepare("SELECT dynasty, description FROM museum_dynasty_connections WHERE museum_id = ? ORDER BY order_index")
        .bind(id)
        .all<{ dynasty: string; description: string | null }>(),
      this.db.prepare("SELECT source FROM museum_sources WHERE museum_id = ? ORDER BY order_index").bind(id).all<{ source: string }>(),
    ])

    return {
      ...head,
      treasures: treasures.results.map((r) => r.name),
      halls: halls.results.map((r) => r.name),
      artifacts: artifacts.results,
      dynastyConnections: conns.results,
      sources: sources.results.map((r) => r.source),
    }
  }
}
