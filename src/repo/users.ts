import { generateToken } from "~/lib/crypto"

export interface UserRow {
  id: string
  email: string
  email_normalized: string
  password_hash: string | null
  google_sub: string | null
  display_name: string | null
  avatar_url: string | null
  is_admin: number
  handle: string | null
  created_at: number
  last_login_at: number | null
}

function newUserId(): string {
  return generateToken(13)
}

export class UsersRepo {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<UserRow | null> {
    const r = await this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>()
    return r ?? null
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const r = await this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>()
    return r ?? null
  }

  async findByEmailNormalized(emailNorm: string): Promise<UserRow | null> {
    const r = await this.db
      .prepare("SELECT * FROM users WHERE email_normalized = ? LIMIT 1")
      .bind(emailNorm)
      .first<UserRow>()
    return r ?? null
  }

  async findByGoogleSub(sub: string): Promise<UserRow | null> {
    const r = await this.db
      .prepare("SELECT * FROM users WHERE google_sub = ?")
      .bind(sub)
      .first<UserRow>()
    return r ?? null
  }

  async create(opts: {
    email: string
    emailNormalized: string
    passwordHash?: string | null
    googleSub?: string | null
    displayName?: string | null
    avatarUrl?: string | null
    isAdmin?: boolean
  }): Promise<UserRow> {
    const id = newUserId()
    const now = Date.now()
    await this.db
      .prepare(
        "INSERT INTO users (id, email, email_normalized, password_hash, google_sub, display_name, avatar_url, is_admin, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        opts.email,
        opts.emailNormalized,
        opts.passwordHash ?? null,
        opts.googleSub ?? null,
        opts.displayName ?? null,
        opts.avatarUrl ?? null,
        opts.isAdmin ? 1 : 0,
        now,
        null,
      )
      .run()
    const created = await this.findById(id)
    if (!created) throw new Error("user create failed")
    return created
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, id).run()
  }

  async setGoogleSub(id: string, sub: string): Promise<void> {
    await this.db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").bind(sub, id).run()
  }

  async setAdmin(id: string, isAdmin: boolean): Promise<void> {
    await this.db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").bind(isAdmin ? 1 : 0, id).run()
  }

  async setDisplayName(id: string, displayName: string | null): Promise<void> {
    await this.db.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(displayName, id).run()
  }

  async findByHandle(handle: string): Promise<UserRow | null> {
    const r = await this.db.prepare("SELECT * FROM users WHERE handle = ?").bind(handle).first<UserRow>()
    return r ?? null
  }

  async setHandle(id: string, handle: string): Promise<void> {
    await this.db.prepare("UPDATE users SET handle = ? WHERE id = ?").bind(handle, id).run()
  }

  async touchLogin(id: string): Promise<void> {
    await this.db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(Date.now(), id).run()
  }

  async countAll(): Promise<number> {
    const r = await this.db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>()
    return r?.n ?? 0
  }
}
