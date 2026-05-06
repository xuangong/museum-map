export interface DynastyReviewCacheRow {
  user_id: string
  dynasty_id: string
  summary: string
  visit_count: number
  generated_at: number
}

export class DynastyReviewCacheRepo {
  constructor(private db: D1Database) {}

  async get(dynastyId: string, userId: string): Promise<DynastyReviewCacheRow | null> {
    const r = await this.db
      .prepare("SELECT * FROM dynasty_review_cache WHERE user_id = ? AND dynasty_id = ?")
      .bind(userId, dynastyId)
      .first<DynastyReviewCacheRow>()
    return r ?? null
  }

  async listByUser(userId: string): Promise<DynastyReviewCacheRow[]> {
    const r = await this.db
      .prepare("SELECT * FROM dynasty_review_cache WHERE user_id = ?")
      .bind(userId)
      .all<DynastyReviewCacheRow>()
    return r.results ?? []
  }

  async save(dynastyId: string, userId: string, summary: string, visitCount: number, at?: number): Promise<void> {
    const ts = at ?? Date.now()
    await this.db
      .prepare(
        "INSERT INTO dynasty_review_cache (user_id, dynasty_id, summary, visit_count, generated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, dynasty_id) DO UPDATE SET summary = excluded.summary, visit_count = excluded.visit_count, generated_at = excluded.generated_at",
      )
      .bind(userId, dynastyId, summary, visitCount, ts)
      .run()
  }
}
