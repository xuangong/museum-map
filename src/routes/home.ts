import { Elysia } from "elysia"
import type { Env } from "~/index"
import { MuseumsRepo } from "~/repo/museums"
import { DynastiesRepo } from "~/repo/dynasties"
import { HomePage, ErrorPage } from "~/ui/home"
import { annotateAll } from "~/services/pinyin"

interface RouteContext {
  env: Env
}

export const homeRoute = new Elysia().get("/", async (ctx) => {
  const { env } = ctx as unknown as RouteContext
  try {
    const museumsRepo = new MuseumsRepo(env.DB)
    const dynastiesRepo = new DynastiesRepo(env.DB)
    const [museumsRaw, dynasties] = await Promise.all([museumsRepo.list(), dynastiesRepo.listFull()])
    if (museumsRaw.length === 0) {
      return new Response(ErrorPage("数据库为空。请先运行 `bun run seed`。"), {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const museums = annotateAll(museumsRaw)
    const googleEnabled = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.OAUTH_REDIRECT_URI)
    return new Response(HomePage({ museums, dynasties, googleEnabled }), {
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  } catch (e: any) {
    return new Response(ErrorPage(`数据库读取失败：${e?.message ?? "unknown"}`), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  }
})
