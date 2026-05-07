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
import { renderPosterSvg, POSTER_W, POSTER_H, pickStyle, POSTER_STYLES, POSTER_STYLE_LABELS, type PosterStyle } from "~/ui/share-poster"
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

    const url0 = new URL(c.request.url)
    const wantsSvg = url0.searchParams.get("format") === "svg"
    const styleParam0 = url0.searchParams.get("style") || undefined
    const style0 = pickStyle(userHandle, styleParam0)

    // Fast path: serve loading shell instantly. Browser will fetch ?format=svg async.
    if (!wantsSvg) {
      const displayName0 = u.display_name || `@${userHandle}`
      return new Response(SharePage({ displayName: displayName0, handle: userHandle, currentStyle: style0 }), {
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
          style: style0,
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

    const profileUrl = `${url0.origin}/u/${encodeURIComponent(userHandle)}`
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
    }, style0)

    return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" } })
  })

function SharePage(opts: { displayName: string; handle: string; currentStyle: PosterStyle }): string {
  const { displayName, handle, currentStyle } = opts
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
      width: 100%;
      aspect-ratio: ${POSTER_W} / ${POSTER_H};
      background: #F4EFE3;
      box-shadow: 0 30px 60px -20px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.3);
      position: relative;
      overflow: hidden;
    }
    .poster-frame svg { width: 100%; height: auto; display: block; }
    .loading { position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 18px; color: #6B6760;
      font-family: var(--mono); font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase; }
    .loading .ring { width: 38px; height: 38px; border: 1px solid #D9D2C2;
      border-top-color: #B73E18; border-radius: 50%; animation: spin 0.9s linear infinite; }
    .loading .step { color: #8A857B; font-size: 12px; letter-spacing: 0.18em;
      font-family: var(--display); transition: opacity 0.3s; min-height: 18px; }
    .loading .quip { color: #B73E18; font-family: var(--display); font-size: 13px;
      letter-spacing: 0.06em; text-transform: none; max-width: 260px; text-align: center;
      line-height: 1.6; opacity: 0.85; }
    .loading .bar { width: 180px; height: 2px; background: #E8E2D2; overflow: hidden; }
    .loading .bar i { display: block; width: 30%; height: 100%; background: #B73E18;
      animation: slide 1.6s ease-in-out infinite; }
    .loading.error { color: #B73E18; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(430%); } }
    .actions { display: flex; gap: 12px; margin-top: 28px; flex-wrap: wrap; justify-content: center; }
    .btn { font-family: var(--display); font-size: 14px;
      padding: 12px 22px; border: 0.5px solid #B73E18; background: #B73E18; color: #F4EFE3;
      border-radius: 0; cursor: pointer; letter-spacing: 0.06em; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn.ghost { background: transparent; color: #E8E2D2; border-color: #6B6760; }
    .hint { margin-top: 18px; font-family: var(--mono); font-size: 11px;
      letter-spacing: 0.2em; color: #6B6760; text-align: center; }
    .styles { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center; }
    .styles a { font-family: var(--display); font-size: 12px; padding: 8px 14px;
      border: 1px solid #6B6760; color: #E8E2D2; text-decoration: none;
      letter-spacing: 0.12em; transition: all 0.15s; }
    .styles a:hover { border-color: #B73E18; color: #F4EFE3; }
    .styles a.active { background: #B73E18; border-color: #B73E18; color: #F4EFE3; }
  `
  const safeName = `museum-atlas-${handle}.png`
  const styleParam = currentStyle
  const svgUrl = `/u/${encodeURIComponent(handle)}/share?format=svg&style=${styleParam}`
  const script = `
    (function(){
      const W = ${POSTER_W}, H = ${POSTER_H};
      const frame = document.querySelector('.poster-frame');
      const loading = document.querySelector('.loading');
      const stepEl = loading.querySelector('.step');
      const quipEl = loading.querySelector('.quip');
      const btnPng = document.getElementById('btn-png');
      const btnSvg = document.getElementById('btn-svg');
      btnPng.disabled = true; btnSvg.disabled = true;

      const steps = [
        '检索你的足迹',
        '请 AI 题诗',
        '雕版用印',
        '装裱排版',
      ];
      const quips = [
        '正在让 Claude 翻一翻你走过的博物馆…',
        '为你斟酌一句配得上这份足迹的古诗…',
        '蘸朱砂、压印章，慢工出细活…',
        '马上好——好诗值得多等几秒。',
      ];
      let idx = 0;
      function tick(){
        stepEl.textContent = steps[Math.min(idx, steps.length - 1)];
        quipEl.textContent = quips[Math.min(idx, quips.length - 1)];
        idx++;
      }
      tick();
      const ticker = setInterval(tick, 3500);

      let svgEl = null;
      fetch(${JSON.stringify(svgUrl)}, { cache: 'no-store' })
        .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function(text){
          clearInterval(ticker);
          loading.remove();
          const tpl = document.createElement('div');
          tpl.innerHTML = text.trim();
          svgEl = tpl.querySelector('svg');
          if (!svgEl) throw new Error('海报为空');
          frame.appendChild(svgEl);
          btnPng.disabled = false; btnSvg.disabled = false;
        })
        .catch(function(e){
          clearInterval(ticker);
          loading.classList.add('error');
          stepEl.textContent = '生成失败';
          quipEl.textContent = (e && e.message) ? e.message : '请稍后再试';
          const ring = loading.querySelector('.ring'); if (ring) ring.remove();
          const bar = loading.querySelector('.bar'); if (bar) bar.remove();
        });

      function svgString(){
        if (!svgEl) return '';
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
      btnSvg.addEventListener('click', function(){
        if (!svgEl) return;
        const blob = new Blob([svgString()], { type: 'image/svg+xml' });
        download(blob, ${JSON.stringify(safeName.replace(/\.png$/, ".svg"))});
      });
      btnPng.addEventListener('click', async function(){
        if (!svgEl) return;
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
  const styleChips = POSTER_STYLES.map((s) => {
    const cls = s === currentStyle ? "active" : ""
    return `<a class="${cls}" href="/u/${esc(handle)}/share?style=${s}">${esc(POSTER_STYLE_LABELS[s])}</a>`
  }).join("")
  return Layout({
    title: `${displayName} 的海报 · 中国博物馆地图`,
    head: `<style>${css}</style>`,
    children: `
      <div class="share-header">
        <h1>${esc(displayName)} · 足迹海报</h1>
        <a href="/u/${esc(handle)}">← 返回主页</a>
      </div>
      <div class="styles">${styleChips}</div>
      <div class="poster-frame">
        <div class="loading">
          <div class="ring"></div>
          <div class="step">检索你的足迹</div>
          <div class="bar"><i></i></div>
          <div class="quip">正在让 Claude 翻一翻你走过的博物馆…</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn" id="btn-png">保存为图片</button>
        <button class="btn ghost" id="btn-svg">下载 SVG</button>
      </div>
      <div class="hint">长按图片或点击「保存为图片」即可分享</div>
      <script>${script}</script>
    `,
  })
}
