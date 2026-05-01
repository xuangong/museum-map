import { Elysia } from "elysia"
import { DynastiesRepo } from "~/repo/dynasties"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
}

export const dynastiesRoute = new Elysia()
  .get("/api/dynasties", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new DynastiesRepo(env.DB)
    return await repo.listFull()
  })
  .get("/api/dynasties/:id", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new DynastiesRepo(env.DB)
    const d = await repo.get(ctx.params.id)
    if (!d) {
      ctx.set.status = 404
      return { error: "not_found" }
    }
    return d
  })
