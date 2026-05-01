import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { museumsRoute } from "~/routes/museums"
import { dynastiesRoute } from "~/routes/dynasties"
import { chatRoute } from "~/routes/chat"
import { cdnRoute } from "~/lib/cdn"

export interface Env {
  DB: D1Database
  RATE: KVNamespace
  RATE_PER_MIN?: string
  RATE_PER_DAY?: string
  GLOBAL_PER_DAY?: string
  COPILOT_GATEWAY_URL?: string
  COPILOT_GATEWAY_KEY?: string
}

export function createApp(env: Env) {
  return new Elysia({ aot: false })
    .use(cors())
    .decorate("env", env)
    .get("/health", () => ({ status: "ok" }))
    .use(cdnRoute)
    .use(museumsRoute)
    .use(dynastiesRoute)
    .use(chatRoute)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createApp(env).handle(request)
  },
}
