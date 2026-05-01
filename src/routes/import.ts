import { Elysia } from "elysia"
import type { Env } from "~/index"
import { runImportAgent, type ImportEvent } from "~/services/import"
import { MuseumsPendingRepo } from "~/repo/museums-pending"
import { MuseumsRepo } from "~/repo/museums"
import { scorePayload, generateAiComment } from "~/services/review"
import type { MuseumPayload, Provenance } from "~/services/import-schema"

interface RouteContext {
  env: Env
  request: Request
  body: any
  params: any
  set: any
}

function checkAuth(env: Env, request: Request): { ok: true } | { ok: false; status: number; body: any } {
  if (!env.ADMIN_TOKEN) return { ok: false, status: 503, body: { error: "import disabled: ADMIN_TOKEN not configured" } }
  const token = request.headers.get("x-admin-token") || ""
  if (token !== env.ADMIN_TOKEN) return { ok: false, status: 401, body: { error: "unauthorized" } }
  return { ok: true }
}

export const importRoute = new Elysia()
  .post("/api/import", async (ctx) => {
    const { env, request, body, set } = ctx as unknown as RouteContext
    const auth = checkAuth(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    if (env.COPILOT_GATEWAY_URL == null || env.COPILOT_GATEWAY_KEY == null) {
      set.status = 503
      return { error: "import unavailable: gateway not configured" }
    }
    const query = typeof body?.query === "string" ? body.query.trim() : ""
    if (!query) {
      set.status = 400
      return { error: "query required" }
    }
    if (query.length > 200) {
      set.status = 400
      return { error: "query too long" }
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: ImportEvent) => {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))
        }
        try {
          await runImportAgent({
            db: env.DB,
            query,
            gatewayUrl: env.COPILOT_GATEWAY_URL!,
            gatewayKey: env.COPILOT_GATEWAY_KEY!,
            onEvent: send,
          })
        } catch (e: any) {
          send({ type: "error", message: e?.message || "internal_error" })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
    })
  })
  .get("/api/pending", async (ctx) => {
    const { env, request, set } = ctx as unknown as RouteContext
    const auth = checkAuth(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    const url = new URL(request.url)
    const status = url.searchParams.get("status") || undefined
    const repo = new MuseumsPendingRepo(env.DB)
    const rows = await repo.list(status)
    return {
      items: rows.map((r) => {
        const payload = JSON.parse(r.payload) as MuseumPayload
        const score = scorePayload(payload)
        return {
          id: r.id,
          query: r.query,
          status: r.status,
          createdAt: r.created_at,
          name: payload.name,
          location: payload.location,
          level: payload.level,
          overall: score.overall,
          verdict: score.verdict,
          sources: payload.sources?.length ?? 0,
        }
      }),
    }
  })
  .get("/api/pending/:id", async (ctx) => {
    const { env, request, params, set } = ctx as unknown as RouteContext
    const auth = checkAuth(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    const repo = new MuseumsPendingRepo(env.DB)
    const row = await repo.get(params.id)
    if (!row) {
      set.status = 404
      return { error: "not found" }
    }
    const payload = JSON.parse(row.payload) as MuseumPayload
    const provenance = (row.provenance ? JSON.parse(row.provenance) : {}) as Provenance
    const score = scorePayload(payload, provenance)
    let comment = ""
    if (env.COPILOT_GATEWAY_URL && env.COPILOT_GATEWAY_KEY) {
      comment = await generateAiComment({
        payload,
        score,
        gatewayUrl: env.COPILOT_GATEWAY_URL,
        gatewayKey: env.COPILOT_GATEWAY_KEY,
      })
    }
    return {
      id: row.id,
      query: row.query,
      status: row.status,
      createdAt: row.created_at,
      payload,
      provenance,
      review: { ...score, comment },
    }
  })
  .post("/api/pending/:id/approve", async (ctx) => {
    const { env, request, params, body, set } = ctx as unknown as RouteContext
    const auth = checkAuth(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    const repo = new MuseumsPendingRepo(env.DB)
    const row = await repo.get(params.id)
    if (!row) {
      set.status = 404
      return { error: "not found" }
    }
    const payload = JSON.parse(row.payload) as MuseumPayload
    const museums = new MuseumsRepo(env.DB)
    await museums.upsert(params.id, payload)
    await repo.updateStatus(params.id, "approved", typeof body?.notes === "string" ? body.notes : undefined)
    return { ok: true, id: params.id, status: "approved", published: true }
  })
  .post("/api/pending/:id/reject", async (ctx) => {
    const { env, request, params, body, set } = ctx as unknown as RouteContext
    const auth = checkAuth(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    const repo = new MuseumsPendingRepo(env.DB)
    const ok = await repo.updateStatus(params.id, "rejected", typeof body?.notes === "string" ? body.notes : undefined)
    if (!ok) {
      set.status = 404
      return { error: "not found" }
    }
    return { ok: true, id: params.id, status: "rejected" }
  })
  .delete("/api/pending/:id", async (ctx) => {
    const { env, request, params, set } = ctx as unknown as RouteContext
    const auth = checkAuth(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    const repo = new MuseumsPendingRepo(env.DB)
    const ok = await repo.delete(params.id)
    if (!ok) {
      set.status = 404
      return { error: "not found" }
    }
    return { ok: true, id: params.id, deleted: true }
  })
  .post("/api/museums/:id/unpublish", async (ctx) => {
    const { env, request, params, set } = ctx as unknown as RouteContext
    const auth = checkAuth(env, request)
    if (!auth.ok) {
      set.status = auth.status
      return auth.body
    }
    const r = await env.DB.prepare("DELETE FROM museums WHERE id = ?").bind(params.id).run()
    const removed = (r.meta?.changes ?? 0) > 0
    if (!removed) {
      set.status = 404
      return { error: "not found in museums" }
    }
    return { ok: true, id: params.id, unpublished: true }
  })

