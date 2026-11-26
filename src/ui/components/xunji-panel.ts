import { icon } from "../icons"
import { XunjiReader } from "./xunji-reader"
import { XunjiPages } from "./xunji-pages"

/** One stop. live: the card on screen (caption while playing, story + nav when paused);
 *  otherwise a copy in .xj-measure showing everything, so the sheet can be sized to the tallest. */
function stopCard(s: string, live: boolean): string {
  const caption = live
    ? `<blockquote class="xj-line" x-show="xunjiCaption()" x-text="xunjiCaption()"></blockquote>`
    : `<blockquote class="xj-line" x-show="${s}.line" x-text="${s}.line"></blockquote>`
  const paused = live ? ` x-show="!xunji.playing"` : ""
  return `<div class="xj-stop">
          <div class="xj-when" x-text="${s}.when + ' · ' + ${s}.name + '（今' + ${s}.modern + '）'"></div>
          <div class="xj-stop-title" x-text="${s}.title"></div>
          ${caption}
          <p class="xj-story"${paused} x-text="${s}.story"></p>
          <div class="xj-nav"${paused}>
            <button class="chip" @click="xunjiGo(xunji.i - 1)" :disabled="xunji.i === 0">‹ 上一站</button>
            <span class="xj-count" x-text="(xunji.i + 1) + ' / ' + xunji.thread.stops.length"></span>
            <button class="chip" @click="xunjiGo(xunji.i + 1)" x-text="xunji.i === xunji.thread.stops.length - 1 ? '走完 ›' : '下一站 ›'"></button>
          </div>
          <button class="xj-board"${live ? ` x-show="!xunji.playing && ${s}.trip"` : ""} @click="xunjiBoardHere()">从这一站上车 →</button>
          <div class="xj-prog"><template x-for="(p, n) in xunji.thread.stops" :key="n"><i :class="n <= xunji.i ? 'on' : ''"></i></template></div>
        </div>`
}

/** The end card: recap, poem, and the 停站表 — tap 上车, then 下车, then make it a trip. */
function endCard(live: boolean): string {
  const seg = live ? "" : "true || "
  return `<div class="xj-end">
          <p class="xj-intro" x-text="xunji.thread.intro"></p>
          <pre class="xj-poem" x-show="xunji.thread.poem" x-text="xunji.thread.poem ? xunji.thread.poem.title + '\\n' + xunji.thread.poem.text : ''"></pre>
          <div class="xj-timetable" x-show="${seg}xunjiTrip().cities.length">
            <div class="xj-tt-head"><span>停站表</span><span x-text="xunji.seg.pick ? '再点一站作为下车站' : '点一站上车，再点一站下车'"></span></div>
            <ol class="xj-tt">
              <template x-for="(c, k) in xunjiTrip().cities" :key="k">
                <li :class="(xunjiSegOn(k) ? 'on ' : '') + (xunjiSegTag(k) ? 'end' : '')">
                  <button type="button" @click="xunjiSegTap(k)">
                    <span class="tt-dot"></span>
                    <span class="tt-name" x-text="c.name"></span>
                    <span class="tt-tag" x-text="xunjiSegTag(k)"></span>
                    <span class="tt-when" x-text="xunji.thread.stops[xunjiTrip().at[k]].when"></span>
                    <span class="tt-mus" x-text="xunjiMuseumsNear(c) ? xunjiMuseumsNear(c) + ' 馆' : ''"></span>
                  </button>
                </li>
              </template>
            </ol>
          </div>
          <button class="xj-cta" @click="threadToTrip()" :disabled="xunji.seg.pick" x-show="${seg}xunjiTrip().cities.length">
            <span x-text="xunjiSegCta()"></span><small x-text="xunjiSegSub()"></small>
          </button>
          <p class="xj-cta-note">行程会把沿途的博物馆都标在地图上，方便你挑着去看。</p>
          <button class="chip" x-show="xunji.thread.recording" @click="xunjiListen()" x-text="xunji.listening ? '■ 停下' : '听原曲 · 《' + xunjiRecordingName() + '》'"></button>
          <button class="chip" x-show="!xunji.thread.acts" @click="xunjiPlay()">再走一遍</button>
          <button class="chip" x-show="xunji.thread.acts && !xunji.reading" @click="xunjiRead()">回到专题</button>
        </div>`
}

