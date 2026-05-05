export interface ReviewCacheRow {
  user_id: string
  summary: string
  visit_count: number
  with_chat_context: number
  generated_at: number
}

export class ReviewCacheRepo {
  constructor(private db: D1Database) {}

  async get(userId: string): Promise<ReviewCacheRow | null> {
    const r = await this.db
      .prepare("SELECT * FROM review_cache WHERE user_id = ?")
      .bind(userId)
      .first<ReviewCacheRow>()
    return r ?? null
  }

  async save(userId: string, summary: string, visitCount: number, withChatContext: boolean, at?: number): Promise<void> {
    const ts = at ?? Date.now()
    await this.db
      .prepare(
        "INSERT INTO review_cache (user_id, summary, visit_count, with_chat_context, generated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET summary = excluded.summary, visit_count = excluded.visit_count, with_chat_context = excluded.with_chat_context, generated_at = excluded.generated_at",
      )
      .bind(userId, summary, visitCount, withChatContext ? 1 : 0, ts)
      .run()
  }

  async clear(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM review_cache WHERE user_id = ?").bind(userId).run()
  }
}
