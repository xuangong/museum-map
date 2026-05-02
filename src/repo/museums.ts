import type { MuseumFull, MuseumListItem } from "./types"
import type { MuseumPayload } from "~/services/import-schema"

/**
 * Coerce a possibly-non-array field into an array.
 * The import LLM occasionally emits list fields as JSON-encoded strings
 * instead of arrays; this normalises them safely.
 */
function asArr<T = any>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[]
  if (typeof v === "string") {
    const tryParse = (s: string): T[] | null => {
      try {
        const p = JSON.parse(s)
        return Array.isArray(p) ? (p as T[]) : null
      } catch {
        return null
      }
    }
    const direct = tryParse(v)
    if (direct) return direct
    // Repair: LLM sometimes emits JSON-encoded array with unescaped " around
    // Chinese inner quotes (e.g. "..."青铜史书"之称"...). Convert any " flanked
    // by CJK chars into the curly variant " so JSON.parse succeeds.
    const repaired = v.replace(/(?<=[\u4e00-\u9fff])"(?=[\u4e00-\u9fff])/g, "\u201d")
    const r = tryParse(repaired)
    if (r) return r
    return []
  }
  return []
}

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
        .prepare(
          "SELECT name, period, description, image_url AS image, image_license AS imageLicense, image_attribution AS imageAttribution FROM museum_artifacts WHERE museum_id = ? ORDER BY order_index",
        )
        .bind(id)
        .all<{
          name: string
          period: string | null
          description: string | null
          image: string | null
          imageLicense: string | null
          imageAttribution: string | null
        }>(),
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

  /** Build the prepared statements that wipe + re-insert a museum and its child rows.
   * Exposed so callers can include them in a wider db.batch (e.g. atomic with provenance). */
  buildUpsertStatements(id: string, p: MuseumPayload): D1PreparedStatement[] {
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
    ;(asArr(p.treasures)).forEach((name, i) => {
      stmts.push(this.db.prepare("INSERT INTO museum_treasures (museum_id, order_index, name) VALUES (?, ?, ?)").bind(id, i, name))
    })
    ;(asArr(p.halls)).forEach((name, i) => {
      stmts.push(this.db.prepare("INSERT INTO museum_halls (museum_id, order_index, name) VALUES (?, ?, ?)").bind(id, i, name))
    })
    ;(asArr(p.artifacts)).forEach((a, i) => {
      stmts.push(
        this.db
          .prepare(
            "INSERT INTO museum_artifacts (museum_id, order_index, name, period, description, image_url, image_license, image_attribution) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            id,
            i,
            a.name,
            a.period ?? null,
            a.description ?? null,
            a.image ?? null,
            a.imageLicense ?? null,
            a.imageAttribution ?? null,
          ),
      )
    })
    ;(asArr(p.dynastyConnections)).forEach((c, i) => {
      stmts.push(
        this.db
          .prepare("INSERT INTO museum_dynasty_connections (museum_id, order_index, dynasty, description) VALUES (?, ?, ?, ?)")
          .bind(id, i, c.dynasty, c.description ?? null),
      )
    })
    ;(asArr(p.sources)).forEach((src, i) => {
      stmts.push(this.db.prepare("INSERT INTO museum_sources (museum_id, order_index, source) VALUES (?, ?, ?)").bind(id, i, src))
    })
    return stmts
  }

  /** Publish a payload to the live museums tables. Replaces existing rows for the same id. */
  async upsert(id: string, p: MuseumPayload): Promise<void> {
    await this.db.batch(this.buildUpsertStatements(id, p))
  }
}
