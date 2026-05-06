import { Elysia } from "elysia"
import type { Env } from "~/index"
import { listPlaza } from "~/services/plaza"
import { PlazaPage } from "~/ui/plaza"
import { sessionMiddleware } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"

interface Ctx {
  env: Env
  query: any
  set: any
  user: UserRow | null
  session: SessionRow | null
}

const PAGE_SIZE = 60

export const plazaRoute = new Elysia()
  .use(sessionMiddleware)
  .get("/plaza", async (ctx) => {
    const c = ctx as unknown as Ctx
    const sortRaw = String(c.query?.sort || "visits")
    const sort: "visits" | "recent" | "newest" =
      sortRaw === "recent" || sortRaw === "newest" ? sortRaw : "visits"
    const page = Math.max(1, parseInt(String(c.query?.page || "1"), 10) || 1)
    const offset = (page - 1) * PAGE_SIZE
    const { entries, total } = await listPlaza(c.env, { sort, limit: PAGE_SIZE, offset })
    const selfHandle = c.user?.handle || null
    return new Response(
      PlazaPage({ entries, total, sort, page, pageSize: PAGE_SIZE, selfHandle }),
      { headers: { "content-type": "text/html; charset=utf-8" } },
    )
  })
  .get("/api/plaza", async (ctx) => {
    const c = ctx as unknown as Ctx
    const sortRaw = String(c.query?.sort || "visits")
    const sort: "visits" | "recent" | "newest" =
      sortRaw === "recent" || sortRaw === "newest" ? sortRaw : "visits"
    const page = Math.max(1, parseInt(String(c.query?.page || "1"), 10) || 1)
    const offset = (page - 1) * PAGE_SIZE
    const { entries, total } = await listPlaza(c.env, { sort, limit: PAGE_SIZE, offset })
    return { entries, total, sort, page, pageSize: PAGE_SIZE }
  })
