import { Elysia } from "elysia"

const CDN_MAP: Record<string, string> = {
  "tailwind.js": "https://cdn.tailwindcss.com/3.4.17",
  "alpine.js": "https://unpkg.com/alpinejs@3/dist/cdn.min.js",
  "leaflet.js": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "leaflet.css": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "html2canvas.js": "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js",
  "leaflet-image.js": "https://unpkg.com/leaflet-image@0.4.0/leaflet-image.js",
  "qrcode.js": "https://unpkg.com/qrcode-generator@1.4.4/qrcode.js",
}

// Wrap a (req → upstream Response) function with Cloudflare edge caching.
// CF Workers do NOT auto-cache fetch() results — Cache-Control headers alone
// don't help unless we explicitly use caches.default.
async function withEdgeCache(
  request: Request,
  build: () => Promise<Response>,
): Promise<Response> {
  const cache = (globalThis as any).caches?.default as Cache | undefined
  if (!cache) return build()
  const cacheKey = new Request(request.url, { method: "GET" })
  const hit = await cache.match(cacheKey)
  if (hit) {
    const h = new Headers(hit.headers)
    h.set("X-Cache", "HIT")
    return new Response(hit.body, { status: hit.status, headers: h })
  }
  const fresh = await build()
  // Only cache successful responses with cacheable headers.
  if (!fresh.ok || fresh.status !== 200) {
    const h = new Headers(fresh.headers)
    h.set("X-Cache", "BYPASS")
    return new Response(fresh.body, { status: fresh.status, headers: h })
  }
  // Buffer the body so we can write to cache AND respond reliably.
  // (Streaming body + clone+put has been flaky for us — the put silently
  // races the response close, leaving the cache empty.)
  const buf = await fresh.arrayBuffer()
  await cache.put(cacheKey, new Response(buf, { status: 200, headers: fresh.headers }))
  const h = new Headers(fresh.headers)
  h.set("X-Cache", "MISS")
  return new Response(buf, { status: 200, headers: h })
}

export const cdnRoute = new Elysia()
  .get("/cdn/:file", async ({ params }) => {
    const url = CDN_MAP[params.file]
    if (!url) return new Response("Not found", { status: 404 })
    const ct = params.file.endsWith(".css") ? "text/css" : "application/javascript"
    const upstream = await fetch(url)
    return new Response(upstream.body, {
      headers: { "Content-Type": ct, "Cache-Control": "public, max-age=604800" },
    })
  })
  // Proxy AutoNavi map tiles with permissive CORS so canvas/leaflet-image can read them.
  // Path: /tile/{s}/{z}/{x}/{y}
  .get("/tile/:s/:z/:x/:y", async ({ params }) => {
    const { s, z, x, y } = params as { s: string; z: string; x: string; y: string }
    if (!/^[1-4]$/.test(s) || !/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
      return new Response("bad tile", { status: 400 })
    }
    const upstream = await fetch(
      `https://webrd0${s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${z}`,
    )
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=2592000",
        "Access-Control-Allow-Origin": "*",
      },
    })
  })
  // Proxy Wikimedia upload images. Origin upload.wikimedia.org is blocked from
  // some networks (notably mainland China). Path: /img/wikimedia/<rest-of-path>
  // where <rest-of-path> is the part after https://upload.wikimedia.org/
  .get("/img/wikimedia/*", async ({ request }) => withEdgeCache(request, async () => {
    const url = new URL(request.url)
    // strip the "/img/wikimedia/" prefix; keep the rest verbatim (already URL-encoded)
    const rest = url.pathname.replace(/^\/img\/wikimedia\//, "")
    if (!rest) return new Response("bad path", { status: 400 })
    const upstream = await fetch(`https://upload.wikimedia.org/${rest}`, {
      headers: {
        // Wikimedia silently 403s without a meaningful UA.
        "User-Agent":
          "museum-map/1.0 (+https://museum.xianliao.de5.net; contact via github)",
      },
    })
    if (!upstream.ok) {
      return new Response("upstream error", { status: upstream.status })
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=2592000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }))
  // Proxy Wikimedia Commons "description page" file references (legacy seed data
  // sometimes points at https://commons.wikimedia.org/wiki/File:Foo.jpg rather
  // than the direct upload.* URL). We resolve via Special:FilePath which 302s
  // to the real file, then stream the result.
  // Path: /img/commons/<filename> (URL-encoded)
  .get("/img/commons/*", async ({ request }) => withEdgeCache(request, async () => {
    const url = new URL(request.url)
    const filename = url.pathname.replace(/^\/img\/commons\//, "")
    if (!filename) return new Response("bad path", { status: 400 })
    const upstream = await fetch(
      `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`,
      {
        redirect: "follow",
        headers: {
          "User-Agent":
            "museum-map/1.0 (+https://museum.xianliao.de5.net; contact via github)",
        },
      },
    )
    if (!upstream.ok) {
      return new Response("upstream error", { status: upstream.status })
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=2592000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }))
