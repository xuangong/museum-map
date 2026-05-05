import { generateToken } from "~/lib/crypto"

export interface InviteRow {
  code: string
  created_by: string
  created_at: number
  expires_at: number | null
  used_at: number | null
  used_by_user_id: string | null
  note: string | null
}

export class InvitesRepo {
  constructor(private db: D1Database) {}

  async create(opts: {
    createdBy: string
    expiresAt?: number | null
    note?: string | null
  }): Promise<InviteRow> {
    const code = generateToken(16)
    const now = Date.now()
    await this.db
      .prepare(
        "INSERT INTO invites (code, created_by, created_at, expires_at, used_at, used_by_user_id, note) VALUES (?, ?, ?, ?, NULL, NULL, ?)",
      )
      .bind(code, opts.createdBy, now, opts.expiresAt ?? null, opts.note ?? null)
      .run()
    const r = await this.findByCode(code)
    if (!r) throw new Error("invite create failed")
    return r
  }

  async findByCode(code: string): Promise<InviteRow | null> {
    const r = await this.db
      .prepare("SELECT * FROM invites WHERE code = ?")
      .bind(code)
      .first<InviteRow>()
    return r ?? null
  }

  async markUsed(code: string, userId: string): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE invites SET used_at = ?, used_by_user_id = ? WHERE code = ? AND used_at IS NULL")
      .bind(Date.now(), userId, code)
      .run()
    return (r.meta?.changes ?? 0) > 0
  }

  async listRecent(limit = 50): Promise<InviteRow[]> {
    const r = await this.db
      .prepare("SELECT * FROM invites ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all<InviteRow>()
    return r.results ?? []
  }

  async revoke(code: string): Promise<boolean> {
    const r = await this.db
      .prepare("DELETE FROM invites WHERE code = ? AND used_at IS NULL")
      .bind(code)
      .run()
    return (r.meta?.changes ?? 0) > 0
  }
}
