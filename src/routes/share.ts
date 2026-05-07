import { Elysia } from "elysia"
import type { Env } from "~/index"
import { UsersRepo } from "~/repo/users"
import { VisitsRepo } from "~/repo/visits"
import { ReviewCacheRepo } from "~/repo/review-cache"
import { DynastyReviewCacheRepo } from "~/repo/dynasty-review-cache"
import { MuseumsRepo } from "~/repo/museums"
import { DynastiesRepo } from "~/repo/dynasties"
import { ErrorPage } from "~/ui/home"
import { generatePoetCopy } from "~/services/share-poet"
import { buildQrSvg } from "~/services/qr"
import { currentSolarTerm, chineseYear } from "~/services/solar-term"
import { renderPosterSvg, POSTER_W, POSTER_H } from "~/ui/share-poster"
import { Layout } from "~/ui/layout"

interface Ctx {
  env: Env
  params: { handle: string }
  request: Request
  set: any
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export const shareRoute = new Elysia()
  .get("/u/:handle/share", async (ctx) => {
    const c = ctx as unknown as Ctx
    const handle = String(c.params?.handle || "").toLowerCase()
    const env = c.env
    const users = new UsersRepo(env.DB)
    const u = await users.findByHandle(handle)
    if (!u || !u.handle) {
      return new Response(ErrorPage(`找不到用户 @${handle}`), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }
    const userHandle = u.handle
    if (!env.COPILOT_GATEWAY_URL || !env.COPILOT_GATEWAY_KEY) {
      return new Response(ErrorPage("分享海报暂不可用（AI 网关未配置）"), {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }

    const visitsRepo = new VisitsRepo(env.DB)
    const reviewRepo = new ReviewCacheRepo(env.DB)
    const dynReviewRepo = new DynastyReviewCacheRepo(env.DB)
    const museumsRepo = new MuseumsRepo(env.DB)
    const dynastiesRepo = new DynastiesRepo(env.DB)

    const [visits, review, dynRows, museums, dynasties] = await Promise.all([
      visitsRepo.list(u.id),
      reviewRepo.get(u.id),
      dynReviewRepo.listByUser(u.id),
      museumsRepo.list(),
      dynastiesRepo.listFull(),
    ])

    const museumById = new Map(museums.map((m) => [m.id, m]))
    const dynastyById = new Map(dynasties.map((d) => [d.id, d]))
    const visitedIds = new Set(visits.map((v) => v.museum_id))

    const dynastyVisitCount = new Map<string, number>()
    for (const d of dynasties) {
      let n = 0
      for (const r of d.recommendedMuseums || []) if (r.museumId && visitedIds.has(r.museumId)) n++
      for (const r of d.relatedMuseums || []) if (r.museumId && visitedIds.has(r.museumId)) n++
      if (n > 0) dynastyVisitCount.set(d.id, n)
    }
    const dynastyCount = dynastyVisitCount.size

    const recentMuseums = [...visits]
      .sort((a, b) => b.visited_at - a.visited_at)
      .map((v) => museumById.get(v.museum_id)?.name)
      .filter((s): s is string => !!s)
      .slice(0, 8)

    const dynastyReviews = dynRows
      .map((r) => {
        const d = dynastyById.get(r.dynasty_id)
        if (!d) return null
        return {
          dynastyName: d.name,
          count: dynastyVisitCount.get(d.id) ?? r.visit_count,
          summary: r.summary || "",
        }
      })
      .filter((x): x is { dynastyName: string; count: number; summary: string } => !!x)

    const displayName = u.display_name || `@${userHandle}`
    let copy
    try {
      copy = await generatePoetCopy({
        input: {
          displayName,
          handle: userHandle,
          visitCount: visits.length,
          dynastyCount,
          recentMuseums,
          reviewSummary: review?.summary ?? null,
          dynastyReviews,
        },
        gatewayUrl: env.COPILOT_GATEWAY_URL,
        gatewayKey: env.COPILOT_GATEWAY_KEY,
      })
    } catch (e) {
      return new Response(ErrorPage(`生成海报失败：${(e as Error).message}`), {
        status: 502,
        headers: { "content-type": "text/html; charset=utf-8" },
      })
    }

    const url = new URL(c.request.url)
    const profileUrl = `${url.origin}/u/${encodeURIComponent(userHandle)}`
    const qr = buildQrSvg(profileUrl)
    const term = currentSolarTerm()

    const svg = renderPosterSvg({
      displayName,
      handle: userHandle,
      recentMuseums,
      themeWord: copy.themeWord,
      poem: copy.poem,
      poemSource: copy.poemSource,
      headline: copy.headline,
      qrSvgInner: qr.inner,
      qrModuleCount: qr.modules,
      solarTerm: term.name,
      yearZh: chineseYear(term.year),
    })

    // SVG-only endpoint (?format=svg) for previews / debugging.
    if (url.searchParams.get("format") === "svg") {
      return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8" } })
    }

    return new Response(SharePage({ svg, displayName, handle: userHandle }), {
      headers: { "content-type": "text/html; charset=utf-8" },
    })
  })

function SharePage(opts: { svg: string; displayName: string; handle: string }): string {
  const { svg, displayName, handle } = opts
  const css = `
    body { background: #2A2724; margin: 0; min-height: 100dvh;
      display: flex; flex-direction: column; align-items: center;
      padding: 36px 18px 56px; color: #E8E2D2; font-family: var(--display); }
    .share-header { width: 100%; max-width: 720px; display: flex;
      justify-content: space-between; align-items: baseline; margin-bottom: 24px; }
    .share-header h1 { font-size: 22px; font-weight: 400; margin: 0; letter-spacing: 0.02em; }
    .share-header a { color: #B73E18; text-decoration: none; font-family: var(--mono);
      font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; }
    .poster-frame {
      max-width: min(720px, calc(100vw - 36px));
      box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.3);
    }
    .poster-frame svg { width: 100%; height: auto; display: block; }
    .actions { display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap; justify-content: center; }
    .btn { font-family: var(--display); font-size: 14px;
      padding: 12px 22px; border: 0.5px solid #B73E18; background: #B73E18; color: #F4EFE3;
      border-radius: 0; cursor: pointer; letter-spacing: 0.06em; }
    .btn.ghost { background: transparent; color: #E8E2D2; border-color: #6B6760; }
    .hint { margin-top: 18px; font-family: var(--mono); font-size: 11px;
      letter-spacing: 0.2em; color: #6B6760; text-align: center; }
  `
  const safeName = `museum-atlas-${handle}.png`
  const script = `
    (function(){
      const svgEl = document.querySelector('.poster-frame svg');
      const btnPng = document.getElementById('btn-png');
      const btnSvg = document.getElementById('btn-svg');
      const W = ${POSTER_W}, H = ${POSTER_H};
      function svgString(){
        const clone = svgEl.cloneNode(true);
        clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
        clone.setAttribute('width', W);
        clone.setAttribute('height', H);
        return new XMLSerializer().serializeToString(clone);
      }
      function download(blob, name){
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      btnSvg && btnSvg.addEventListener('click', function(){
        const blob = new Blob([svgString()], { type: 'image/svg+xml' });
        download(blob, ${JSON.stringify(safeName.replace(/\.png$/, ".svg"))});
      });
      btnPng && btnPng.addEventListener('click', async function(){
        btnPng.disabled = true; btnPng.textContent = '生成中…';
        try {
          const svg = svgString();
          const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
          const scale = 2;
          const cv = document.createElement('canvas');
          cv.width = W * scale; cv.height = H * scale;
          const ctx = cv.getContext('2d');
          ctx.fillStyle = '#F4EFE3';
          ctx.fillRect(0, 0, cv.width, cv.height);
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          URL.revokeObjectURL(url);
          await new Promise((res) => cv.toBlob((b) => { if (b) download(b, ${JSON.stringify(safeName)}); res(null); }, 'image/png'));
        } catch (e) {
          alert('保存失败：' + (e && e.message || e));
        } finally {
          btnPng.disabled = false; btnPng.textContent = '保存为图片';
        }
      });
    })();
  `
  return Layout({
    title: `${displayName} 的海报 · 中国博物馆地图`,
    head: `<style>${css}</style>`,
    children: `
      <div class="share-header">
        <h1>${esc(displayName)} · 足迹海报</h1>
        <a href="/u/${esc(handle)}">← 返回主页</a>
      </div>
      <div class="poster-frame">${svg}</div>
      <div class="actions">
        <button class="btn" id="btn-png">保存为图片</button>
        <button class="btn ghost" id="btn-svg">下载 SVG</button>
      </div>
      <div class="hint">长按图片或点击「保存为图片」即可分享</div>
      <script>${script}</script>
    `,
  })
}
