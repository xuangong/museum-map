import { Elysia } from "elysia"
import type { Env } from "~/index"
import { searchWikidataEntity, fetchWikidataImage, searchCommonsFile } from "~/services/wikimedia"

interface RouteContext {
  env: Env
  query: Record<string, string | undefined>
  headers: Record<string, string | undefined>
  set: { status?: number }
}

/** Admin-only proxy so local scripts can reach Wikimedia from networks
 *  where the API hosts are blocked (Worker egress is unrestricted). */
export const adminWikimediaRoute = new Elysia()
  .get("/api/admin/wikimedia/wikidata", async (ctx) => {
    const { env, query, headers, set } = ctx as unknown as RouteContext
    if (!env.ADMIN_TOKEN || headers["x-admin-token"] !== env.ADMIN_TOKEN) {
      set.status = 401
      return { error: "unauthorized" }
    }
    const q = String(query.q ?? "").trim()
    if (!q) { set.status = 400; return { error: "q required" } }
    const hit = await searchWikidataEntity({ query: q })
    if (!hit) return { hit: null }
    const img = await fetchWikidataImage({ qid: hit.qid })
    return { hit, image: img }
  })
  .get("/api/admin/wikimedia/commons", async (ctx) => {
    const { env, query, headers, set } = ctx as unknown as RouteContext
    if (!env.ADMIN_TOKEN || headers["x-admin-token"] !== env.ADMIN_TOKEN) {
      set.status = 401
      return { error: "unauthorized" }
    }
    const q = String(query.q ?? "").trim()
    if (!q) { set.status = 400; return { error: "q required" } }
    const hit = await searchCommonsFile({ query: q, limit: 5 })
    return { hit }
  })
  .get("/api/admin/wikimedia/fetch", async (ctx) => {
    const { env, query, headers, set } = ctx as unknown as { env: Env; query: Record<string, string | undefined>; headers: Record<string, string | undefined>; set: { status?: number; headers: Record<string, string> } }
    if (!env.ADMIN_TOKEN || headers["x-admin-token"] !== env.ADMIN_TOKEN) {
      set.status = 401
      return new Response("unauthorized", { status: 401 })
    }
    const url = String(query.url ?? "").trim()
    if (!/^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org|.+\.wikipedia\.org)\//.test(url)) {
      set.status = 400
      return new Response("bad url", { status: 400 })
    }
    const r = await fetch(url, { headers: { "user-agent": "museum-map-bot/0.1 (https://museum.xianliao.de5.net)" } })
    const buf = await r.arrayBuffer()
    return new Response(buf, {
      status: r.status,
      headers: {
        "content-type": r.headers.get("content-type") ?? "application/octet-stream",
        "cache-control": "no-store",
      },
    })
  })
