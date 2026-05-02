export interface VisitRow {
  user_id: string
  museum_id: string
  visited_at: number
  note: string | null
}

export class VisitsRepo {
  constructor(private db: D1Database) {}

  async list(userId = "me"): Promise<VisitRow[]> {
    const { results } = await this.db
      .prepare("SELECT * FROM visits WHERE user_id = ? ORDER BY visited_at DESC")
      .bind(userId)
      .all<VisitRow>()
    return results
  }

  async listIds(userId = "me"): Promise<string[]> {
    const rows = await this.list(userId)
    return rows.map((r) => r.museum_id)
  }

  async checkIn(museumId: string, userId = "me", note?: string, at?: number): Promise<void> {
    const ts = at ?? Date.now()
    await this.db
      .prepare(
        "INSERT INTO visits (user_id, museum_id, visited_at, note) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, museum_id) DO UPDATE SET visited_at = excluded.visited_at, note = excluded.note",
      )
      .bind(userId, museumId, ts, note ?? null)
      .run()
  }

  async remove(museumId: string, userId = "me"): Promise<boolean> {
    const r = await this.db
      .prepare("DELETE FROM visits WHERE user_id = ? AND museum_id = ?")
      .bind(userId, museumId)
      .run()
    return (r.meta?.changes ?? 0) > 0
  }
}
