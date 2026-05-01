import { Elysia } from "elysia"

export interface Env {
  DB: D1Database
  RATE: KVNamespace
}

const app = new Elysia({ aot: false })
  .get("/health", () => ({ status: "ok" }))

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.handle(request)
  },
}
