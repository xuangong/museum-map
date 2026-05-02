export interface FieldProvenanceRow {
  museum_id: string
  field_path: string
  source_url: string | null
  authority: string | null
  recorded_at: number
}

export type FieldProvenanceInput = Omit<FieldProvenanceRow, "museum_id">

export class FieldProvenanceRepo {
  constructor(private db: D1Database) {}

  async listFor(museumId: string): Promise<FieldProvenanceRow[]> {
    const { results } = await this.db
      .prepare(
        "SELECT museum_id, field_path, source_url, authority, recorded_at FROM field_provenance WHERE museum_id = ? ORDER BY field_path",
      )
      .bind(museumId)
      .all<FieldProvenanceRow>()
    return results
  }

  /** Build the prepared statements that wipe + insert provenance rows for a museum.
   * Caller should add these to a wider db.batch so the write is atomic with the
   * museum upsert. */
  buildReplaceStatements(museumId: string, rows: FieldProvenanceInput[]): D1PreparedStatement[] {
    const stmts: D1PreparedStatement[] = []
    stmts.push(this.db.prepare("DELETE FROM field_provenance WHERE museum_id = ?").bind(museumId))
    for (const r of rows) {
      stmts.push(
        this.db
          .prepare(
            "INSERT INTO field_provenance (museum_id, field_path, source_url, authority, recorded_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(museumId, r.field_path, r.source_url, r.authority, r.recorded_at),
      )
    }
    return stmts
  }

  async replaceAll(museumId: string, rows: FieldProvenanceInput[]): Promise<void> {
    await this.db.batch(this.buildReplaceStatements(museumId, rows))
  }

  async clear(museumId: string): Promise<void> {
    await this.db.prepare("DELETE FROM field_provenance WHERE museum_id = ?").bind(museumId).run()
  }
}
