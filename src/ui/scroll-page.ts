// 寄 · the 手卷 page. A vertical scroll of paper between two rollers: 签条, 引首, 画心,
// 题跋, 鉴藏印, 观款, 卷尾. All narration is rendered on the server (WeChat crawlers and
// devices without WebGL read the whole thing); the client only replays the 画心.
import type { BuiltScroll } from "~/services/scroll-narration"
import type { MuseumListItem, DynastyFull } from "~/repo/types"
import { Layout, THEME_BAR } from "./layout"
import { STRATA_SRC, TERRITORY_SRC } from "~/routes/assets"
import { DYNASTY_GEO } from "~/data/dynasty-geo"
import { computeCrossings } from "~/services/crossings"
import { eraShort } from "~/services/scroll-text"

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export interface ScrollPageData {
  id: string
  built: BuiltScroll
  guan: { count: number; items: { name: string | null; at: number }[] }
  museums: MuseumListItem[]
  dynasties: DynastyFull[]
}

// Runs after THEME_BOOT in Layout: this page is always 宣纸, without touching the saved mmTheme.
const FORCE_PAPER = `<script>document.documentElement.setAttribute('data-theme','paper');(function(){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','${THEME_BAR.paper}')})();</script>`

function sealSpan(chars: string, shape = "sq", yin = true, rot = -4, cls = ""): string {
  const n = Math.min(4, Array.from(chars).length)
  return `<span class="seal seal-${shape} seal-n${n} ${yin ? "seal-yin" : "seal-yang"} ${cls}" style="--r:${rot}deg"><span class="seal-t">${esc(chars)}</span></span>`
}

function museumSeal(m: { name: string; seal?: { t: string; s: number; y: number; r: number } }): string {
  const s = m.seal || { t: m.name.slice(0, 2), s: 0, y: 1, r: -6 }
  return sealSpan(s.t, ["sq", "rd", "ci", "ov"][s.s] || "sq", !!s.y, s.r)
}

function guanItems(items: { name: string | null }[]): string {
  return items
    .map((g) => `<li><span class="guan-seal">观</span><span class="guan-name">${esc(g.name || "某君")} 观</span></li>`)
    .join("")
}

const noteHtml = (n: BuiltScroll["notes"][number]): string => `
<li class="juan-note" data-dyn="${esc(n.dynastyId)}">
  <h3>${esc(n.title)}<small>${esc(n.period)}</small></h3>
  ${n.lines.map((l) => `<p>${esc(l)}</p>`).join("")}
  ${n.tunes.map((t) => `<p class="tune" data-tune="${esc(t.name)}"><b>《${esc(t.name)}》</b> · ${esc(t.story)}<small>${esc(t.from)}</small></p>`).join("")}
  ${n.seen ? `<p class="seen">${esc(n.seen)}</p>` : ""}
</li>`

