import { Elysia } from "elysia"
import type { Env } from "~/index"
import { UsersRepo } from "~/repo/users"
import { VisitsRepo } from "~/repo/visits"
import { ReviewCacheRepo } from "~/repo/review-cache"
import { DynastyReviewCacheRepo } from "~/repo/dynasty-review-cache"
import { MuseumsRepo } from "~/repo/museums"
import { DynastiesRepo } from "~/repo/dynasties"
import { HomePage, ErrorPage } from "~/ui/home"
import { ProfilePage } from "~/ui/profile"
import { sessionMiddleware } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"

interface Ctx {
  env: Env
  params: { handle: string }
  set: any
  user: UserRow | null
  session: SessionRow | null
}

async function loadProfile(env: Env, handle: string) {
  const users = new UsersRepo(env.DB)
  const u = await users.findByHandle(handle)
  if (!u) return null
  const visits = new VisitsRepo(env.DB)
  const reviewCache = new ReviewCacheRepo(env.DB)
  const dynastyReviews = new DynastyReviewCacheRepo(env.DB)
  const [items, review, dynastyRows] = await Promise.all([
    visits.list(u.id),
    reviewCache.get(u.id),
    dynastyReviews.listByUser(u.id),
  ])
  return {
    user: {
      handle: u.handle,
      displayName: u.display_name,
      // do not leak email
    },
    visits: items.map((r) => ({ museumId: r.museum_id, visitedAt: r.visited_at, note: r.note })),
    review: review ? { summary: review.summary, count: review.visit_count, generatedAt: review.generated_at } : null,
    dynastyReviews: dynastyRows.map((r) => ({
      dynastyId: r.dynasty_id,
      summary: r.summary,
      count: r.visit_count,
      generatedAt: r.generated_at,
    })),
  }
}

export const profileRoute = new Elysia()
  .use(sessionMiddleware)
  .get("/u/:handle", async (ctx) => {
    const c = ctx as unknown as Ctx
    const handle = String(c.params?.handle || "").toLowerCase()
    const env = c.env
    const profile = await loadProfile(env, handle)
    if (!profile) {
      return new Response(ErrorPage(`找不到用户 @${handle}`), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const museumsRepo = new MuseumsRepo(env.DB)
    const dynastiesRepo = new DynastiesRepo(env.DB)
    const [museums, dynasties] = await Promise.all([museumsRepo.list(), dynastiesRepo.listFull()])
    const selfUser = c.user ? { handle: c.user.handle, displayName: c.user.display_name } : null
    return new Response(
      ProfilePage({ profile, museums, dynasties, selfUser }),
      { headers: { "content-type": "text/html; charset=utf-8" } },
    )
  })
  .get("/u/:handle/map", async (ctx) => {
    const c = ctx as unknown as Ctx
    const handle = String(c.params?.handle || "").toLowerCase()
    const env = c.env
    const profile = await loadProfile(env, handle)
    if (!profile) {
      return new Response(ErrorPage(`找不到用户 @${handle}`), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const museumsRepo = new MuseumsRepo(env.DB)
    const dynastiesRepo = new DynastiesRepo(env.DB)
    const [museums, dynasties] = await Promise.all([museumsRepo.list(), dynastiesRepo.listFull()])
    const googleEnabled = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.OAUTH_REDIRECT_URI)
    return new Response(
      HomePage({ museums, dynasties, googleEnabled, viewingProfile: profile }),
      { headers: { "content-type": "text/html; charset=utf-8" } },
    )
  })
  .get("/api/u/:handle", async (ctx) => {
    const c = ctx as unknown as Ctx
    const handle = String(c.params?.handle || "").toLowerCase()
    const profile = await loadProfile(c.env, handle)
    if (!profile) {
      c.set.status = 404
      return { error: "not_found" }
    }
    return profile
  })
