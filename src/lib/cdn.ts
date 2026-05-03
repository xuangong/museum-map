import { Elysia } from "elysia"

const CDN_MAP: Record<string, string> = {
  "tailwind.js": "https://cdn.tailwindcss.com/3.4.17",
  "alpine.js": "https://unpkg.com/alpinejs@3/dist/cdn.min.js",
  "leaflet.js": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "leaflet.css": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "html2canvas.js": "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js",
  "leaflet-image.js": "https://unpkg.com/leaflet-image@0.4.0/leaflet-image.js",
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
