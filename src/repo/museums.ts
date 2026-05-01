import type { MuseumFull, MuseumListItem } from "./types"
import type { MuseumPayload } from "~/services/import-schema"

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

  /** Publish a payload to the live museums tables. Replaces existing rows for the same id. */
  async upsert(id: string, p: MuseumPayload): Promise<void> {
    const stmts: D1PreparedStatement[] = []
    // Wipe child rows (if museum already exists) — FK CASCADE handles them via delete, but we
    // need an upsert path that keeps the id stable. Easier: delete + insert.
    stmts.push(this.db.prepare("DELETE FROM museums WHERE id = ?").bind(id))
    stmts.push(
      this.db
        .prepare(
          "INSERT INTO museums (id, name, lat, lng, location, level, core_period, specialty, dynasty_coverage, timeline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id, p.name, p.lat, p.lng, p.location ?? null, p.level ?? null, p.corePeriod ?? null, p.specialty ?? null, p.dynastyCoverage ?? null, p.timeline ?? null),
    )
    ;(p.treasures ?? []).forEach((name, i) => {
      stmts.push(this.db.prepare("INSERT INTO museum_treasures (museum_id, order_index, name) VALUES (?, ?, ?)").bind(id, i, name))
    })
    ;(p.halls ?? []).forEach((name, i) => {
      stmts.push(this.db.prepare("INSERT INTO museum_halls (museum_id, order_index, name) VALUES (?, ?, ?)").bind(id, i, name))
    })
    ;(p.artifacts ?? []).forEach((a, i) => {
      stmts.push(
        this.db
          .prepare("INSERT INTO museum_artifacts (museum_id, order_index, name, period, description) VALUES (?, ?, ?, ?, ?)")
          .bind(id, i, a.name, a.period ?? null, a.description ?? null),
      )
    })
    ;(p.dynastyConnections ?? []).forEach((c, i) => {
      stmts.push(
        this.db
          .prepare("INSERT INTO museum_dynasty_connections (museum_id, order_index, dynasty, description) VALUES (?, ?, ?, ?)")
          .bind(id, i, c.dynasty, c.description ?? null),
      )
    })
    ;(p.sources ?? []).forEach((src, i) => {
      stmts.push(this.db.prepare("INSERT INTO museum_sources (museum_id, order_index, source) VALUES (?, ?, ?)").bind(id, i, src))
    })
    await this.db.batch(stmts)
  }
}
