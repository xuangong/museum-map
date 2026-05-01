export interface PendingRow {
  id: string
  query: string
  payload: string
  provenance: string | null
  status: string
  created_at: number
  reviewed_at: number | null
  notes: string | null
}

export interface PendingInsert {
  id: string
  query: string
  payload: unknown
  provenance?: unknown
  createdAt?: number
}

export class MuseumsPendingRepo {
  constructor(private db: D1Database) {}

  async insert(row: PendingInsert): Promise<void> {
    const createdAt = row.createdAt ?? Date.now()
    await this.db
      .prepare(
        "INSERT INTO museums_pending (id, query, payload, provenance, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      )
      .bind(
        row.id,
        row.query,
        JSON.stringify(row.payload),
        row.provenance ? JSON.stringify(row.provenance) : null,
        createdAt,
      )
      .run()
  }

  async updateStatus(id: string, status: "approved" | "rejected", notes?: string): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE museums_pending SET status = ?, reviewed_at = ?, notes = ? WHERE id = ?")
      .bind(status, Date.now(), notes ?? null, id)
      .run()
    return (r.meta?.changes ?? 0) > 0
  }

  async delete(id: string): Promise<boolean> {
    const r = await this.db.prepare("DELETE FROM museums_pending WHERE id = ?").bind(id).run()
    return (r.meta?.changes ?? 0) > 0
  }

  async list(status?: string): Promise<PendingRow[]> {
    const stmt = status
      ? this.db.prepare("SELECT * FROM museums_pending WHERE status = ? ORDER BY created_at DESC").bind(status)
      : this.db.prepare("SELECT * FROM museums_pending ORDER BY created_at DESC")
    const { results } = await stmt.all<PendingRow>()
    return results
  }

  async get(id: string): Promise<PendingRow | null> {
    return await this.db.prepare("SELECT * FROM museums_pending WHERE id = ?").bind(id).first<PendingRow>()
  }
}
