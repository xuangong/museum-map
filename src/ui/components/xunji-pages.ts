/** 循迹 翻页的「刊」: a horizontal pager of one-screen pages — cover, 目录, each chapter's composed
 *  pages, 尾页. Pages come flat from app.ts (xunjiBuildPages): { kind, ch, d, drop }.
 *  endHtml is the panel's end card, so the timetable and 变成行程 are shared. */
export function XunjiPages(endHtml: string): string {
  const cover = `<template x-if="p.kind === 'cover'">
        <div class="pgi pgi-cover">
          <template x-if="xunji.thread.cover">
            <img :src="xunji.thread.cover.src" :alt="xunji.thread.cover.work" :width="xunji.thread.cover.w" :height="xunji.thread.cover.h" :style="xunji.thread.cover.focus ? 'object-position:' + xunji.thread.cover.focus : ''" loading="eager" decoding="async">
          </template>
          <div class="pg-cover-text">
            <div class="mag-kick" x-text="xunjiKick()"></div>
            <h1 class="mag-title" x-text="xunji.thread.mag || xunji.thread.title"></h1>
            <p class="mag-deck" x-text="xunji.thread.deck"></p>
            <div class="pg-hint">翻页 →</div>
          </div>
          <div class="mag-credit"><a :href="xunji.thread.cover && xunji.thread.cover.commons || null" target="_blank" rel="noopener" x-text="xunjiCredit(xunji.thread.cover)"></a></div>
        </div>
      </template>`
  const toc = `<template x-if="p.kind === 'toc'">
        <div class="pgi pgi-toc">
          <div class="mag-kick">目录</div>
          <p class="pg-lede" x-show="xunji.thread.opening" x-text="xunji.thread.opening"></p>
          <ol class="pg-toc">
            <template x-for="(c, k) in xunjiChapters()" :key="k">
              <li><button type="button" @click="xunjiPageTo(c.at, true)">
                <span class="tc-num" x-text="c.num"></span>
                <span class="tc-body"><span class="tc-t" x-text="c.title"></span><span class="tc-m" x-text="c.place + ' · ' + c.span"></span></span>
              </button></li>
            </template>
          </ol>
        </div>
      </template>`
  const opener = `<template x-if="p.kind === 'opener'">
        <div class="pgi pgi-opener">
          <div class="op-num" x-text="p.d.num"></div>
          <div class="op-seal"><span x-text="p.d.place"></span></div>
          <h2 class="op-title" x-text="xunjiChapter(p.ch).title"></h2>
          <div class="op-span" x-text="p.d.span"></div>
          <p class="op-line" x-text="p.d.line"></p>
        </div>
      </template>`
  const text = `<template x-if="p.kind === 'text'">
        <div class="pgi pgi-text" :class="p.d.note ? 'has-note' : ''">
          <div class="tx-main">
            <template x-for="(s, j) in p.d.paras" :key="j"><p :class="p.drop && j === 0 ? 'drop' : ''" x-text="s"></p></template>
          </div>
          <template x-if="p.d.note">
            <aside class="tx-note"><b x-text="p.d.note.term"></b><span x-text="p.d.note.text"></span></aside>
          </template>
        </div>
      </template>`
  const image = `<template x-if="p.kind === 'image'">
        <figure class="pgi pgi-image" :class="xunjiFit(p.d.image, n)">
          <img :src="p.d.image.src" :alt="p.d.image.work" :width="p.d.image.w" :height="p.d.image.h" :style="p.d.image.focus ? 'object-position:' + p.d.image.focus : ''" :loading="xunjiEager(n) ? 'eager' : 'lazy'" decoding="async">
          <figcaption>
            <p x-text="p.d.caption"></p>
            <a :href="p.d.image.commons || null" target="_blank" rel="noopener" x-text="xunjiCredit(p.d.image)"></a>
          </figcaption>
        </figure>
      </template>`
  const quote = `<template x-if="p.kind === 'quote'">
        <figure class="pgi pgi-quote" :class="p.d.vertical ? 'vert' : ''">
          <blockquote x-text="p.d.text"></blockquote>
          <figcaption x-text="p.d.source"></figcaption>
        </figure>
      </template>`
  const object = `<template x-if="p.kind === 'object'">
        <div class="pgi pgi-object">
          <div class="ob-kick" x-text="p.d.kicker"></div>
          <h2 class="ob-title" x-text="p.d.title"></h2>
          <template x-for="(s, j) in p.d.paras" :key="j"><p class="ob-p" x-text="s"></p></template>
          <template x-if="p.d.image">
            <figure class="ob-fig">
              <img :src="p.d.image.src" :alt="p.d.image.work" :width="p.d.image.w" :height="p.d.image.h" :loading="xunjiEager(n) ? 'eager' : 'lazy'" decoding="async">
              <figcaption><a :href="p.d.image.commons || null" target="_blank" rel="noopener" x-text="xunjiCredit(p.d.image)"></a></figcaption>
            </figure>
          </template>
        </div>
      </template>`
  const people = `<template x-if="p.kind === 'people'">
        <div class="pgi pgi-people">
          <h2 class="pp-title" x-text="p.d.title"></h2>
          <ul class="pp-list">
            <template x-for="(m, j) in p.d.people" :key="j">
              <li>
                <span class="pp-av" x-text="m.name.charAt(0)"></span>
                <span class="pp-body"><span class="pp-name"><b x-text="m.name"></b><i x-text="m.role"></i></span><span class="pp-line" x-text="m.line"></span></span>
              </li>
            </template>
          </ul>
        </div>
      </template>`
  const map = `<template x-if="p.kind === 'map'">
        <div class="pgi pgi-map">
          <div class="xj-maphead"><span x-text="xunjiChapterNum(p.ch)"></span>这一章的路</div>
          <div class="xj-mapcap">
            <div class="mc-place" x-text="xunjiChapter(p.ch).place + ' · ' + xunjiChapter(p.ch).span"></div>
            <p x-text="p.d.text"></p>
          </div>
        </div>
      </template>`
  const end = `<template x-if="p.kind === 'end'">
        <div class="pgi pgi-end">
          <button type="button" class="xj-cta" @click="xunjiReplay()">▶ 快速回放这一路</button>
          ${endHtml}
        </div>
      </template>`
  return `<div class="xj-pages" :class="xunjiWrapClass()" :style="'--era:' + xunjiAccent()">
  <div class="xj-catch" x-show="xunji.deskOn && !xunjiOnMap()" @click="xunjiCatchClick($event)" @wheel="xunjiDeskWheel($event)"></div>
  <div class="xj-pager" @scroll.capture.passive="xunjiOnPagerScroll($event)" @click="xunjiDeskClick($event)" @wheel="xunjiDeskWheel($event)">
    <template x-for="(p, n) in xunjiPages()" :key="n">
      <section class="xj-page" :class="'pg-' + p.kind + xunjiPgClass(n)" :data-pg="n">
      ${cover}
      ${toc}
      ${opener}
      ${text}
      ${image}
      ${quote}
      ${object}
      ${people}
      ${map}
      ${end}
      </section>
    </template>
    <div class="xj-blank l" x-show="xunjiBlank('l')"><template x-if="xunjiBlankInfo()">
        <div class="xb-sheet" :class="'xb-' + xunjiBlankInfo().kind">
          <template x-if="xunjiBlankInfo().kind === 'title'">
            <div class="xb-inner"><div class="xb-vert" x-text="xunjiBlankInfo().mag"></div><span class="xb-seal" x-text="xunjiBlankInfo().who"></span><div class="xb-meta" x-text="'循迹 · ' + xunjiBlankInfo().span"></div></div>
          </template>
          <template x-if="xunjiBlankInfo().kind === 'next'">
            <div class="xb-inner"><div class="xb-ghost" x-text="xunjiBlankInfo().num"></div><div class="xb-kick">下一章</div><div class="xb-vert" x-text="xunjiBlankInfo().title"></div><span class="xb-seal" x-text="xunjiBlankInfo().place"></span><div class="xb-meta" x-text="xunjiBlankInfo().span"></div></div>
          </template>
          <template x-if="xunjiBlankInfo().kind === 'plate'">
            <div class="xb-inner"><div class="xb-kick">图版</div><div class="xb-vert sm" x-text="xunjiBlankInfo().work"></div><div class="xb-meta" x-text="xunjiBlankInfo().by"></div><div class="xb-turn">翻开 →</div></div>
          </template>
          <template x-if="xunjiBlankInfo().kind === 'colophon' || xunjiBlankInfo().kind === 'rest'">
            <div class="xb-inner"><span class="xb-seal big" x-text="xunjiBlankInfo().kind === 'colophon' ? '终' : '·'"></span><div class="xb-meta" x-text="xunjiBlankInfo().kind === 'colophon' ? (xunjiBlankInfo().mag + ' · 完') : ''"></div></div>
          </template>
        </div>
      </template></div>
    <div class="xj-blank r" x-show="xunjiBlank('r')"><template x-if="xunjiBlankInfo()">
        <div class="xb-sheet" :class="'xb-' + xunjiBlankInfo().kind">
          <template x-if="xunjiBlankInfo().kind === 'title'">
            <div class="xb-inner"><div class="xb-vert" x-text="xunjiBlankInfo().mag"></div><span class="xb-seal" x-text="xunjiBlankInfo().who"></span><div class="xb-meta" x-text="'循迹 · ' + xunjiBlankInfo().span"></div></div>
          </template>
          <template x-if="xunjiBlankInfo().kind === 'next'">
            <div class="xb-inner"><div class="xb-ghost" x-text="xunjiBlankInfo().num"></div><div class="xb-kick">下一章</div><div class="xb-vert" x-text="xunjiBlankInfo().title"></div><span class="xb-seal" x-text="xunjiBlankInfo().place"></span><div class="xb-meta" x-text="xunjiBlankInfo().span"></div></div>
          </template>
          <template x-if="xunjiBlankInfo().kind === 'plate'">
            <div class="xb-inner"><div class="xb-kick">图版</div><div class="xb-vert sm" x-text="xunjiBlankInfo().work"></div><div class="xb-meta" x-text="xunjiBlankInfo().by"></div><div class="xb-turn">翻开 →</div></div>
          </template>
          <template x-if="xunjiBlankInfo().kind === 'colophon' || xunjiBlankInfo().kind === 'rest'">
            <div class="xb-inner"><span class="xb-seal big" x-text="xunjiBlankInfo().kind === 'colophon' ? '终' : '·'"></span><div class="xb-meta" x-text="xunjiBlankInfo().kind === 'colophon' ? (xunjiBlankInfo().mag + ' · 完') : ''"></div></div>
          </template>
        </div>
      </template></div>
  </div>
  <button type="button" class="xj-turn l" @click="xunjiPageStep(-1)" :disabled="xunjiSpreadAt(-1)" aria-label="上一页">‹</button>
  <button type="button" class="xj-turn r" @click="xunjiPageStep(1)" :disabled="xunjiSpreadAt(1)" aria-label="下一页">›</button>
  <div class="xj-deskfoot">
    <span class="dk-folio" x-text="xunjiDeskFolio()"></span>
    <div class="dk-segs" role="group" aria-label="章节">
      <template x-for="sg in xunjiChapterSegs()" :key="sg.k">
        <button type="button" :class="'dk-seg' + (sg.k === xunjiCurChapter() ? ' on' : '') + (sg.k < xunjiCurChapter() ? ' past' : '')" :style="'flex:' + sg.count + ' 1 0'" :title="sg.num + ' · ' + sg.title" :aria-label="sg.num + ' ' + sg.title" @click="xunjiPageTo(sg.at, true)"></button>
      </template>
    </div>
  </div>
  <button type="button" class="xj-edge l" x-show="xunji.page > 0" @click="xunjiPageStep(-1)" aria-label="上一页" tabindex="-1"></button>
  <button type="button" class="xj-edge r" x-show="xunji.page < xunjiPages().length - 1" @click="xunjiPageStep(1)" aria-label="下一页" tabindex="-1"></button>
  <div class="xj-more" x-show="xunji.more" aria-hidden="true">↓</div>
  <div class="xj-folio" x-show="xunjiFolioOn()" aria-hidden="true"><span x-text="xunjiFolioL()"></span><span x-text="xunjiFolioR()"></span></div>
</div>`
}
