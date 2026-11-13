import { icon } from "../icons"

// Museum / dynasty detail. Section bodies are built in app.ts (buildMuseumSections /
// buildDynastySections) as static HTML; clicks inside them are delegated through
// onDrawerClick via data-* attributes.
export function Drawer(): string {
  return `<aside class="drawer" :class="(drawer.open ? 'open' : '') + (drawer.open && !drawer.expanded ? ' peek' : '') + (drawer.scrolled ? ' scrolled' : '')"
  @click="onDrawerClick($event)" @scroll.passive="onDrawerScroll($event)" aria-label="详情">
  <div class="drawer-bar">
    <div class="drawer-bar-inner">
      <button class="drawer-grabber" @click.stop="drawer.expanded = !drawer.expanded" :aria-label="drawer.expanded ? '收起' : '展开'"></button>
      <div>
        <button class="round-btn gilt" x-show="drawer.fromShake" x-cloak @click.stop="shakeForMuseum()" :disabled="visits.shaking" title="再摇一个">
          <span :class="visits.shaking ? 'spin-wrap spinning' : 'spin-wrap'">${icon("dice", 16)}</span><span>再摇</span>
        </button>
        <button class="round-btn icon-only" x-show="drawer.fromShake" x-cloak @click.stop="toggleShakeMute()" :title="visits.muted ? '开启音效' : '静音'">
          <span x-show="visits.muted">${icon("soundOff", 16)}</span><span x-show="!visits.muted">${icon("soundOn", 16)}</span>
        </button>
      </div>
      <div>
        <button class="round-btn icon-only" @click.stop="shareCurrent()" title="分享链接" aria-label="分享">${icon("share", 16)}</button>
        <button class="round-btn icon-only" @click.stop="closeDrawer()" aria-label="关闭">${icon("close", 16)}</button>
      </div>
    </div>
  </div>

  <div x-show="drawer.loading" class="drawer-loading"><span class="spinner"></span>正在打开展柜…</div>
  <div x-show="drawer.error" class="drawer-error" x-cloak>没能打开 · <a href="#" @click.prevent="reloadDrawer()">重试</a></div>

  <div x-show="!drawer.loading && !drawer.error">
    <header class="drawer-hero" :class="drawer.heroImage ? 'has-image' : 'no-image'" x-show="!(drawer.kind === 'dynasty' && tocVisible)">
      <template x-if="drawer.heroImage">
        <figure class="hero-media artifact-image">
          <img :src="drawer.heroImage" :alt="drawer.heroAlt || drawer.title" />
          <figcaption class="artifact-image-caption" x-text="drawer.heroCredit || ''"></figcaption>
        </figure>
      </template>
      <div class="hero-glyph" aria-hidden="true" x-show="!drawer.heroImage" x-text="drawer.glyph || ''"></div>
      <div class="hero-text">
        <div class="hero-kicker" x-show="drawer.kicker" x-text="drawer.kicker"></div>
        <h2 class="hero-title" x-text="drawer.title"></h2>
        <div class="hero-sub" x-show="drawer.subtitle" x-text="drawer.subtitle"></div>
        <div class="hero-credit" x-show="drawer.heroImage && drawer.heroCredit" x-text="'封面 · ' + (drawer.heroAlt || '') + (drawer.heroCredit ? ' · ' + drawer.heroCredit : '')"></div>
      </div>
    </header>

    <template x-for="section in drawer.sections" :key="section.key || section.title">
      <section class="drawer-section" :class="section.cls || ''">
        <h3 x-show="section.title">
          <span x-text="section.title"></span>
          <span class="sec-en" x-show="section.en" x-text="section.en"></span>
          <span class="sec-count" x-show="section.count" x-text="section.count"></span>
        </h3>
        <div class="body" x-html="section.html"></div>
      </section>
    </template>

    <template x-if="drawer.kind === 'dynasty' && drawer.dynastyId">
      <section class="drawer-section sec-review" x-data="{ get rev(){ return dynastyReviewState(drawer.dynastyId); } }">
        <h3><span>讲解员 · 你的朝代读后感</span><span class="sec-en">AI NOTES</span></h3>
        <div class="body">
          <p class="guide-empty" x-show="!rev.summary && !rev.loading && rev.relevantVisitCount === 0">
            在这个朝代的地层里集到第一枚馆印后，讲解员会为你写一段属于你的朝代读后感。
          </p>
          <p class="guide-empty" x-show="!rev.summary && !rev.loading && rev.relevantVisitCount > 0">
            你已在这一层集到 <strong x-text="rev.relevantVisitCount"></strong> / <strong x-text="rev.totalRelevant"></strong> 枚馆印。让讲解员把它们串成一段属于你的读后感。
          </p>
          <p class="hero-note loading" x-show="rev.loading"><span class="dots"><i></i><i></i><i></i></span>讲解员正在阅读你的足迹</p>
          <div class="guide-card md-rich" x-show="rev.summary && !rev.loading" x-html="window.MuseumChat.renderMarkdown(rev.summary)"></div>
          <div class="notice notice--stale" x-show="rev.stale && rev.summary && !rev.loading">足迹有更新，可以重新生成。</div>
          <div class="guide-actions" x-show="!isReadOnly">
            <button class="btn" :class="(!rev.summary || rev.stale) ? 'btn-seal' : 'btn-ghost'"
                    @click="loadDynastyReview(drawer.dynastyId)"
                    :disabled="rev.loading || rev.relevantVisitCount === 0">
              ${icon("sparkle", 16)}
              <span x-show="!rev.summary">生成读后感</span>
              <span x-show="rev.summary && !rev.stale">重新生成</span>
              <span x-show="rev.summary && rev.stale">立即更新</span>
            </button>
            <button class="btn btn-ghost" x-show="rev.summary && !rev.loading" @click="exportDynastyPoster(drawer.dynastyId)" :disabled="rev.exporting">
              ${icon("download", 16)}<span x-text="rev.exporting ? '生成中…' : '导出长图'"></span>
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</aside>`
}
