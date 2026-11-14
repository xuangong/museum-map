export type ScrollKind = "tune" | "voyage" | "seal" | "scroll"
export interface ScrollRow { id: string; kind: ScrollKind; payload: any; userId: string | null; createdAt: number }

const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789"
export function newScrollId(): string {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return [...b].map((x) => ALPHA[x % ALPHA.length]).join("")
}

export class ScrollsRepo {
  constructor(private db: D1Database) {}

  async create(s: { kind: ScrollKind; payload: unknown; userId: string | null }): Promise<string> {
    for (let i = 0; i < 4; i++) {
      const id = newScrollId()
      const r = await this.db
        .prepare("INSERT OR IGNORE INTO share_scrolls (id, kind, payload, user_id, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, s.kind, JSON.stringify(s.payload), s.userId, Date.now()).run()
      if (r.meta.changes) return id
    }
    throw new Error("could not allocate scroll id")
  }

  async get(id: string): Promise<ScrollRow | null> {
    const row = await this.db.prepare("SELECT id, kind, payload, user_id, created_at FROM share_scrolls WHERE id = ?")
      .bind(id).first<{ id: string; kind: ScrollKind; payload: string; user_id: string | null; created_at: number }>()
    if (!row) return null
    return { id: row.id, kind: row.kind, payload: JSON.parse(row.payload), userId: row.user_id, createdAt: row.created_at }
  }

  async addGuan(scrollId: string, name: string | null): Promise<void> {
    await this.db.prepare("INSERT INTO share_guan (scroll_id, name, created_at) VALUES (?, ?, ?)")
      .bind(scrollId, name, Date.now()).run()
  }

  async listGuan(scrollId: string, limit: number): Promise<{ count: number; items: { name: string | null; at: number }[] }> {
    const [c, rows] = await Promise.all([
      this.db.prepare("SELECT COUNT(*) AS n FROM share_guan WHERE scroll_id = ?").bind(scrollId).first<{ n: number }>(),
      this.db.prepare("SELECT name, created_at AS at FROM share_guan WHERE scroll_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
        .bind(scrollId, limit).all<{ name: string | null; at: number }>(),
    ])
    return { count: c?.n ?? 0, items: rows.results }
  }
}
