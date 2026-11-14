import { icon } from "../icons"

// The index panel: desktop sidebar / mobile slide-in sheet. Four heads share it —
// 全部 (the history book), 朝代地层 (a dynasty), 集章册 (check-in collection) and
// 行程 (route planning) — above one museum list.
export function Sidebar(opts: { googleEnabled?: boolean } = {}): string {
  const googleBlock = opts.googleEnabled
    ? `<button class="btn btn-ghost btn-block" @click="doGoogleLogin()">使用 Google 登录</button>`
    : ``

  const account = `<div class="toc-account">
  <template x-if="!me">
    <div>
      <button class="acct-toggle" @click="authOpen = !authOpen">
        <span class="acct-avatar ghost">${icon("seal", 18)}</span>
        <span class="acct-cta"><b>登录</b> · 让集章册跟着你走</span>
        <span class="acct-plus" x-text="authOpen ? '−' : '+'"></span>
      </button>
      <div class="auth-form" x-show="authOpen" x-cloak>
        <input class="field" x-model="authForm.email" type="email" placeholder="Email" autocomplete="email" />
        <input class="field" x-model="authForm.password" type="password" placeholder="密码（≥8 位）" autocomplete="current-password" />
        <div class="auth-actions">
          <button class="btn btn-primary" @click="submitLogin()" :disabled="authForm.loading">登录</button>
          <button class="btn btn-ghost" x-show="inviteCode" @click="submitRegister()" :disabled="authForm.loading">注册</button>
          <span class="auth-note" x-show="!inviteCode">注册需邀请码</span>
          <span class="auth-note" x-show="authForm.loading">…</span>
        </div>
        <div class="auth-note" x-show="inviteCode" x-cloak>已识别邀请码 <code x-text="inviteCode.slice(0,8)+'…'"></code></div>
        ${googleBlock}
        <div class="auth-error" x-show="authForm.error" x-text="authForm.error"></div>
      </div>
    </div>
  </template>
  <template x-if="me">
    <div>
      <div class="acct-row" x-show="!nameForm.editing">
        <span class="acct-avatar" x-text="((me && (me.displayName || me.email)) || '·').trim().charAt(0)"></span>
        <div class="acct-id">
          <div class="acct-name" x-text="(me && me.displayName) || me.email"></div>
          <div class="acct-handle" x-show="me && me.handle" x-text="'@' + (me && me.handle)"></div>
        </div>
        <button class="icon-btn" @click="startEditName()" title="编辑昵称">${icon("edit", 16)}</button>
      </div>
      <div class="acct-actions" x-show="!nameForm.editing">
        <button class="pill" x-show="me && me.handle" @click="copyShareLink()" title="复制公开主页链接">${icon("link", 14)}分享主页</button>
        <button class="pill" x-show="me && me.handle" :class="(me && me.showOnPlaza) ? 'on' : ''" @click="togglePlazaVisibility()"
          :title="me && me.showOnPlaza ? '当前公开在广场，点击隐藏' : '当前不在广场，点击公开'">
          <span x-show="me && me.showOnPlaza">${icon("eye", 14)}</span><span x-show="!(me && me.showOnPlaza)">${icon("eyeOff", 14)}</span>
          <span x-text="(me && me.showOnPlaza) ? '广场可见' : '广场隐藏'"></span>
        </button>
        <button class="pill" x-show="me && me.handle && !me.handleChangedAt" @click="editHandle()" title="自定义分享链接（仅可改一次，旧链接将失效）">${icon("edit", 14)}改链接</button>
        <button class="pill" x-show="me && me.isAdmin" @click="createInvite()" title="生成邀请链接">${icon("ticket", 14)}邀请</button>
        <button class="pill" @click="doLogout()">${icon("logout", 14)}退出</button>
      </div>
      <div class="name-form" x-show="nameForm.editing" x-cloak>
        <input class="field" x-model="nameForm.value" type="text" maxlength="80" placeholder="昵称（留空则显示邮箱）"
          @keydown.enter="submitDisplayName()" @keydown.escape="cancelEditName()" />
        <div class="row">
          <button class="btn btn-primary" @click="submitDisplayName()" :disabled="nameForm.loading">保存</button>
          <button class="btn btn-text" @click="cancelEditName()" :disabled="nameForm.loading">取消</button>
          <span class="auth-error" x-show="nameForm.error" x-text="nameForm.error"></span>
        </div>
      </div>
    </div>
  </template>
</div>`

  // ── 展厅灯光: which hall you visit in (theme) ──
  const hall = `<div class="hall-row">
  <span class="hall-label">${icon("lamp", 15)}<span>展厅灯光</span></span>
  <div class="hall-opts" role="radiogroup" aria-label="展厅灯光">
    <template x-for="t in themes" :key="t.id">
      <button class="hall-opt" :class="themePref === t.id ? 'active' : ''" role="radio" :aria-checked="themePref === t.id ? 'true' : 'false'"
        @click="setThemePref(t.id)" :title="t.label">
        <span class="hall-swatch" :class="'sw-' + t.id" aria-hidden="true"></span><span x-text="t.short"></span>
      </button>
    </template>
  </div>
</div>`

  // ── 集章册: the collection ──
  const stamps = `<section class="toc-hero is-stamps" x-show="visits.footprintMode && !tripMode" x-cloak>
  <div class="hero-kicker">${icon("seal", 15)}<span x-text="isReadOnly ? 'TA 的集章册' : '我的集章册'"></span><span class="mono">PASSPORT</span></div>
  <h1 class="hero-title">已集 <span class="big-num" x-text="visits.ids.length"></span> 枚馆印</h1>
  <div class="rank-line">
    <span class="rank-badge" x-text="collectorRank().title"></span>
    <span class="rank-next" x-text="collectorRank().next"></span>
  </div>
  <div class="hero-stats">
    <div class="stat"><b x-text="visits.ids.length"></b><span>座博物馆</span></div>
    <div class="stat"><b x-text="visitedDynasties().length + '/' + dynasties.length"></b><span>朝代地层</span></div>
    <div class="stat"><b x-text="visitedCityCount()"></b><span>座城市</span></div>
  </div>

  <div class="seal-wall" x-show="visits.ids.length">
    <template x-for="m in stampMuseums()" :key="m.id">
      <button class="seal-cell" @click="openMuseum(m.id)" :title="m.name">
        <span class="seal-cell-art" x-html="sealHtml(m)"></span>
        <span class="seal-cell-name" x-text="m.name"></span>
        <span class="seal-cell-date" x-text="visitDate(m.id)"></span>
      </button>
    </template>
  </div>
  <p class="hero-note" x-show="!visits.ids.length">集章册还是空的。打开任意一座博物馆，点「盖章打卡」——每座馆都有自己的一枚印。</p>

  <div class="review-block" x-show="visits.ids.length">
    <div class="block-head">${icon("sparkle", 15)}<span>讲解员的读后感</span></div>
    <p class="hero-note" x-show="!visits.review && !visits.reviewLoading">让 AI 讲解员读一读你的集章册：你偏爱哪段历史、走的是哪条线、下一站该去哪。</p>
    <p class="hero-note loading" x-show="visits.reviewLoading"><span class="dots"><i></i><i></i><i></i></span>讲解员正在翻阅你的集章册</p>
    <div class="guide-card md-rich" x-show="visits.review && !visits.reviewLoading" x-html="window.MuseumChat.renderMarkdown(visits.review)"></div>
    <div class="notice notice--chat" x-show="visits.chatDirty && visits.review && !visits.reviewLoading">你刚和讲解员聊过——可以据此更新读后感。</div>
    <div class="notice notice--stale" x-show="visits.reviewStale && !visits.chatDirty && visits.review && !visits.reviewLoading">又集了新印——读后感已经过时，更新一下吧。</div>
    <div class="hero-actions" x-show="!isReadOnly">
      <button class="btn" :class="(visits.reviewStale || visits.chatDirty || !visits.review) ? 'btn-seal' : 'btn-ghost'"
        @click="loadFootprintReview()" :disabled="visits.reviewLoading || visits.ids.length === 0">
        ${icon("sparkle", 16)}
        <span x-show="!visits.review">生成读后感</span>
        <span x-show="visits.review && !visits.chatDirty && !visits.reviewStale">重新生成</span>
        <span x-show="visits.review && visits.reviewStale && !visits.chatDirty">立即更新</span>
        <span x-show="visits.review && visits.chatDirty">根据对话更新</span>
      </button>
      <button class="btn btn-ghost" x-show="visits.review && !visits.reviewLoading" @click="exportFootprint()" :disabled="visits.exporting">
        ${icon("download", 16)}<span x-text="visits.exporting ? '生成中…' : '导出长图'"></span>
      </button>
      <button class="btn btn-ghost" x-show="visits.review && !visits.reviewLoading" @click="continueChatFromFootprint()">${icon("chat", 16)}继续聊</button>
    </div>
  </div>

  <div class="strata-progress" x-show="visits.ids.length">
    <div class="block-head">${icon("layers", 15)}<span>朝代地层 · 你读到了哪里</span></div>
    <template x-for="row in dynastyProgress()" :key="row.id">
      <button class="sp-row" :class="row.hit ? 'hit' : ''" @click="selectDynasty(row.id)">
        <span class="sp-name" x-text="row.name"></span>
        <span class="sp-bar"><i :style="'width:' + row.pct + '%'"></i></span>
        <span class="sp-num" x-text="row.hit + '/' + row.total"></span>
      </button>
    </template>
  </div>
  <div class="hero-actions">
    <button class="btn btn-text" @click="toggleFootprint()">${icon("arrowLeft", 16)}合上集章册</button>
  </div>
</section>`

  // ── 行程: route planning ──
  const trip = `<section class="toc-hero is-trip" x-show="tripMode" x-cloak>
  <div class="hero-kicker">${icon("route", 15)}<span>我的行程</span><span class="mono">ROUTE</span></div>
  <h1 class="hero-title"><span class="big-num" x-text="trip.ids.length"></span> 站</h1>
  <p class="hero-lede" x-show="!trip.ids.length">在任意一座博物馆点「加入行程」，把想去的馆串成一条路。旅行有两种走法：按地理顺路，或者按朝代先后，把一段历史从头走一遍。</p>
  <div class="hero-stats" x-show="trip.ids.length">
    <div class="stat"><b x-text="trip.ids.length"></b><span>站博物馆</span></div>
    <div class="stat"><b x-text="tripCities().length"></b><span>座城市</span></div>
    <div class="stat"><b x-text="tripTotalKm()"></b><span>公里（直线）</span></div>
  </div>
  <div class="trip-sort" x-show="trip.ids.length > 1">
    <button class="seg-btn" :class="trip.order === 'route' ? 'active' : ''" @click="sortTripByRoute()">${icon("route", 14)}按地理顺路</button>
    <button class="seg-btn" :class="trip.order === 'time' ? 'active' : ''" @click="sortTripByTime()">${icon("clock", 14)}按朝代先后</button>
  </div>
  <ol class="trip-list" x-show="trip.ids.length">
    <template x-for="(m, i) in tripMuseums()" :key="m.id">
      <li class="trip-stop">
        <div class="trip-leg" x-show="i > 0"><span x-text="tripLegKm(i) + ' km'"></span><span class="trip-leg-era" x-show="trip.order === 'time'" x-text="tripEraLabel(m)"></span></div>
        <div class="trip-row">
          <span class="trip-no" x-text="i + 1"></span>
          <button class="trip-main" @click="openMuseum(m.id)">
            <span class="trip-name" x-text="m.name"></span>
            <span class="trip-city" x-text="[m.city, m.corePeriod].filter(Boolean).join(' · ')"></span>
          </button>
          <div class="trip-ops">
            <button class="icon-btn" @click="moveTrip(i, -1)" :disabled="i === 0" title="上移">${icon("arrowUp", 15)}</button>
            <button class="icon-btn" @click="moveTrip(i, 1)" :disabled="i === trip.ids.length - 1" title="下移">${icon("arrowDown", 15)}</button>
            <button class="icon-btn" @click="toggleTrip(m.id)" title="移出行程">${icon("close", 15)}</button>
          </div>
        </div>
      </li>
    </template>
  </ol>
  <div class="hero-actions">
    <button class="btn btn-primary" x-show="trip.ids.length" @click="planTripWithAI()">${icon("sparkle", 16)}让讲解员排行程</button>
    <button class="btn btn-text" x-show="trip.ids.length" @click="clearTrip()">清空</button>
    <button class="btn btn-text" @click="toggleTripMode()">${icon("arrowLeft", 16)}收起行程</button>
  </div>
</section>`

  // ── 朝代地层 ──
  const dynasty = `<section class="toc-hero is-dynasty" x-show="!visits.footprintMode && !tripMode && currentDynastyId" x-cloak>
  <div class="hero-glyph" aria-hidden="true" x-text="dynastyGlyph(currentDynasty())"></div>
  <div class="hero-kicker">${icon("layers", 15)}<span>朝代地层</span><span class="mono" x-text="'NO.' + String(layerNo(currentDynastyId)).padStart(2, '0')"></span></div>
  <h1 class="hero-title" x-text="dynastyTitle()"></h1>
  <div class="hero-period" x-show="showDynastyPeriod()" x-text="(currentDynasty() || {}).period || ''"></div>
  <div class="capital-line" x-show="capitalsText(currentDynastyId)">${icon("pin", 14)}<span x-text="capitalsText(currentDynastyId)"></span></div>
  <div class="hero-overview md-rich" x-html="window.MuseumChat.renderMarkdown((currentDynasty() || {}).overview || '')" x-show="(currentDynasty() || {}).overview"></div>
  <div class="hero-stats">
    <div class="stat"><b x-text="filteredMuseums.length"></b><span>座相关馆</span></div>
    <div class="stat"><b x-text="(((currentDynasty()||{}).events) || []).length"></b><span>件大事</span></div>
    <div class="stat"><b x-text="dynastyVisitCount(currentDynastyId)"></b><span>枚已集</span></div>
  </div>
  <div class="dyn-nav">
    <button class="btn btn-ghost" @click="stepDynasty(-1)" x-show="neighborDynasty(-1)">${icon("arrowLeft", 15)}<span x-text="dynastyShortName(neighborDynasty(-1))"></span></button>
    <span class="dyn-nav-gap"></span>
    <button class="btn btn-ghost" @click="stepDynasty(1)" x-show="neighborDynasty(1)"><span x-text="dynastyShortName(neighborDynasty(1))"></span>${icon("arrowRight", 15)}</button>
  </div>
  <div class="hero-actions">
    <button class="btn btn-text" @click="clearDynastyFilter()">${icon("arrowLeft", 16)}回到全部地层</button>
  </div>
</section>`

  // ── 全部 ──
  const all = `<section class="toc-hero is-all" x-show="!visits.footprintMode && !tripMode && !currentDynastyId" x-cloak>
  <div class="hero-kicker">${icon("book", 15)}<span>今天的历史书</span><span class="mono">INDEX</span></div>
  <h1 class="hero-title"><span class="big-num" x-text="museums.length"></span> 座博物馆<br>叠成 <span class="big-num" x-text="dynasties.length"></span> 层时间</h1>
  <p class="hero-lede">博物馆是今天的历史书。每一座，都站在时间与地点的交汇处——沿时间，看一个朝代的中心如何迁徙；按地理，把想去的馆串成一条路。</p>
  <div class="hero-actions">
    <button class="btn btn-seal" @click="toggleFootprint()">${icon("seal", 16)}集章册 · <span x-text="visits.ids.length"></span></button>
    <button class="btn btn-ghost" @click="toggleTripMode()">${icon("route", 16)}行程 · <span x-text="trip.ids.length"></span></button>
  </div>
</section>`

  const list = `<div class="toc-controls" x-show="!visits.footprintMode && !tripMode">
  <div class="seg">
    <template x-for="t in levelTiers" :key="t.id">
      <button class="seg-btn" :class="levelFilter === t.id ? 'active' : ''" @click="levelFilter = t.id">
        <span x-text="t.label"></span><span class="seg-count" x-text="tierCount(t.id)"></span>
      </button>
    </template>
  </div>
  <div class="search-row">
    <label class="search">${icon("search", 16)}<input x-model="search" placeholder="馆名、朝代或拼音" /></label>
    <button class="sort-btn" @click="cycleListSort()" :title="'排序：' + listSortLabel()">
      <span x-text="listSortLabel()"></span>
    </button>
  </div>
</div>
<div class="toc-section-label" x-show="!visits.footprintMode && !tripMode">
  <span x-text="currentDynastyId ? '本朝相关博物馆' : '全部博物馆'"></span>
  <span class="count" x-text="filteredMuseums.length"></span>
</div>
<ul class="toc-list" x-show="!visits.footprintMode && !tripMode">
  <template x-for="row in listRows()" :key="row.key">
    <li :class="row.type === 'h' ? 'toc-group' : 'toc-item'"
        :data-selected="row.type === 'm' && selectedMuseumId === row.m.id ? '1' : null"
        @click="row.type === 'm' && openMuseum(row.m.id)">
      <template x-if="row.type === 'h'">
        <div class="toc-group-inner"><span x-text="row.label"></span><span class="count" x-text="row.count"></span></div>
      </template>
      <template x-if="row.type === 'm'">
        <div class="toc-item-inner" :class="selectedMuseumId === row.m.id ? 'selected' : ''">
          <div class="toc-thumb" :class="isVisited(row.m.id) ? 'is-collected' : ''" x-html="sealHtml(row.m, isVisited(row.m.id) ? 'seal-sm' : 'seal-sm seal-ghost')"></div>
          <div class="toc-item-main">
            <div class="toc-item-name" x-text="row.m.name"></div>
            <div class="toc-item-meta" x-text="[row.m.city, row.m.corePeriod].filter(Boolean).join(' · ')"></div>
          </div>
          <div class="toc-item-side">
            <span class="tier-badge" :class="tierBadge(row.m).cls" x-show="tierBadge(row.m).label" x-text="tierBadge(row.m).label"></span>
            <span class="toc-dist" x-show="geo.lat != null" x-text="distanceLabel(row.m)"></span>
            <span class="trip-dot" x-show="inTrip(row.m.id)" title="在行程中">${icon("route", 12)}</span>
          </div>
        </div>
      </template>
    </li>
  </template>
  <li class="toc-empty" x-show="filteredMuseums.length === 0">没有符合条件的博物馆。</li>
</ul>`

  return `<aside class="toc">
  ${account}
  ${hall}
  ${stamps}
  ${trip}
  ${dynasty}
  ${all}
  ${list}
</aside>`
}
