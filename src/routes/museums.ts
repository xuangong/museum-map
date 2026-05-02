import { Elysia } from "elysia"
import { MuseumsRepo } from "~/repo/museums"
import { FieldProvenanceRepo } from "~/repo/field-provenance"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
  request: Request
  params: any
  set: any
}

export const museumsRoute = new Elysia()
  .get("/api/museums", async (ctx) => {
    const { env } = ctx as unknown as RouteContext
    const repo = new MuseumsRepo(env.DB)
    return await repo.list()
  })
  .get("/api/museums/:id", async (ctx) => {
    const { env, request, params, set } = ctx as unknown as RouteContext
    const repo = new MuseumsRepo(env.DB)
    const m = await repo.get(params.id)
    if (!m) {
      set.status = 404
      return { error: "not_found" }
    }
    const url = new URL(request.url)
    if (url.searchParams.get("withProvenance")) {
      const provRepo = new FieldProvenanceRepo(env.DB)
      const rows = await provRepo.listFor(params.id)
      const _provenance: Record<string, { sourceUrl: string | null; authority: string | null; recordedAt: number }> = {}
      for (const r of rows) {
        _provenance[r.field_path] = {
          sourceUrl: r.source_url,
          authority: r.authority,
          recordedAt: r.recorded_at,
        }
      }
      return { ...m, _provenance }
    }
    return m
  })
