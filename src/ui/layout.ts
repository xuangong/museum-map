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
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#F4EFE3" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,600&family=Noto+Serif+SC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/cdn/leaflet.css">
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
