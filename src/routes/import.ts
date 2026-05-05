import { Elysia } from "elysia"
import type { Env } from "~/index"
import { runImportAgent, type ImportEvent } from "~/services/import"
import { runImageEnricher, type EnrichEvent } from "~/services/image-enricher"
import { MuseumsPendingRepo } from "~/repo/museums-pending"
import { MuseumsRepo } from "~/repo/museums"
import { FieldProvenanceRepo } from "~/repo/field-provenance"
import { scorePayload, generateAiComment, classifySource } from "~/services/review"
import { flattenProvenance, type MuseumPayload, type Provenance } from "~/services/import-schema"
import { buildEvidence } from "~/services/dynasty-museum-match"
import { generateReason } from "~/services/dynasty-reason"
import { sessionMiddleware, requireAdmin } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import type { SessionRow } from "~/repo/sessions"

interface RouteContext {
  env: Env
  request: Request
  body: any
  params: any
  set: any
  user: UserRow | null
  session: SessionRow | null
}

export const importRoute = new Elysia()
  .use(sessionMiddleware)
  .post("/api/import", async (ctx) => {
    const { env, request, body, set } = ctx as unknown as RouteContext
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
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
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
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
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
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
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
    const repo = new MuseumsPendingRepo(env.DB)
    const row = await repo.get(params.id)
    if (!row) {
      set.status = 404
      return { error: "not found" }
    }
    const payload = JSON.parse(row.payload) as MuseumPayload
    const museums = new MuseumsRepo(env.DB)
    const provRepo = new FieldProvenanceRepo(env.DB)

    let provenance: Provenance | null = null
    if (row.provenance) {
      try {
        provenance = JSON.parse(row.provenance) as Provenance
      } catch {
        provenance = null
      }
    }

    const stmts = museums.buildUpsertStatements(params.id, payload)
    if (provenance) {
      const flat = flattenProvenance(payload, provenance, classifySource)
      stmts.push(...provRepo.buildReplaceStatements(params.id, flat))
    }
    await env.DB.batch(stmts)
    await repo.updateStatus(params.id, "approved", typeof body?.notes === "string" ? body.notes : undefined)
    return { ok: true, id: params.id, status: "approved", published: true }
  })
  .post("/api/pending/:id/reject", async (ctx) => {
    const { env, request, params, body, set } = ctx as unknown as RouteContext
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
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
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
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
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
    const r = await env.DB.prepare("DELETE FROM museums WHERE id = ?").bind(params.id).run()
    const removed = (r.meta?.changes ?? 0) > 0
    if (!removed) {
      set.status = 404
      return { error: "not found in museums" }
    }
    return { ok: true, id: params.id, unpublished: true }
  })
  .post("/api/museums/:id/enrich-images", async (ctx) => {
    const { env, request, params, set } = ctx as unknown as RouteContext
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
    if (env.COPILOT_GATEWAY_URL == null || env.COPILOT_GATEWAY_KEY == null) {
      set.status = 503
      return { error: "enrichment unavailable: gateway not configured" }
    }
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: EnrichEvent) => {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))
        }
        try {
          await runImageEnricher({
            db: env.DB,
            museumId: params.id,
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
  .post("/api/admin/dynasty-reasons/generate", async (ctx) => {
    const { env, request, set } = ctx as unknown as RouteContext
    if (!requireAdmin(ctx as any)) return { error: "forbidden" }
    if (env.COPILOT_GATEWAY_URL == null || env.COPILOT_GATEWAY_KEY == null) {
      set.status = 503
      return { error: "gateway not configured" }
    }
    const url = new URL(request.url)
    const onlyDynasty = url.searchParams.get("dynasty")
    const onlyMuseum = url.searchParams.get("museum")
    const skipExisting = url.searchParams.get("skipExisting") !== "0"

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: any) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"))
        try {
          const dynasties = await env.DB.prepare(
            "SELECT id, name FROM dynasties ORDER BY order_index",
          ).all<{ id: string; name: string }>()
          const museums = await env.DB.prepare(
            "SELECT id, name, core_period AS corePeriod, dynasty_coverage AS dynastyCoverage FROM museums",
          ).all<{ id: string; name: string; corePeriod: string | null; dynastyCoverage: string | null }>()
          const artifacts = await env.DB.prepare(
            "SELECT museum_id, name, period FROM museum_artifacts",
          ).all<{ museum_id: string; name: string; period: string | null }>()
          const existing = await env.DB.prepare(
            "SELECT dynasty_id, museum_id FROM dynasty_museum_reasons",
          ).all<{ dynasty_id: string; museum_id: string }>()
          const have = new Set<string>()
          for (const r of existing.results) have.add(r.dynasty_id + "|" + r.museum_id)

          const curated = await env.DB.prepare(
            "SELECT dynasty_id, museum_id FROM dynasty_recommended_museums WHERE museum_id IS NOT NULL",
          ).all<{ dynasty_id: string; museum_id: string }>()
          const isCurated = new Set<string>()
          for (const r of curated.results) isCurated.add(r.dynasty_id + "|" + r.museum_id)

          let done = 0
          let failed = 0
          let skipped = 0

          const dyns = dynasties.results.filter((d) => !onlyDynasty || d.id === onlyDynasty)
          const ms = museums.results.filter((m) => !onlyMuseum || m.id === onlyMuseum)

          const tasks: { d: { id: string; name: string }; m: typeof ms[0]; ev: ReturnType<typeof buildEvidence>[number] }[] = []
          for (const d of dyns) {
            const evs = buildEvidence({ id: d.id, name: d.name }, ms, artifacts.results)
            for (const ev of evs) {
              const key = d.id + "|" + ev.museumId
              if (isCurated.has(key)) {
                skipped++
                continue
              }
              if (skipExisting && have.has(key)) {
                skipped++
                continue
              }
              const m = ms.find((x) => x.id === ev.museumId)!
              tasks.push({ d, m, ev })
            }
          }
          const total = tasks.length
          send({ type: "start", total, skipped })

          for (const t of tasks) {
            try {
              const reason = await generateReason({
                dynastyName: t.d.name,
                museumName: t.m.name,
                evidence: t.ev,
                gatewayUrl: env.COPILOT_GATEWAY_URL!,
                gatewayKey: env.COPILOT_GATEWAY_KEY!,
              })
              await env.DB.prepare(
                "INSERT OR REPLACE INTO dynasty_museum_reasons (dynasty_id, museum_id, reason, evidence_json, generated_at) VALUES (?, ?, ?, ?, ?)",
              )
                .bind(t.d.id, t.m.id, reason, JSON.stringify(t.ev), Date.now())
                .run()
              done++
              send({ type: "ok", dynasty: t.d.name, museum: t.m.name, reason, done, total })
            } catch (e: any) {
              failed++
              send({ type: "fail", dynasty: t.d.name, museum: t.m.name, error: e?.message || "error", failed })
            }
          }
          send({ type: "done", total, done, failed, skipped })
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