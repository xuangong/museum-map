import { Elysia } from "elysia"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
  body: any
  headers: Record<string, string | undefined>
  set: { status?: number }
}

export const adminImageRoute = new Elysia().post("/api/admin/set-artifact-image", async (ctx) => {
  const { env, body, headers, set } = ctx as unknown as RouteContext
  const token = headers["x-admin-token"]
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    set.status = 401
    return { error: "unauthorized" }
  }
  const museumId = String(body?.museumId ?? "")
  const artifactIdx = Number(body?.artifactIdx ?? -1)
  const imageUrl = String(body?.imageUrl ?? "")
  const license = body?.license == null ? null : String(body.license)
  const attribution = body?.attribution == null ? null : String(body.attribution)
  const sourceUrl = body?.sourceUrl == null ? null : String(body.sourceUrl)
  const authority = body?.authority == null ? null : String(body.authority)
  if (!museumId || artifactIdx < 0 || !imageUrl) {
    set.status = 400
    return { error: "museumId, artifactIdx, imageUrl required" }
  }
  await env.DB.prepare(
    `UPDATE museum_artifacts SET image_url=?, image_license=?, image_attribution=? WHERE museum_id=? AND order_index=?`,
  )
    .bind(imageUrl, license, attribution, museumId, artifactIdx)
    .run()
  if (sourceUrl && authority) {
    await env.DB.prepare(
      `INSERT INTO field_provenance (museum_id, field_path, source_url, authority, recorded_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(museum_id, field_path) DO UPDATE SET source_url=excluded.source_url, authority=excluded.authority, recorded_at=excluded.recorded_at`,
    )
      .bind(museumId, `artifacts[${artifactIdx}].image`, sourceUrl, authority, Date.now())
      .run()
  }
  return { ok: true }
})