export function ScrollPage(d: ScrollPageData): string {
  const b = d.built
  const hasStrata = b.kind !== "seal"
  const play = b.kind === "tune" || b.kind === "voyage"
  const museumById = new Map(d.museums.map((m) => [m.id, m]))
  const eraNames: Record<string, string> = {}
  d.dynasties.forEach((x) => { eraNames[x.id] = eraShort(x.name) })

  const boot = JSON.stringify({
    id: d.id, kind: b.kind, seed: b.seed, era: b.era, visitedIds: b.visitedIds,
    museums: d.museums, dynasties: d.dynasties,
    dynastyGeo: DYNASTY_GEO, crossings: computeCrossings(d.museums, d.dynasties),
    territoryUrl: TERRITORY_SRC, eraNames,
  }).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e")

  const sealsShown = b.seals.slice(0, 24)
  const sealsMore = b.seals.length - sealsShown.length
  const slipLen = Array.from(b.slip).length

  const heart = b.kind === "seal" && b.seal
    ? `<section class="juan-heart juan-heart-seal" id="heart">
  <div class="juan-sealmark" aria-hidden="true">${sealSpan(b.seal.seal, "sq", true, -3, "seal-xl")}</div>
  <h2>${esc(b.seal.labelTitle)}</h2>
  <div class="label">${esc(b.seal.label)}</div>
  <p class="why">${esc(b.seal.why)}</p>
  ${b.seal.seen.length ? `<p class="seen">所见 · ${b.seal.seen.map(esc).join("、")}</p>` : ""}
</section>`
    : `<section class="juan-heart" id="heart">
  <div class="heart-label"><span>画心</span></div>
  <div id="strata" class="strata-wrap juan-strata" aria-label="时空地层"></div>
  ${b.notes.length ? `<ol class="juan-notes" id="notes">${b.notes.map(noteHtml).join("")}</ol>` : ""}
</section>`

  const script = `
(function(){
  var B = JSON.parse(document.getElementById('juan-boot').textContent);
  var $ = function(s, r){ return (r || document).querySelector(s); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var notes = Array.prototype.slice.call(document.querySelectorAll('.juan-note'));
  var notesEl = document.getElementById('notes');
  var openBtn = $('.juan-open');
  var played = false;

  function noteFor(id){ for (var i = 0; i < notes.length; i++) if (notes[i].getAttribute('data-dyn') === id) return notes[i]; return null; }
  function reveal(li){
    if (!li) return;
    notes.forEach(function(n){ n.classList.remove('is-now'); });
    li.classList.add('is-on', 'is-now');
    if (notesEl) {
      var top = li.offsetTop - notesEl.offsetTop - 8;
      try { notesEl.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' }); } catch (e) { notesEl.scrollTop = Math.max(0, top); }
    }
  }
  function resetNotes(){
    notes.forEach(function(n){ n.classList.remove('is-on', 'is-now'); });
    if (notesEl) notesEl.scrollTop = 0;
    Array.prototype.forEach.call(document.querySelectorAll('.tune'), function(t){ t.classList.remove('is-quote'); });
  }
  function finish(){
    notes.forEach(function(n){ n.classList.remove('is-now'); n.classList.add('is-on'); });
    setTimeout(function(){
      var c = $('.juan-colophon');
      if (c && c.getBoundingClientRect().top > window.innerHeight * 0.9) c.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, 1200);
  }

  var strataOk = false;
  function startStrata(){
    var el = document.getElementById('strata');
    if (!el || !window.MuseumStrata || strataOk) return;
    var ok = window.MuseumStrata.init(el, {
      museums: B.museums, dynasties: B.dynasties, geo: B.dynastyGeo, crossings: B.crossings,
      territoryUrl: B.territoryUrl, guest: true, theme: 'paper'
    }, {
      onTuneEra: function(id, quote){
        var li = noteFor(id);
        reveal(li);
        if (quote && li) Array.prototype.forEach.call(li.querySelectorAll('.tune'), function(t){ if (t.getAttribute('data-tune') === quote) t.classList.add('is-quote'); });
      },
      onTuneEnd: function(){ finish(); },
      onVoyage: function(id){ if (id === 'end') finish(); else if (id !== 'open') reveal(noteFor(id)); }
    });
    if (!ok) { noGl(); return; }
    strataOk = true;
    window.MuseumStrata.update({ mode: 'all', visitedIds: B.visitedIds, selectedId: null, candidates: [] });
    window.MuseumStrata.setActive(true);
  }
  function noGl(){
    var el = document.getElementById('strata');
    if (el) el.style.display = 'none';
    var heart = document.getElementById('heart');
    if (heart && !heart.querySelector('.juan-nogl')) { var p = document.createElement('p'); p.className = 'juan-nogl'; p.textContent = '此处画心，需在支持 3D 的设备上展开'; heart.insertBefore(p, notesEl || null); heart.classList.add('is-flat'); }
    notes.forEach(function(n){ n.classList.add('is-on'); });
    if (openBtn && (B.kind === 'tune' || B.kind === 'voyage')) openBtn.style.display = 'none';
  }
  if (B.kind !== 'seal') {
    if (window.MuseumStrata) startStrata(); else window.addEventListener('strata-ready', startStrata, { once: true });
    setTimeout(function(){ if (!window.MuseumStrata && !strataOk) noGl(); }, 9000);
  }

  if (openBtn) openBtn.addEventListener('click', function(){
    var heart = document.getElementById('heart');
    if (heart) heart.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    if (B.kind !== 'tune' && B.kind !== 'voyage') return;
    if (!strataOk || !window.MuseumStrata) return;
    window.MuseumStrata.stop();
    resetNotes();
    setTimeout(function(){
      if (B.kind === 'tune') window.MuseumStrata.play({ seed: B.seed, era: B.era });
      else window.MuseumStrata.voyage();
    }, played ? 150 : (reduce ? 0 : 600));
    played = true;
    openBtn.textContent = '重展';
    openBtn.classList.add('is-again');
  });

  // 题跋 / 印章 settle in as they come into view
  var stampEls = Array.prototype.slice.call(document.querySelectorAll('.juan-sealmark .seal, .juan-seals .seal, .juan-colophon'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { threshold: 0.3 });
    stampEls.forEach(function(e){ e.classList.add('will-in'); io.observe(e); });
  }

  // 观款
  var guanList = $('.juan-guan ul'), guanCount = $('.guan-count'), guanForm = $('.guan-form'), guanMsg = $('.guan-msg');
  function renderGuan(g, fresh){
    if (!guanList) return;
    guanList.innerHTML = '';
    (g.items || []).forEach(function(it, i){
      var li = document.createElement('li');
      var s = document.createElement('span'); s.className = 'guan-seal' + (fresh && i === 0 ? ' is-fresh' : ''); s.textContent = '观';
      var n = document.createElement('span'); n.className = 'guan-name'; n.textContent = (it.name || '某君') + ' 观';
      li.appendChild(s); li.appendChild(n); guanList.appendChild(li);
    });
    if (guanCount) guanCount.textContent = g.count ? '已有 ' + g.count + ' 人观' : '尚无人观，你来钤第一方';
  }
  function already(){ if (guanForm) guanForm.innerHTML = '<p class="guan-done">你已钤过</p>'; }
  var flag = false; try { flag = !!localStorage.getItem('mmGuan:' + B.id); } catch (e) {}
  if (flag) already();
  else if (guanForm) guanForm.addEventListener('submit', function(ev){
    ev.preventDefault();
    var btn = guanForm.querySelector('button'), inp = guanForm.querySelector('input');
    var name = (inp.value || '').trim();
    btn.disabled = true;
    fetch('/api/s/' + B.id + '/guan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name }) })
      .then(function(r){ return r.json().then(function(j){ return { s: r.status, j: j }; }); })
      .then(function(r){
        if (r.s === 200) { try { localStorage.setItem('mmGuan:' + B.id, '1'); } catch (e) {} renderGuan(r.j, true); already(); }
        else if (r.s === 409) { try { localStorage.setItem('mmGuan:' + B.id, '1'); } catch (e) {} already(); }
        else { btn.disabled = false; if (guanMsg) guanMsg.textContent = (r.j && r.j.error) || '稍后再试'; }
      })
      .catch(function(){ btn.disabled = false; if (guanMsg) guanMsg.textContent = '稍后再试'; });
  });

  // 同游
  function tongyou(mine){
    var theirs = {}; B.visitedIds.forEach(function(id){ theirs[id] = 1; });
    var mineSet = {}; mine.forEach(function(id){ mineSet[id] = 1; });
    var shared = [];
    B.dynasties.forEach(function(d){
      var ids = [].concat(d.recommendedMuseums || [], d.relatedMuseums || []).map(function(r){ return r.museumId; });
      var a = ids.some(function(i){ return mineSet[i]; }), t = ids.some(function(i){ return theirs[i]; });
      if (a && t) shared.push(B.eraNames[d.id] || d.name);
    });
    var el = $('.tongyou');
    if (!shared.length || !el) return;
    el.textContent = '你与 TA 同游 ' + shared.slice(0, 6).join('·') + (shared.length > 6 ? ' 等 ' + shared.length + ' 层' : '');
    el.hidden = false;
  }
  var mine = [];
  try { mine = JSON.parse(localStorage.getItem('museumAnonVisits') || '[]').map(function(v){ return v && v.museumId; }).filter(Boolean); } catch (e) {}
  tongyou(mine);
  fetch('/api/visits', { credentials: 'include' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
    if (j && j.items && j.items.length) tongyou(mine.concat(j.items.map(function(x){ return x.museumId; })));
  }).catch(function(){});
})();
`

  const head = `
  <meta name="description" content="${esc(b.colophon)}" />
  <meta property="og:title" content="${esc(b.title)}" />
  <meta property="og:description" content="${esc(b.colophon)}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="中国博物馆地图" />
  ${FORCE_PAPER}
  <style>${PAGE_CSS}</style>`

  return Layout({
    title: esc(b.title),
    head,
    children: `
<main class="juan juan-${b.kind}">
  <div class="juan-rod" aria-hidden="true"></div>
  <div class="juan-sheet">
    <header class="juan-top">
      <div class="juan-slip" style="--n:${slipLen}"><span class="slip-text">${esc(b.slip)}</span></div>
      <p class="juan-season">${esc(b.season.text)}<small>—— ${esc(b.season.src)}</small></p>
      <h1 class="juan-yinshou" aria-label="${esc(b.yinshou)}">${Array.from(b.yinshou).map((c) => `<span>${esc(c)}</span>`).join("")}</h1>
      <button class="juan-open" type="button">展卷</button>
      <div class="juan-hint" aria-hidden="true">${play ? "轻点展卷，听这一卷" : "向下展开"}<i></i></div>
    </header>
    ${heart}
    <section class="juan-colophon">
      <div class="colo-v">
        <p class="colo">${esc(b.colophon)}</p>
        ${b.line ? `<p class="own">${esc(b.line)}</p>` : ""}
      </div>
    </section>
    ${sealsShown.length ? `<section class="juan-seals" aria-label="鉴藏印">
      <div class="seals-kicker">鉴藏印</div>
      <div class="seals-row">${sealsShown.map((s) => `<span class="seal-slot" title="${esc(s.name)}">${museumSeal(museumById.get(s.id) || { name: s.name })}</span>`).join("")}</div>
      ${sealsMore > 0 ? `<p class="seals-more">等 ${sealsMore} 方</p>` : ""}
    </section>` : ""}
    <section class="juan-guan">
      <div class="seals-kicker">观款</div>
      <ul>${guanItems(d.guan.items)}</ul>
      <p class="guan-count">${d.guan.count ? `已有 ${d.guan.count} 人观` : "尚无人观，你来钤第一方"}</p>
      <p class="tongyou" hidden></p>
      <form class="guan-form" autocomplete="off">
        <input type="text" maxlength="8" placeholder="留个名字（可不填）" aria-label="名字" style="font-size:16px" />
        <button type="submit">钤一方「观」</button>
      </form>
      <p class="guan-msg" role="status"></p>
    </section>
    <footer class="juan-tail"><a href="/">展开你自己的一卷</a><small>中国博物馆地图</small></footer>
  </div>
  <div class="juan-rod" aria-hidden="true"></div>
</main>
<script id="juan-boot" type="application/json">${boot}</script>
${hasStrata ? `<script type="module" src="${STRATA_SRC}"></script>` : ""}
<script>${script}</script>`,
  })
}

