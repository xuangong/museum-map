// src/services/auth.ts
import { UsersRepo, type UserRow } from "~/repo/users"
import { SessionsRepo, type SessionRow } from "~/repo/sessions"
import { InvitesRepo } from "~/repo/invites"
import { hashPassword, verifyPassword } from "~/lib/crypto"
import { normalizeEmail } from "~/lib/email-norm"

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const MIN_PASSWORD_LENGTH = 8

export interface AuthResult {
  user: UserRow
  session: SessionRow
}

export class AuthService {
  private users: UsersRepo
  private sessions: SessionsRepo
  private invites: InvitesRepo
  constructor(private db: D1Database) {
    this.users = new UsersRepo(db)
    this.sessions = new SessionsRepo(db)
    this.invites = new InvitesRepo(db)
  }

  async register(opts: {
    email: string
    password: string
    displayName?: string
    inviteCode?: string
    userAgent?: string
    ip?: string
  }): Promise<AuthResult> {
    const email = (opts.email || "").trim().toLowerCase()
    const norm = normalizeEmail(email)
    if (!norm) throw new Error("invalid_email")
    if (!opts.password || opts.password.length < MIN_PASSWORD_LENGTH) throw new Error("weak_password")
    const existing = await this.users.findByEmail(email)
    if (existing) throw new Error("email_taken")
    const isFirst = (await this.users.countAll()) === 0
    let invite = null as Awaited<ReturnType<InvitesRepo["findByCode"]>>
    if (!isFirst) {
      const code = (opts.inviteCode || "").trim()
      if (!code) throw new Error("invite_required")
      invite = await this.invites.findByCode(code)
      if (!invite) throw new Error("invite_invalid")
      if (invite.used_at) throw new Error("invite_used")
      if (invite.expires_at && invite.expires_at < Date.now()) throw new Error("invite_expired")
    }
    const user = await this.users.create({
      email,
      emailNormalized: norm,
      passwordHash: hashPassword(opts.password),
      displayName: opts.displayName ?? null,
      isAdmin: isFirst,
    })
    if (invite) {
      const consumed = await this.invites.markUsed(invite.code, user.id)
      if (!consumed) throw new Error("invite_used")
    }
    await this.users.touchLogin(user.id)
    const session = await this.sessions.create({
      userId: user.id,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      ttlSeconds: SESSION_TTL_SECONDS,
    })
    return { user: { ...user, is_admin: isFirst ? 1 : 0 }, session }
  }

  async login(opts: {
    email: string
    password: string
    userAgent?: string
    ip?: string
  }): Promise<AuthResult> {
    const email = (opts.email || "").trim().toLowerCase()
    const user = await this.users.findByEmail(email)
    if (!user || !user.password_hash) throw new Error("invalid_credentials")
    if (!verifyPassword(opts.password, user.password_hash)) throw new Error("invalid_credentials")
    await this.users.touchLogin(user.id)
    const session = await this.sessions.create({
      userId: user.id,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      ttlSeconds: SESSION_TTL_SECONDS,
    })
    return { user, session }
  }

  async loginOrCreateGoogle(opts: {
    sub: string
    email: string
    name?: string
    picture?: string
    userAgent?: string
    ip?: string
  }): Promise<AuthResult> {
    const email = (opts.email || "").trim().toLowerCase()
    const norm = normalizeEmail(email) || email
    let user = await this.users.findByGoogleSub(opts.sub)
    if (!user) {
      const byEmail = await this.users.findByEmailNormalized(norm)
      if (byEmail) {
        await this.users.setGoogleSub(byEmail.id, opts.sub)
        user = (await this.users.findById(byEmail.id))!
      } else {
        const isFirst = (await this.users.countAll()) === 0
        user = await this.users.create({
          email,
          emailNormalized: norm,
          googleSub: opts.sub,
          displayName: opts.name ?? null,
          avatarUrl: opts.picture ?? null,
          isAdmin: isFirst,
        })
      }
    }
    await this.users.touchLogin(user.id)
    const session = await this.sessions.create({
      userId: user.id,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      ttlSeconds: SESSION_TTL_SECONDS,
    })
    return { user, session }
  }

  async logout(sessionId: string): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId)
  }

  async mergeAnonymous(
    userId: string,
    visits: Array<{ museumId: string; visitedAt: number; note?: string }>,
  ): Promise<number> {
    if (!Array.isArray(visits) || visits.length === 0) return 0
    let merged = 0
    for (const v of visits) {
      if (!v || typeof v.museumId !== "string" || typeof v.visitedAt !== "number") continue
      const r = await this.db
        .prepare(
          "INSERT INTO visits (user_id, museum_id, visited_at, note) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, museum_id) DO NOTHING",
        )
        .bind(userId, v.museumId, v.visitedAt, typeof v.note === "string" ? v.note.slice(0, 500) : null)
        .run()
      if ((r.meta?.changes ?? 0) > 0) merged += 1
    }
    return merged
  }
}
