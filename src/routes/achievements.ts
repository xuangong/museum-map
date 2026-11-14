import { Elysia } from "elysia"
import type { Env } from "~/index"
import { sessionMiddleware, requireUser } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import { AchievementsRepo } from "~/repo/achievements"
import { ACHIEVEMENTS } from "~/data/achievements"

interface Ctx { env: Env; body: any; set: any; user: UserRow | null }
const KNOWN = new Set(ACHIEVEMENTS.map((a) => a.id))

export const achievementsRoute = new Elysia()
  .use(sessionMiddleware)
  .get("/api/achievements", async (ctx) => {
    const c = ctx as unknown as Ctx
    const u = requireUser(c as any)
    if (!u) return { error: "unauthorized" }
    return { items: await new AchievementsRepo(c.env.DB).list(u.id) }
  })
  .post("/api/achievements", async (ctx) => {
    const c = ctx as unknown as Ctx
    const u = requireUser(c as any)
    if (!u) return { error: "unauthorized" }
    const raw = Array.isArray(c.body?.items) ? c.body.items.slice(0, 200) : []
    const now = Date.now()
    const items = raw
      .filter((i: any) => i && KNOWN.has(i.id) && Number.isFinite(i.r) && i.r > 0)
      .map((i: any) => ({ id: String(i.id), r: Math.min(Number(i.r), now), c: Number.isFinite(i.c) && i.c > 0 ? Math.min(Number(i.c), now) : 0 }))
    await new AchievementsRepo(c.env.DB).upsert(u.id, items)
    return { ok: true, n: items.length }
  })