/** 循迹 — threads of 古人 and 诗 told on the map: a picker, then the tour (caption ↔ stop card). */
export function XunjiPanel(): string {
  return `<div class="xunji-panel" x-show="view === 'xunji' && !xunjiSubOn()" x-cloak :class="(xunji.mini ? 'mini ' : '') + (xunji.thread ? 'has-thread ' : '') + (xunji.reading ? 'is-reading ' : '') + (xunji.reading && xunji.paged ? 'is-paged ' : '') + (xunji.reading && xunji.paged && xunji.deskOn ? 'is-desk ' : '') + (xunjiOnMap() ? 'on-map' : '')" :style="xunjiSheetStyle()" role="region" aria-label="循迹">
  <button type="button" class="xunji-grabber" x-show="!(xunji.reading && !xunji.mini)" @click="sheetTap('xunji')" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()" :aria-label="xunji.mini ? '展开' : '收起'"></button>
  <template x-if="!xunji.thread">
    <div class="xj-pick">
      <header class="xj-head" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()">
        <div class="xj-kick">循迹</div>
        <div class="xj-title xj-masthead">跟着一个人、一首诗，<br>走一段历史</div>
      </header>
      <div class="xj-body">
      <p class="xj-empty" x-show="!xunji.list">正在铺开路线…</p>
      <div class="xj-empty" x-show="xunji.list && !xunji.list.length">路线没能铺开，稍后再试 <button type="button" class="chip" @click="xunjiRetry()">重试</button></div>
      <template x-for="g in xunjiGroups()" :key="g.kind">
        <section class="xj-group">
          <h3 x-text="g.label"></h3>
          <template x-for="t in g.items" :key="t.id">
            <div class="xj-shelf-item">
              <template x-if="t.cover">
                <button type="button" class="xj-cover-card" @click="openThread(t.id, 0, { play: true })" :style="'--era:' + ((_eraAccents && _eraAccents[t.era]) || 'var(--gilt)')">
                  <img :src="t.cover.src" alt="" :width="t.cover.w" :height="t.cover.h" loading="lazy" decoding="async" :style="t.cover.focus ? 'object-position:' + t.cover.focus : ''">
                  <span class="cc-mag" x-text="t.mag || t.title"></span>
                  <span class="cc-meta" x-text="t.who + ' · ' + t.span"></span>
                  <span class="cc-deck" x-text="t.deck"></span>
                </button>
              </template>
              <template x-if="!t.cover">
                <button type="button" class="xj-card" @click="openThread(t.id, 0, { play: true })">
                  <span class="xj-card-title" x-text="t.title"></span>
                  <span class="xj-card-meta" x-text="t.who + ' · ' + t.span + ' · ' + t.stops.length + ' 站'"></span>
                  <span class="xj-card-intro" x-text="t.intro"></span>
                </button>
              </template>
            </div>
          </template>
        </section>
      </template>
      </div>
    </div>
  </template>
  <template x-if="xunji.thread && xunji.reading">
    <div class="xj-read">
      <div class="xj-strip" @click="sheetTap('xunji')" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()" aria-hidden="true"></div>
      <header class="xj-head xj-readhead" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()" @click="sheetTap('xunji')">
        <div class="xj-kick" x-text="xunjiKick()"></div>
        <div class="xj-title" x-text="xunji.thread.mag || xunji.thread.title"></div>
      </header>
      <div class="xj-tools xj-rtools">
        <button class="icon-btn" x-show="xunji.paged" @click="xunjiOpenToc()" title="目录" aria-label="目录"><span>☰</span></button>
        <button class="icon-btn" @click="shareThread()" title="分享这条路" aria-label="分享这条路">${icon("share", 17)}</button>
        <button class="icon-btn" @click="closeThread()" aria-label="回到线索列表">${icon("close", 18)}</button>
      </div>
      <template x-if="!xunji.paged">${XunjiReader(endCard(true))}</template>
      <template x-if="xunji.paged">${XunjiPages(endCard(true))}</template>
    </div>
  </template>
  <template x-if="xunji.thread && !xunji.reading">
    <div class="xj-tour" @touchstart.passive="xunji.playing && xunjiPause()">
      <header class="xj-head" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()">
        <div class="xj-kick" x-text="xunjiKicker()"></div>
        <div class="xj-title" x-text="xunji.thread.title"></div>
        <div class="xj-tools" @touchstart.stop.passive>
          <button class="icon-btn" @click="xunji.playing ? xunjiPause() : xunjiPlay()" :aria-label="xunji.playing ? '暂停' : '继续'"><span x-text="xunji.playing ? '❚❚' : '▶'"></span></button>
          <button class="icon-btn" x-show="xunji.thread.acts || xunji.thread.chapters" @click="xunjiRead()" title="回到专题" aria-label="回到专题"><span>☰</span></button>
          <button class="icon-btn" @click="shareThread()" title="分享这条路" aria-label="分享这条路">${icon("share", 17)}</button>
          <button class="icon-btn" @click="closeThread()" aria-label="回到线索列表">${icon("close", 18)}</button>
        </div>
      </header>
      <div class="xj-body">
      <template x-if="!xunji.ended">${stopCard("xunjiStop()", true)}</template>
      <template x-if="xunji.ended">${endCard(true)}</template>
      </div>
      <div class="xj-measure" aria-hidden="true">
        <template x-for="(s, k) in xunji.thread.stops" :key="k">${stopCard("s", false)}</template>
        ${endCard(false)}
      </div>
      </div>
    </div>
  </template>
</div>
<div class="xj-sub" x-show="view === 'xunji' && xunjiSubOn()" x-cloak :style="'--era:' + xunjiAccent()">
  <div class="xs-tools" x-show="xunjiSubOn()">
    <button type="button" class="xs-btn" @click="xunji.playing ? xunjiPause() : xunjiPlay()" :aria-label="xunji.playing ? '暂停' : '继续'" x-text="xunji.playing ? '❚❚' : '▶'"></button>
    <button type="button" class="xs-btn wide" x-show="xunji.thread && (xunji.thread.acts || xunji.thread.chapters)" @click="xunjiRead()">回到专题</button>
    <button type="button" class="xs-btn" @click="closeThread()" aria-label="退出回放">✕</button>
  </div>
  <div class="xs-band">
    <button type="button" class="xs-nav" @click="xunjiGo(xunji.i - 1)" :disabled="xunji.i === 0" aria-label="上一站">‹</button>
    <template x-for="k in [xunji.i]" :key="k">
      <div class="xs-text">
        <div class="xs-when" x-text="xunjiSubWhen()"></div>
        <div class="xs-title"><i class="xs-rule"></i><span x-text="xunjiStop().title"></span><i class="xs-rule"></i></div>
        <p class="xs-narr" x-show="xunjiSubNarr()" x-text="xunjiSubNarr()"></p>
        <div class="xs-line" x-show="xunjiStop().line" x-text="xunjiBreak(xunjiStop().line, 12)"></div>
      </div>
    </template>
    <button type="button" class="xs-nav" @click="xunjiGo(xunji.i + 1)" aria-label="下一站">›</button>
  </div>
  <div class="xs-prog"><i :style="'width:' + (xunji.thread ? Math.round(100 * (xunji.i + 1) / xunji.thread.stops.length) : 0) + '%'"></i></div>
</div>`
}
