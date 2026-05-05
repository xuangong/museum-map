export function Sidebar(opts: { googleEnabled?: boolean } = {}): string {
  const googleBlock = opts.googleEnabled
    ? `<div style="margin-top:10px;">
        <button @click="doGoogleLogin()"
          style="width:100%;border:0.5px solid var(--ink);background:var(--paper);color:var(--ink);padding:8px 12px;font-family:var(--sans);font-size:12px;cursor:pointer;">使用 Google 登录</button>
      </div>`
    : ``
  const authBar = `<div style="margin-bottom:14px;border-bottom:0.5px solid var(--rule);padding-bottom:14px;">
  <template x-if="!me">
    <div>
      <div style="font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--ink-mid);margin-bottom:8px;">登录后保存到云端</div>
      <input x-model="authForm.email" type="email" placeholder="Email" autocomplete="email"
        style="width:100%;padding:8px 10px;font-size:16px;border:0.5px solid var(--rule);background:var(--paper);font-family:var(--sans);margin-bottom:6px;box-sizing:border-box;" />
      <input x-model="authForm.password" type="password" placeholder="密码（≥8 位）" autocomplete="current-password"
        style="width:100%;padding:8px 10px;font-size:16px;border:0.5px solid var(--rule);background:var(--paper);font-family:var(--sans);margin-bottom:8px;box-sizing:border-box;" />
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button @click="submitLogin()" :disabled="authForm.loading"
          style="border:none;background:var(--vermilion);color:var(--paper);padding:8px 14px;font-family:var(--sans);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;cursor:pointer;">登录</button>
        <button @click="submitRegister()" :disabled="authForm.loading"
          style="border:0.5px solid var(--vermilion);background:transparent;color:var(--vermilion);padding:8px 14px;font-family:var(--sans);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;cursor:pointer;">注册</button>
        <span x-show="authForm.loading" style="font-size:11px;color:var(--ink-mid);">…</span>
      </div>
      ${googleBlock}
      <div x-show="authForm.error" x-text="authForm.error"
        style="margin-top:8px;font-size:12px;color:var(--vermilion);"></div>
    </div>
  </template>
  <template x-if="me">
    <div>
      <div x-show="!nameForm.editing" style="display:flex;align-items:baseline;gap:6px;width:100%;overflow:hidden;font-family:var(--sans);font-size:12px;color:var(--ink-mid);">
        <span style="white-space:nowrap;">你好</span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 0;min-width:0;color:var(--ink);" x-text="(me && me.displayName) || me.email"></span>
        <button @click="startEditName()" title="编辑昵称"
          style="border:none;background:transparent;font-family:var(--sans);font-size:11px;color:var(--vermilion);cursor:pointer;padding:0;flex:0 0 auto;">✎</button>
        <a href="#" @click.prevent="doLogout()"
          style="font-family:var(--sans);font-size:11px;color:var(--vermilion);text-decoration:underline;flex:0 0 auto;white-space:nowrap;">退出</a>
      </div>
      <div x-show="nameForm.editing" x-cloak>
        <input x-model="nameForm.value" type="text" maxlength="80" placeholder="昵称（留空则显示邮箱）"
          @keydown.enter="submitDisplayName()" @keydown.escape="cancelEditName()"
          style="width:100%;padding:8px 10px;font-size:16px;border:0.5px solid var(--rule);background:var(--paper);font-family:var(--sans);margin-bottom:8px;box-sizing:border-box;" />
        <div style="display:flex;gap:8px;align-items:center;">
          <button @click="submitDisplayName()" :disabled="nameForm.loading"
            style="border:none;background:var(--vermilion);color:var(--paper);padding:6px 12px;font-family:var(--sans);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;cursor:pointer;">保存</button>
          <button @click="cancelEditName()" :disabled="nameForm.loading"
            style="border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--ink-mid);cursor:pointer;">取消</button>
          <span x-show="nameForm.error" x-text="nameForm.error" style="font-size:11px;color:var(--vermilion);"></span>
        </div>
      </div>
    </div>
  </template>
</div>`
  return `<aside class="toc">
  <!-- Footprint hero -->
  <div x-show="visits.footprintMode" x-cloak>
    <div class="toc-head">
      ${authBar}
      <div class="vol">
        Vol. <span class="num">FP</span>
        <span style="margin-left:8px;">·</span>
        <span style="margin-left:8px;font-style:italic;">My Footprints</span>
      </div>
      <h1 class="dynasty-name">我的足迹</h1>
      <div class="dynasty-period"><span style="font-variant-numeric:lining-nums;" x-text="visits.ids.length"></span> museums visited</div>
      <p class="dynasty-overview" style="margin-top:14px;" x-show="!visits.review && !visits.reviewLoading">点击下方按钮，让 AI 根据你的足迹生成一段品味画像和下一步推荐。</p>
      <p class="dynasty-overview" style="margin-top:14px;font-style:italic;color:var(--ink-mid);" x-show="visits.reviewLoading">…AI 正在阅读你的足迹</p>
      <div class="footprint-review md" style="margin-top:14px;" x-show="visits.review && !visits.reviewLoading" x-html="window.MuseumChat.renderMarkdown(visits.review)"></div>
      <p class="dynasty-overview" style="margin-top:10px;font-size:12px;color:var(--vermilion);" x-show="visits.chatDirty && visits.review && !visits.reviewLoading">
        💬 你刚和顾问聊过——可以根据这段对话更新评价与建议。
      </p>
      <p class="dynasty-overview" style="margin-top:10px;font-size:13px;font-weight:600;color:var(--paper);background:var(--vermilion);padding:8px 12px;border-radius:2px;" x-show="visits.reviewStale && !visits.chatDirty && visits.review && !visits.reviewLoading">
        ⚠️ 你又打卡了新博物馆——评价已过时，建议立即重新生成。
      </p>
      <div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;">
        <button @click="loadFootprintReview()" :disabled="visits.reviewLoading || visits.ids.length === 0"
          :style="(visits.reviewStale || visits.chatDirty) && visits.review ? 'border:none;background:var(--vermilion);font-family:var(--sans);font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:var(--paper);padding:8px 14px;cursor:pointer;border-radius:2px;font-weight:600;' : 'border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--vermilion);padding:0;cursor:pointer;border-bottom:0.5px solid var(--vermilion);padding-bottom:2px;'">
          <span x-show="!visits.review">✨ 生成 AI 评价</span>
          <span x-show="visits.review && !visits.chatDirty && !visits.reviewStale">↻ 重新生成</span>
          <span x-show="visits.review && visits.reviewStale && !visits.chatDirty">↻ 立即更新评价</span>
          <span x-show="visits.review && visits.chatDirty">↻ 根据对话更新</span>
        </button>
        <button x-show="visits.review && !visits.reviewLoading" @click="exportFootprint()" :disabled="visits.exporting"
          style="border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--vermilion);padding:0;cursor:pointer;border-bottom:0.5px solid var(--vermilion);padding-bottom:2px;">
          <span x-show="!visits.exporting">📥 导出长图</span>
          <span x-show="visits.exporting">…生成中</span>
        </button>
        <button x-show="visits.review && !visits.reviewLoading" @click="continueChatFromFootprint()"
          style="border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--vermilion);padding:0;cursor:pointer;border-bottom:0.5px solid var(--vermilion);padding-bottom:2px;">
          💬 继续聊
        </button>
        <button @click="toggleFootprint()"
          style="border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--ink-mid);padding:0;cursor:pointer;border-bottom:0.5px solid var(--ink-mid);padding-bottom:2px;">
          ← 退出足迹
        </button>
      </div>
    </div>
  </div>

  <!-- Dynasty hero (only when filtered) -->
  <div x-show="!visits.footprintMode && currentDynastyId" x-cloak>
    <div class="toc-head">
      ${authBar}
      <div class="vol">
        Vol. <span class="num" x-text="(currentDynasty() ? (dynasties.findIndex(function(x){return x.id===currentDynasty().id})+1) : 0).toString().padStart(2,'0')"></span>
        <span style="margin-left:8px;">·</span>
        <span style="margin-left:8px;font-style:italic;">Dynasty Edition</span>
      </div>
      <h1 class="dynasty-name" x-text="(currentDynasty() || {}).name || ''"></h1>
      <div class="dynasty-period" x-text="(currentDynasty() || {}).period || ''"></div>
      <div class="dynasty-overview md" x-html="window.MuseumChat.renderMarkdown((currentDynasty() || {}).overview || '')" x-show="(currentDynasty() || {}).overview"></div>
      <div class="stats">
        <div class="stat">
          <div class="num" x-text="filteredMuseums.length.toString().padStart(2,'0')"></div>
          <div class="label">Museums</div>
        </div>
        <div class="stat">
          <div class="num" x-text="(((currentDynasty()||{}).events) || []).length.toString().padStart(2,'0')"></div>
          <div class="label">Events</div>
        </div>
        <div class="stat">
          <div class="num" x-text="(((currentDynasty()||{}).culture) || []).length.toString().padStart(2,'0')"></div>
          <div class="label">Culture</div>
        </div>
      </div>
      <button @click="clearDynastyFilter()"
        style="margin-top:18px;border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--vermilion);padding:0;cursor:pointer;border-bottom:0.5px solid var(--vermilion);padding-bottom:2px;">
        ← Show all <span x-text="museums.length"></span> museums
      </button>
    </div>
  </div>

  <!-- All-museums hero (default) -->
  <div x-show="!visits.footprintMode && !currentDynastyId" x-cloak>
    <div class="toc-head">
      ${authBar}
      <div class="vol">
        Vol. <span class="num">00</span>
        <span style="margin-left:8px;">·</span>
        <span style="margin-left:8px;font-style:italic;">Complete Index</span>
      </div>
      <h1 class="dynasty-name">中国博物馆</h1>
      <div class="dynasty-period"><span style="font-style:normal;font-variant-numeric:lining-nums;" x-text="museums.length"></span> institutions across <span style="font-style:normal;font-variant-numeric:lining-nums;" x-text="dynasties.length"></span> dynasties</div>
      <p class="dynasty-overview" style="margin-top:18px;">从仰韶到清，由四面至八方。本卷收录全国 <span style="font-variant-numeric:lining-nums;" x-text="museums.length"></span> 座国家级与省级博物馆，按朝代脉络重新编排，以呈现中华文明在地理与时间双轴上的连续展开。</p>
      <button @click="toggleFootprint()" :disabled="visits.ids.length === 0"
        style="margin-top:18px;border:none;background:transparent;font-family:var(--sans);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--vermilion);padding:0;cursor:pointer;border-bottom:0.5px solid var(--vermilion);padding-bottom:2px;"
        :style="visits.ids.length === 0 ? 'color:var(--ink-mute);border-bottom-color:var(--rule);cursor:not-allowed;' : ''">
        ✦ 我的足迹（<span x-text="visits.ids.length"></span>）
      </button>
    </div>
  </div>

  <!-- Level filter chips -->
  <div class="toc-tier-chips">
    <template x-for="t in levelTiers" :key="t.id">
      <button class="tier-chip"
              :class="levelFilter === t.id ? 'active' : ''"
              @click="levelFilter = t.id">
        <span x-text="t.label"></span>
        <span class="tier-chip-count" x-text="tierCount(t.id)"></span>
      </button>
    </template>
  </div>

  <!-- Search -->
  <div class="toc-search">
    <input x-model="search" placeholder="Search museums…" />
  </div>

  <!-- Section label -->
  <div class="toc-section-label">
    <span x-text="visits.footprintMode ? 'Footprints' : (currentDynastyId ? 'Featured Museums' : 'Index')"></span>
    <span class="count" x-text="filteredMuseums.length"></span>
  </div>

  <!-- List -->
  <ul class="toc-list">
    <template x-for="(m, i) in filteredMuseums" :key="m.id">
      <li class="toc-item"
          :class="selectedMuseumId === m.id ? 'selected' : ''"
          @click="openMuseum(m.id)">
        <span class="toc-item-num" x-text="(i+1).toString().padStart(2,'0')"></span>
        <div>
          <div class="toc-item-name">
            <span x-text="m.name"></span>
            <span x-show="isVisited(m.id)" style="margin-left:6px;color:var(--vermilion);font-size:11px;">✓</span>
          </div>
          <div class="toc-item-meta" x-text="m.corePeriod || ''"></div>
        </div>
      </li>
    </template>
    <li x-show="filteredMuseums.length === 0" class="toc-empty">
      <span x-show="visits.footprintMode">还没有足迹。打开博物馆点「打卡」。</span>
      <span x-show="!visits.footprintMode">No museums match this filter.</span>
    </li>
  </ul>
</aside>`
}
