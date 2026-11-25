/** 循迹 杂志: the feature reader — cover, 导语, acts, then the end (回放 · 停站表 · 行程).
 *  endHtml is the panel's existing end card, so the timetable and 变成行程 are shared. */
export function XunjiReader(endHtml: string): string {
  return `<article class="xj-mag" :style="'--era:' + xunjiAccent()" @scroll.passive="xunjiOnScroll($event)">
  <header class="mag-cover">
    <template x-if="xunji.thread.cover">
      <img :src="xunji.thread.cover.src" :alt="xunji.thread.cover.work" :style="xunji.thread.cover.focus ? 'object-position:' + xunji.thread.cover.focus : ''" loading="eager" decoding="async">
    </template>
    <div class="mag-cover-text">
      <div class="mag-kick" x-text="'循迹 · ' + xunjiEraName() + ' · ' + xunji.thread.span"></div>
      <h1 class="mag-title" x-text="xunji.thread.mag || xunji.thread.title"></h1>
      <p class="mag-deck" x-text="xunji.thread.deck"></p>
    </div>
    <div class="mag-credit" x-text="xunjiCredit(xunji.thread.cover)"></div>
  </header>
  <p class="mag-opening" x-show="xunji.thread.opening" x-text="xunji.thread.opening"></p>
  <template x-for="(a, k) in xunji.thread.acts" :key="k">
    <section class="mag-act" :data-act="k">
      <div class="mag-act-head">
        <span class="mag-num" x-text="String(k + 1).padStart(2, '0')"></span>
        <span class="mag-seal" x-text="a.place"></span>
      </div>
      <h2 class="mag-act-title" x-text="a.title"></h2>
      <div class="mag-act-span" x-text="a.span"></div>
      <template x-for="(p, n) in (a.body || [])" :key="n">
        <div>
          <p class="mag-p" x-text="p"></p>
          <blockquote class="mag-quote" x-show="a.quote && n === 0"><span x-text="a.quote ? a.quote.text : ''"></span><cite x-text="a.quote ? a.quote.source : ''"></cite></blockquote>
        </div>
      </template>
      <figure class="mag-fig" x-show="a.image">
        <img :src="a.image ? a.image.src : ''" :alt="a.image ? a.image.work : ''" loading="lazy" decoding="async">
        <figcaption x-text="a.image ? xunjiCredit(a.image) : ''"></figcaption>
      </figure>
    </section>
  </template>
  <footer class="mag-end">
    <button type="button" class="xj-cta" @click="xunjiReplay()">▶ 快速回放这一路</button>
    ${endHtml}
  </footer>
</article>`
}
