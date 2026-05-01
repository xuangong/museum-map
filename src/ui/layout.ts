import { html, raw } from "~/lib/html"
import { themeCss } from "./theme"

export function Layout({
  title,
  head,
  children,
}: {
  title: string
  head?: string
  children: string
}): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&family=Noto+Serif+SC:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/cdn/leaflet.css">
  <script src="/cdn/tailwind.js"></script>
  <script defer src="/cdn/alpine.js"></script>
  <script src="/cdn/leaflet.js"></script>
  <style>${themeCss}</style>
  ${head ?? ""}
</head>
<body>
${children}
</body>
</html>`
}
