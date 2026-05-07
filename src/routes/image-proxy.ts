import { Elysia } from "elysia"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
  params: { hash: string }
  set: { status?: number; headers: Record<string, string> }
}

export const imageProxyRoute = new Elysia().get("/img/:hash", async (ctx) => {
  const { env, params, set } = ctx as unknown as RouteContext
  const key = params.hash
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(key)) {
    set.status = 400
    return "bad key"
  }
  const obj = await env.IMAGES.get(key)
  if (!obj) {
    set.status = 404
    return "not found"
  }
  set.headers["content-type"] = obj.httpMetadata?.contentType ?? "image/jpeg"
  set.headers["cache-control"] = "public, max-age=31536000, immutable"
  if (obj.etag) set.headers["etag"] = obj.etag
  return await obj.arrayBuffer()
})