export function LostPage(): string {
  return Layout({
    title: "此卷已佚",
    head: `${FORCE_PAPER}<meta name="robots" content="noindex" /><style>${PAGE_CSS}</style>`,
    children: `<main class="juan juan-lost"><div class="juan-rod"></div><div class="juan-sheet">
  <div class="lost"><h1>此卷已佚</h1><p>链接已失效，或这一卷从未寄出。</p></div>
  <footer class="juan-tail"><a href="/">展开你自己的一卷</a></footer>
</div><div class="juan-rod"></div></main>`,
  })
}

const PAGE_CSS = `
html, body { height: auto; overflow: auto; }
body { margin: 0; background: var(--surface-3); color: var(--text); font-family: var(--serif); -webkit-font-smoothing: antialiased; }
.juan { max-width: 640px; margin: 0 auto; padding: 0 0 max(24px, env(safe-area-inset-bottom)); }
.juan-rod {
  position: relative; z-index: 2; height: 16px; margin: 0 -10px; border-radius: 8px;
  background: linear-gradient(180deg, #8c6a43 0%, #6a4a2b 38%, #4d3320 70%, #3a2616 100%);
  box-shadow: 0 2px 5px rgba(84,62,32,.35), inset 0 1px 0 rgba(255,235,200,.28);
}
.juan-rod::before, .juan-rod::after { content: ""; position: absolute; top: -2px; bottom: -2px; width: 10px; background: linear-gradient(180deg,#a98350,#5a3d22 60%,#3a2616); border-radius: 4px; }
.juan-rod::before { left: -4px; } .juan-rod::after { right: -4px; }
.juan-sheet {
  position: relative; background-color: var(--bg-2); padding: 0 clamp(22px, 7vw, 56px);
  box-shadow: inset 12px 0 18px -14px rgba(84,62,32,.35), inset -12px 0 18px -14px rgba(84,62,32,.35);
  background-image: radial-gradient(120% 40% at 50% 0%, rgba(255,255,255,.55), transparent 70%);
}
.juan-sheet > section, .juan-sheet > header, .juan-sheet > footer { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }

/* 签条 + 引首 */
.juan-top { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 44px 0 40px; min-height: calc(100dvh - 40px); box-sizing: border-box; justify-content: center; }
.juan-slip {
  align-self: flex-end; margin: 0 4px 28px 0; padding: 14px 8px; background: #F6EBCF; border: 1px solid rgba(152,113,44,.45);
  box-shadow: 0 0 0 3px #F6EBCF, 0 0 0 4px rgba(152,113,44,.3), 0 3px 8px rgba(84,62,32,.18);
  writing-mode: vertical-rl; max-height: 11em; font-size: 19px; letter-spacing: .28em; font-weight: 700; color: var(--text); line-height: 1.5;
}
.juan-season { margin: 0 0 34px; font-size: 15px; line-height: 2; letter-spacing: .12em; color: var(--text-2); }
.juan-season small { display: block; margin-top: 4px; font-size: 11.5px; letter-spacing: .1em; color: var(--text-4); }
.juan-yinshou { margin: 0 0 38px; display: flex; gap: .18em; font-weight: 900; font-size: clamp(46px, 15vw, 68px); letter-spacing: 0; line-height: 1.1; color: var(--text); }
.juan-yinshou span { display: block; }
.juan-open {
  appearance: none; cursor: pointer; border: 1px solid var(--seal); background: var(--seal); color: #FFF4EC;
  font-family: var(--serif); font-size: 18px; font-weight: 700; letter-spacing: .5em; padding: 13px 22px 13px calc(22px + .5em);
  border-radius: 3px; box-shadow: 0 6px 18px -8px rgba(var(--seal-rgb), .8), inset 0 0 0 3px rgba(255,244,236,.28);
  transition: transform .2s, background .2s;
}
.juan-open:hover { background: var(--seal-deep); } .juan-open:active { transform: scale(.97); }
.juan-open.is-again { background: transparent; color: var(--seal-deep); box-shadow: none; }
.juan-hint { margin-top: 26px; font-size: 12px; letter-spacing: .3em; color: var(--text-4); display: flex; flex-direction: column; align-items: center; gap: 8px; }
.juan-hint i { width: 1px; height: 38px; background: linear-gradient(var(--text-4), transparent); }

/* 画心 */
.juan-heart { padding: 0 0 56px; scroll-margin-top: 16px; }
.heart-label, .seals-kicker { text-align: center; font-size: 12px; letter-spacing: .6em; color: var(--text-4); margin: 0 0 18px; padding-left: .6em; }
.heart-label span { display: inline-block; padding: 0 14px; position: relative; }
.heart-label span::before, .heart-label span::after { content: ""; position: absolute; top: 50%; width: 28px; height: 1px; background: var(--text-4); opacity: .5; }
.heart-label span::before { right: 100%; } .heart-label span::after { left: 100%; }
.juan-strata { position: relative; height: min(56vh, 500px); border-radius: 6px; border: 1px solid rgba(152,113,44,.35); box-shadow: inset 0 0 0 4px var(--bg-2), inset 0 0 0 5px rgba(152,113,44,.25); }
.juan-notes { list-style: none; margin: 18px 0 0; padding: 4px 4px 4px 0; max-height: min(30vh, 300px); overflow-y: auto; -webkit-overflow-scrolling: touch;
  -webkit-mask-image: linear-gradient(transparent 0, #000 14px, #000 calc(100% - 22px), transparent); mask-image: linear-gradient(transparent 0, #000 14px, #000 calc(100% - 22px), transparent); }
.juan-note { padding: 12px 0 14px; border-bottom: 1px solid rgba(152,113,44,.16); opacity: .35; transition: opacity .6s; }
.juan-note.is-on { opacity: 1; }
.juan-note.is-now h3 { color: var(--seal-deep); }
.juan-note h3 { margin: 0 0 6px; font-size: 18px; font-weight: 900; letter-spacing: .06em; display: flex; align-items: baseline; gap: 10px; transition: color .4s; }
.juan-note h3 small { font-family: var(--mono); font-weight: 400; font-size: 11px; letter-spacing: 0; color: var(--text-4); }
.juan-note p { margin: 3px 0; font-size: 14px; line-height: 1.85; color: var(--text-2); overflow-wrap: anywhere; }
.juan-note .tune { margin-top: 8px; padding-left: 12px; border-left: 2px solid rgba(152,113,44,.4); }
.juan-note .tune b { color: var(--text); }
.juan-note .tune small { display: block; font-size: 12px; color: var(--text-4); margin-top: 2px; }
.juan-note .tune.is-quote { border-left-color: var(--seal); background: linear-gradient(90deg, rgba(var(--seal-rgb), .07), transparent); }
.juan-note .tune.is-quote b { color: var(--seal-deep); }
.juan-note .seen { font-size: 12.5px; color: var(--seal-ink); letter-spacing: .04em; }
.juan-nogl { text-align: center; color: var(--text-3); font-size: 14px; letter-spacing: .12em; padding: 22px 0 6px; }
.juan-heart.is-flat .juan-notes { max-height: none; -webkit-mask-image: none; mask-image: none; }
.juan-heart-seal { text-align: center; padding: 20px 0 56px; }
.juan-sealmark { display: flex; justify-content: center; margin: 12px 0 34px; min-height: 190px; align-items: center; }
.seal-xl { font-size: 60px; }
.juan-heart-seal h2 { margin: 0 0 14px; font-size: 26px; font-weight: 900; letter-spacing: .24em; padding-left: .24em; }
.juan-heart-seal .label { font-size: 15px; line-height: 2.05; color: var(--text-2); text-align: left; overflow-wrap: anywhere; white-space: pre-wrap; }
.juan-heart-seal .why { font-size: 13.5px; line-height: 1.95; color: var(--text-3); margin: 18px 0 0; text-align: left; overflow-wrap: anywhere; }
.juan-heart-seal .seen { font-size: 13px; letter-spacing: .06em; color: var(--seal-ink); margin: 22px 0 0; overflow-wrap: anywhere; }

/* 题跋 */
.juan-colophon { padding: 48px 0 60px; border-top: 1px solid rgba(152,113,44,.25); }
.colo-v { text-align: left; }
.colo { margin: 0; font-size: 17px; line-height: 2.15; letter-spacing: .1em; color: var(--text); overflow-wrap: anywhere; }
.own { margin: 18px 0 0; font-size: 15px; line-height: 2; color: var(--text-2); letter-spacing: .06em; overflow-wrap: anywhere; }
.own::before { content: "「"; } .own::after { content: "」"; }

/* 鉴藏印 */
.juan-seals { padding: 0 0 56px; text-align: center; }
.seals-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px 12px; }
.seals-row .seal { font-size: 11px; }
.seal-slot { display: inline-flex; }
.seals-more { margin: 16px 0 0; font-size: 12.5px; color: var(--text-4); letter-spacing: .2em; }

/* 观款 */
.juan-guan { padding: 44px 0 52px; border-top: 1px solid rgba(152,113,44,.25); text-align: center; }
.juan-guan ul { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 22px; }
.juan-guan li { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-2); letter-spacing: .08em; }
.guan-seal { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 3px; background: var(--seal); color: #FFF4EC; font-weight: 900; font-size: 13px; box-shadow: inset 0 0 0 2px rgba(255,244,236,.45); transform: rotate(-4deg); }
.guan-seal.is-fresh { animation: juan-stamp .6s cubic-bezier(.2,1.4,.4,1) both; }
.guan-name { overflow-wrap: anywhere; }
.guan-count { margin: 0; font-size: 13px; letter-spacing: .2em; color: var(--text-3); }
.tongyou { margin: 14px 0 0; font-size: 14px; letter-spacing: .14em; color: var(--seal-ink); }
.tongyou[hidden] { display: none; }
.guan-form { margin-top: 30px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.guan-form input { width: min(100%, 260px); text-align: center; font-family: var(--serif); letter-spacing: .12em; color: var(--text); background: transparent; border: 0; border-bottom: 1px solid var(--text-4); padding: 8px 4px; border-radius: 0; outline: none; }
.guan-form input:focus { border-bottom-color: var(--seal); }
.guan-form button { appearance: none; cursor: pointer; font-family: var(--serif); font-size: 15px; font-weight: 700; letter-spacing: .2em; padding: 10px 24px; border: 1px solid var(--seal); color: var(--seal-deep); background: transparent; border-radius: 3px; transition: background .2s, color .2s; }
.guan-form button:hover:not(:disabled) { background: var(--seal); color: #FFF4EC; }
.guan-form button:disabled { opacity: .5; }
.guan-done { margin: 0; font-size: 14px; letter-spacing: .3em; color: var(--text-3); }
.guan-msg { min-height: 1.4em; margin: 10px 0 0; font-size: 13px; color: var(--seal-deep); }

/* 卷尾 */
.juan-tail { padding: 40px 0 64px; text-align: center; border-top: 1px solid rgba(152,113,44,.25); }
.juan-tail a { font-size: 19px; font-weight: 900; letter-spacing: .3em; padding-left: .3em; color: var(--seal-deep); text-decoration: none; border-bottom: 1px solid rgba(var(--seal-rgb), .45); padding-bottom: 6px; }
.juan-tail small { display: block; margin-top: 26px; font-family: var(--mono); font-size: 10px; letter-spacing: .3em; color: var(--text-4); }
.lost { text-align: center; padding: 22vh 0 14vh; } .lost h1 { font-size: 34px; letter-spacing: .4em; padding-left: .4em; margin: 0 0 18px; } .lost p { color: var(--text-3); letter-spacing: .12em; }

@keyframes juan-stamp { 0% { transform: rotate(14deg) scale(1.9); opacity: 0; } 60% { opacity: 1; } 100% { transform: rotate(var(--r,-4deg)) scale(1); opacity: 1; } }
.juan-sealmark .seal.will-in, .juan-seals .seal.will-in { opacity: 0; }
.juan-sealmark .seal.is-in { animation: juan-stamp .6s cubic-bezier(.2,1.3,.4,1) both; }
.juan-seals .seal.is-in { animation: juan-stamp .5s cubic-bezier(.2,1.3,.4,1) both; }
.juan-colophon.will-in { opacity: 0; transform: translateY(14px); }
.juan-colophon.is-in { opacity: 1; transform: none; transition: opacity 1.2s, transform 1.2s; }

@media (min-width: 900px) {
  .juan { max-width: 700px; }
  .juan-yinshou { writing-mode: vertical-rl; flex-direction: row; font-size: 66px; gap: 0; }
  .juan-yinshou span { display: inline; }
  .juan-top { min-height: calc(100vh - 40px); }
  .colo-v { writing-mode: vertical-rl; height: 13em; width: fit-content; margin: 0 auto; display: flex; flex-direction: column; gap: 1.6em; text-align: start; }
  .colo { font-size: 20px; line-height: 2.2; letter-spacing: .16em; }
  .own { margin: 0; font-size: 16px; }
  .own::before, .own::after { content: none; }
}
@media (max-width: 520px) { .juan-strata .strata-hint { display: none; } .colo { font-size: 16px; letter-spacing: .05em; } .juan-yinshou { letter-spacing: .02em; } .juan-strata { height: 42vh; } .juan-notes { max-height: 30vh; } }
@media (prefers-reduced-motion: reduce) {
  .juan-sealmark .seal.is-in, .juan-seals .seal.is-in, .guan-seal.is-fresh { animation: none; }
  .juan-colophon.will-in { opacity: 1; transform: none; } .juan-note { transition: none; }
}
`
