import { generateToken } from "~/lib/crypto"

export interface SessionRow {
  id: string
  user_id: string
  created_at: number
  expires_at: number
  last_seen_at: number
  user_agent: string | null
  ip: string | null
}

export class SessionsRepo {
  constructor(private db: D1Database) {}

  async create(opts: {
    userId: string
    userAgent?: string | null
    ip?: string | null
    ttlSeconds: number
  }): Promise<SessionRow> {
    const id = generateToken(32)
    const now = Date.now()
    const expires = now + opts.ttlSeconds * 1000
    await this.db
      .prepare(
        "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, opts.userId, now, expires, now, opts.userAgent ?? null, opts.ip ?? null)
      .run()
    return {
      id,
      user_id: opts.userId,
      created_at: now,
      expires_at: expires,
      last_seen_at: now,
      user_agent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
    }
  }

  async get(id: string): Promise<SessionRow | null> {
    if (!id) return null
    const r = await this.db
      .prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > ?")
      .bind(id, Date.now())
      .first<SessionRow>()
    return r ?? null
  }

  async touch(id: string): Promise<void> {
    await this.db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(Date.now(), id).run()
  }

  async revoke(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run()
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run()
  }

  async sweepExpired(): Promise<number> {
    const r = await this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now()).run()
    return r.meta?.changes ?? 0
  }
}
