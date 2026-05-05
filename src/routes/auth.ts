import { Elysia } from "elysia"
import type { Env } from "~/index"
import { AuthService } from "~/services/auth"
import { buildAuthUrl, exchangeCode } from "~/services/google-oauth"
import { generateToken } from "~/lib/crypto"
import { parseCookies, serializeCookie } from "~/lib/cookies"
import { sessionMiddleware, requireUser } from "~/middleware/session"
import { getClientIp } from "~/lib/getClientIp"
import { checkAndIncrement, bucketKey } from "~/lib/rateLimit"
import type { UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"

interface Ctx {
  env: Env
  request: Request
  body: any
  query: any
  set: any
  user: UserRow | null
  session: SessionRow | null
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30
const STATE_MAX_AGE = 600

function isSecure(req: Request): boolean {
  return new URL(req.url).protocol === "https:"
}

function originOk(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true
  const origin = req.headers.get("origin")
  if (!origin) return true
  try {
    const o = new URL(origin)
    const host = req.headers.get("host") || new URL(req.url).host
    return o.host === host
  } catch {
    return false
  }
}

function setSidCookie(set: any, sid: string, secure: boolean) {
  set.headers["set-cookie"] = serializeCookie("sid", sid, {
    httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: COOKIE_MAX_AGE,
  })
}

function clearSidCookie(set: any, secure: boolean) {
  set.headers["set-cookie"] = serializeCookie("sid", "", {
    httpOnly: true, secure, sameSite: "Lax", path: "/", maxAge: 0,
  })
}

function userView(u: UserRow) {
  return {
    id: u.id, email: u.email, displayName: u.display_name, avatarUrl: u.avatar_url, isAdmin: u.is_admin === 1,
  }
}

async function authRateLimit(env: Env, req: Request, set: any): Promise<boolean> {
  const ip = getClientIp(req) || "unknown"
  // 5 requests per minute per ip on auth endpoints
  const key = `auth:${bucketKey("min", ip)}`
  const r = await checkAndIncrement(env.RATE, key, 5, 60)
  if (!r.ok) {
    set.status = 429
    return false
  }
  return true
}

export const authRoute = new Elysia()
  .use(sessionMiddleware)
  .post("/auth/register", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    if (!(await authRateLimit(c.env, c.request, c.set))) return { error: "rate_limited" }
    try {
      const svc = new AuthService(c.env.DB)
      const r = await svc.register({
        email: String(c.body?.email ?? ""),
        password: String(c.body?.password ?? ""),
        displayName: typeof c.body?.displayName === "string" ? c.body.displayName.slice(0, 80) : undefined,
        userAgent: c.request.headers.get("user-agent") || undefined,
        ip: getClientIp(c.request) || undefined,
      })
      setSidCookie(c.set, r.session.id, isSecure(c.request))
      return { user: userView(r.user) }
    } catch (e: any) {
      const msg = e?.message || "error"
      if (msg === "email_taken") { c.set.status = 409; return { error: "email_taken" } }
      if (msg === "weak_password" || msg === "invalid_email") {
        c.set.status = 400; return { error: msg }
      }
      c.set.status = 500; return { error: "server_error" }
    }
  })
  .post("/auth/login", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    if (!(await authRateLimit(c.env, c.request, c.set))) return { error: "rate_limited" }
    try {
      const svc = new AuthService(c.env.DB)
      const r = await svc.login({
        email: String(c.body?.email ?? ""),
        password: String(c.body?.password ?? ""),
        userAgent: c.request.headers.get("user-agent") || undefined,
        ip: getClientIp(c.request) || undefined,
      })
      setSidCookie(c.set, r.session.id, isSecure(c.request))
      return { user: userView(r.user) }
    } catch {
      c.set.status = 401
      return { error: "invalid_credentials" }
    }
  })
  .post("/auth/logout", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    if (c.session) {
      const svc = new AuthService(c.env.DB)
      await svc.logout(c.session.id)
    }
    clearSidCookie(c.set, isSecure(c.request))
    c.set.status = 204
    return ""
  })
  .get("/auth/me", (ctx) => {
    const c = ctx as unknown as Ctx
    return { user: c.user ? userView(c.user) : null }
  })
  .get("/auth/google/start", (ctx) => {
    const c = ctx as unknown as Ctx
    const clientId = c.env.GOOGLE_CLIENT_ID
    const redirectUri = c.env.OAUTH_REDIRECT_URI
    if (!clientId || !redirectUri) { c.set.status = 503; return { error: "google_oauth_unconfigured" } }
    const state = generateToken(16)
    const url = buildAuthUrl({ clientId, redirectUri, state })
    c.set.headers["set-cookie"] = serializeCookie("oauth_state", state, {
      httpOnly: true, secure: isSecure(c.request), sameSite: "Lax", path: "/auth", maxAge: STATE_MAX_AGE,
    })
    c.set.status = 302
    c.set.headers["location"] = url
    return ""
  })
  .get("/auth/google/callback", async (ctx) => {
    const c = ctx as unknown as Ctx
    const clientId = c.env.GOOGLE_CLIENT_ID
    const secret = c.env.GOOGLE_CLIENT_SECRET
    const redirectUri = c.env.OAUTH_REDIRECT_URI
    if (!clientId || !secret || !redirectUri) { c.set.status = 503; return { error: "google_oauth_unconfigured" } }
    const cookies = parseCookies(c.request.headers.get("cookie"))
    const state = (c.query?.state as string) || ""
    if (!state || cookies["oauth_state"] !== state) { c.set.status = 400; return { error: "bad_state" } }
    const code = (c.query?.code as string) || ""
    if (!code) { c.set.status = 400; return { error: "missing_code" } }
    try {
      const gu = await exchangeCode({ code, clientId, clientSecret: secret, redirectUri })
      const svc = new AuthService(c.env.DB)
      const r = await svc.loginOrCreateGoogle({
        sub: gu.sub, email: gu.email, name: gu.name, picture: gu.picture,
        userAgent: c.request.headers.get("user-agent") || undefined,
        ip: getClientIp(c.request) || undefined,
      })
      const headers: Record<string, string> = {
        "set-cookie": serializeCookie("sid", r.session.id, {
          httpOnly: true, secure: isSecure(c.request), sameSite: "Lax", path: "/", maxAge: COOKIE_MAX_AGE,
        }),
        location: "/?logged_in=1",
      }
      c.set.status = 302
      Object.assign(c.set.headers, headers)
      return ""
    } catch {
      c.set.status = 502
      return { error: "google_login_failed" }
    }
  })
  .post("/auth/merge-anonymous", async (ctx) => {
    const c = ctx as unknown as Ctx
    if (!originOk(c.request)) { c.set.status = 403; return { error: "csrf" } }
    const u = requireUser(c)
    if (!u) return { error: "unauthorized" }
    const visits = Array.isArray(c.body?.visits) ? c.body.visits : []
    const svc = new AuthService(c.env.DB)
    const merged = await svc.mergeAnonymous(u.id, visits)
    return { merged }
  })
