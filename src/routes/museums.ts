import { Elysia } from "elysia"
import { MuseumsRepo } from "~/repo/museums"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
}

export const museumsRoute = new Elysia()
  .get("/api/museums", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new MuseumsRepo(env.DB)
    return await repo.list()
  })
  .get("/api/museums/:id", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new MuseumsRepo(env.DB)
    const m = await repo.get(ctx.params.id)
    if (!m) {
      ctx.set.status = 404
      return { error: "not_found" }
    }
    return m
  })
