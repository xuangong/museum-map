import { Elysia } from "elysia"
import { parseCookies } from "~/lib/cookies"
import { SessionsRepo } from "~/repo/sessions"
import { UsersRepo, type UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"
import type { Env } from "~/index"

export interface SessionContext {
  user: UserRow | null
  session: SessionRow | null
}

export const sessionMiddleware = new Elysia({ name: "session" }).derive(
  { as: "global" },
  async ({ request }: { request: Request }): Promise<Record<string, any>> => {
    const env = (globalThis as any).__env as Env | undefined
    if (!env) return { user: null, session: null }
    const sid = parseCookies(request.headers.get("cookie"))["sid"]
    if (!sid) return { user: null, session: null }
    const sessions = new SessionsRepo(env.DB)
    const session = await sessions.get(sid)
    if (!session) return { user: null, session: null }
    const users = new UsersRepo(env.DB)
    const user = await users.findById(session.user_id)
    if (!user) return { user: null, session: null }
    sessions.touch(sid).catch(() => {})
    return { user, session }
  },
)

export function requireUser(ctx: { user: UserRow | null; set: any }): UserRow | null {
  if (!ctx.user) {
    ctx.set.status = 401
    return null
  }
  return ctx.user
}

export function requireAdmin(ctx: { user: UserRow | null; set: any; request?: Request; env?: any }): UserRow | null {
  // Token-based admin escape hatch for scripts/CI: x-admin-token header must
  // match env.ADMIN_TOKEN. Returns a synthetic admin user view.
  const env = (ctx as any).env
  const req = (ctx as any).request as Request | undefined
  if (env?.ADMIN_TOKEN && req) {
    const tok = req.headers.get("x-admin-token") || ""
    if (tok && tok === env.ADMIN_TOKEN) {
      return {
        id: "__token_admin__",
        email: null,
        display_name: "Token Admin",
        avatar_url: null,
        is_admin: 1,
        handle: null,
        handle_changed_at: null,
        show_on_plaza: 0,
        created_at: 0,
        last_login_at: null,
      } as unknown as UserRow
    }
  }
  const u = requireUser(ctx)
  if (!u) return null
  if (u.is_admin !== 1) {
    ctx.set.status = 403
    return null
  }
  return u
}
