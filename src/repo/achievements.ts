export interface Unlock { r: number; c: number }

export class AchievementsRepo {
  constructor(private db: D1Database) {}

  async list(userId: string): Promise<Record<string, Unlock>> {
    const { results } = await this.db
      .prepare("SELECT achievement_id AS id, reached_at AS r, completed_at AS c FROM user_achievements WHERE user_id = ?")
      .bind(userId).all<{ id: string; r: number; c: number | null }>()
    const out: Record<string, Unlock> = {}
    for (const row of results) out[row.id] = { r: row.r, c: row.c ?? 0 }
    return out
  }

  /** Keeps the earliest times; never clears completed_at. */
  async upsert(userId: string, items: { id: string; r: number; c: number }[]): Promise<void> {
    if (!items.length) return
    const stmt = this.db.prepare(
      `INSERT INTO user_achievements (user_id, achievement_id, reached_at, completed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, achievement_id) DO UPDATE SET
         reached_at = MIN(reached_at, excluded.reached_at),
         completed_at = CASE
           WHEN completed_at IS NULL THEN excluded.completed_at
           WHEN excluded.completed_at IS NULL THEN completed_at
           ELSE MIN(completed_at, excluded.completed_at) END`,
    )
    await this.db.batch(items.map((i) => stmt.bind(userId, i.id, i.r, i.c || null)))
  }
}
