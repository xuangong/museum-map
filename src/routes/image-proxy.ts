import { Elysia } from "elysia"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
  params: { hash: string }
}

export const imageProxyRoute = new Elysia().get("/images/:hash", async ({ params, env }: any) => {
  const key = params.hash
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(key)) {
    return new Response("bad key", { status: 400 })
  }
  const obj = await env.IMAGES.get(key)
  if (!obj) {
    return new Response("not found", { status: 404 })
  }
  // Buffer the body so it can be cloned by CORS middleware
  const buf = await obj.arrayBuffer()
  return new Response(buf, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
      ...(obj.etag ? { "etag": obj.etag } : {})
    }
  })
})

