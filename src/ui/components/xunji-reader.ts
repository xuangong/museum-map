/** 循迹 杂志: the feature reader — cover, 导语, acts, then the end (回放 · 停站表 · 行程).
 *  endHtml is the panel's existing end card, so the timetable and 变成行程 are shared. */
export function XunjiReader(endHtml: string): string {
  return `<article class="xj-mag" :style="'--era:' + xunjiAccent()" @scroll.passive="xunjiOnScroll($event)">
  <header class="mag-cover">
    <template x-if="xunji.thread.cover">
      <img :src="xunji.thread.cover.src" :alt="xunji.thread.cover.work" :width="xunji.thread.cover.w" :height="xunji.thread.cover.h" :style="xunji.thread.cover.focus ? 'object-position:' + xunji.thread.cover.focus : ''" loading="eager" decoding="async">
    </template>
    <div class="mag-cover-text">
      <div class="mag-kick" x-text="xunjiKick()"></div>
      <h1 class="mag-title" x-text="xunji.thread.mag || xunji.thread.title"></h1>
      <p class="mag-deck" x-text="xunji.thread.deck"></p>
    </div>
    <div class="mag-credit"><a :href="xunji.thread.cover && xunji.thread.cover.commons || null" target="_blank" rel="noopener" x-text="xunjiCredit(xunji.thread.cover)"></a></div>
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
          <blockquote class="mag-quote" x-show="a.quote && n === (a.quote.at != null ? a.quote.at : a.body.length - 1)"><span x-text="a.quote ? a.quote.text : ''"></span><cite x-text="a.quote ? a.quote.source : ''"></cite></blockquote>
        </div>
      </template>
      <template x-if="a.image">
        <figure class="mag-fig">
          <img :src="a.image.src" :alt="a.image.work" :width="a.image.w" :height="a.image.h" loading="lazy" decoding="async">
          <figcaption><a :href="a.image.commons || null" target="_blank" rel="noopener" x-text="xunjiCredit(a.image)"></a></figcaption>
        </figure>
      </template>
    </section>
  </template>
  <footer class="mag-end">
    <button type="button" class="xj-cta" @click="xunjiReplay()">▶ 快速回放这一路</button>
    ${endHtml}
  </footer>
</article>`
}
