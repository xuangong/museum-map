import { Elysia } from "elysia"

const CDN_MAP: Record<string, string> = {
  "tailwind.js": "https://cdn.tailwindcss.com/3.4.17",
  "alpine.js": "https://unpkg.com/alpinejs@3/dist/cdn.min.js",
  "leaflet.js": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "leaflet.css": "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "html2canvas.js": "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js",
}

export const cdnRoute = new Elysia().get("/cdn/:file", async ({ params }) => {
  const url = CDN_MAP[params.file]
  if (!url) return new Response("Not found", { status: 404 })
  const ct = params.file.endsWith(".css") ? "text/css" : "application/javascript"
  const upstream = await fetch(url)
  return new Response(upstream.body, {
    headers: { "Content-Type": ct, "Cache-Control": "public, max-age=604800" },
  })
})
