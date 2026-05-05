import { Elysia } from "elysia"
import { cors } from "@elysiajs/cors"
import { museumsRoute } from "~/routes/museums"
import { dynastiesRoute } from "~/routes/dynasties"
import { chatRoute } from "~/routes/chat"
import { importRoute } from "~/routes/import"
import { visitsRoute } from "~/routes/visits"
import { authRoute } from "~/routes/auth"
import { cdnRoute } from "~/lib/cdn"
import { homeRoute } from "~/routes/home"

export interface Env {
  DB: D1Database
  RATE: KVNamespace
  RATE_PER_MIN?: string
  RATE_PER_DAY?: string
  GLOBAL_PER_DAY?: string
  COPILOT_GATEWAY_URL?: string
  COPILOT_GATEWAY_KEY?: string
  DISABLE_CHAT?: string
  ADMIN_TOKEN?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  OAUTH_REDIRECT_URI?: string
}

export function createApp(env: Env) {
  ;(globalThis as any).__env = env
  return new Elysia({ aot: false })
    .use(cors({ origin: true, credentials: true }))
    .decorate("env", env)
    .get("/health", () => ({ status: "ok" }))
    .use(cdnRoute)
    .use(homeRoute)
    .use(museumsRoute)
    .use(dynastiesRoute)
    .use(chatRoute)
    .use(importRoute)
    .use(visitsRoute)
    .use(authRoute)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createApp(env).handle(request)
  },
}
