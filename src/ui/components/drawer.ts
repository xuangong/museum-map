export function Drawer(): string {
  return `<aside class="drawer" :class="drawer.open ? 'open' : ''" @click="onDrawerClick($event)">
  <div class="drawer-folio">
    <div class="label" x-text="drawer.kind === 'dynasty' ? 'Dynasty Profile' : 'Museum File'"></div>
    <div style="display:flex;align-items:center;gap:8px;">
      <button class="share-btn" @click="shareCurrent()" title="分享链接" aria-label="Share">↗ 分享</button>
      <button class="close" @click="closeDrawer()">×</button>
    </div>
  </div>

  <div x-show="drawer.loading" class="drawer-loading">Opening dossier…</div>
  <div x-show="drawer.error" class="drawer-error">
    Could not load. <a href="#" @click.prevent="reloadDrawer()">Retry</a>
  </div>

  <div x-show="!drawer.loading && !drawer.error">
    <div class="drawer-hero">
      <div class="kicker" x-text="drawer.kind === 'dynasty' ? 'Dynasty · 朝代' : 'Museum · 馆'"></div>
      <h2 class="title" x-text="drawer.title"></h2>
      <div class="subtitle" x-text="drawer.subtitle"></div>
    </div>

    <template x-for="section in drawer.sections" :key="section.title">
      <div class="drawer-section">
        <h3 x-text="section.title"></h3>
        <div class="body" x-html="section.html"></div>
      </div>
    </template>

    <template x-if="drawer.kind === 'dynasty' && drawer.dynastyId">
      <div class="drawer-section" x-data="{ get rev(){ return dynastyReviewState(drawer.dynastyId); } }">
        <h3>AI · 朝代评价</h3>
        <div class="body">
          <p class="dynasty-overview" x-show="!rev.summary && !rev.loading && rev.relevantVisitCount === 0">
            打卡这个朝代相关的博物馆后，AI 会为你生成一段属于你的朝代评价。
          </p>
          <p class="dynasty-overview" x-show="!rev.summary && !rev.loading && rev.relevantVisitCount > 0">
            你已打卡 <strong x-text="rev.relevantVisitCount"></strong> / <strong x-text="rev.totalRelevant"></strong> 座该朝代相关馆。点击下方按钮，让 AI 为你写一段。
          </p>
          <p class="dynasty-overview" style="font-style:italic;color:var(--ink-mid);" x-show="rev.loading">…AI 正在阅读你的足迹</p>
          <div class="footprint-review md" x-show="rev.summary && !rev.loading" x-html="window.MuseumChat.renderMarkdown(rev.summary)"></div>
          <p class="dynasty-overview" style="margin-top:10px;font-size:13px;font-weight:600;color:var(--paper);background:var(--vermilion);padding:8px 12px;border-radius:2px;" x-show="rev.stale && rev.summary && !rev.loading">
            足迹有更新，可重新生成
          </p>
          <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:14px;">
            <button @click="loadDynastyReview(drawer.dynastyId)"
                    :disabled="rev.loading || rev.relevantVisitCount === 0"
                    :style="rev.stale && rev.summary ? 'border:none;background:var(--vermilion);font-family:var(--sans);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:var(--paper);padding:8px 14px;cursor:pointer;border-radius:2px;font-weight:600;' : 'border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--vermilion);padding:0;cursor:pointer;border-bottom:0.5px solid var(--vermilion);padding-bottom:2px;'">
              <span x-show="!rev.summary">✨ 生成 AI 评价</span>
              <span x-show="rev.summary && !rev.stale">↻ 重新生成</span>
              <span x-show="rev.summary && rev.stale">↻ 立即更新评价</span>
            </button>
            <button x-show="rev.summary && !rev.loading"
                    @click="exportDynastyPoster(drawer.dynastyId)"
                    :disabled="rev.exporting"
                    style="border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--vermilion);padding:0;cursor:pointer;border-bottom:0.5px solid var(--vermilion);padding-bottom:2px;">
              <span x-show="!rev.exporting">📥 导出长图</span>
              <span x-show="rev.exporting">…生成中</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</aside>`
}
