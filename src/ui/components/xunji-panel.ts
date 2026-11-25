import { icon } from "../icons"

/** 循迹 — threads of 古人 and 诗 told on the map: a picker, then the tour (caption ↔ stop card). */
export function XunjiPanel(): string {
  return `<div class="xunji-panel" x-show="view === 'xunji'" x-cloak :class="(xunji.mini ? 'mini ' : '') + (xunji.thread ? 'has-thread' : '')" role="region" aria-label="循迹">
  <button type="button" class="xunji-grabber" @click="sheetTap('xunji')" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()" :aria-label="xunji.mini ? '展开' : '收起'"></button>
  <template x-if="!xunji.thread">
    <div class="xj-pick">
      <header class="xj-head" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()">
        <div class="xj-kick">循迹</div>
        <div class="xj-title">跟着一个人、一首诗，走一段历史</div>
      </header>
      <p class="xj-empty" x-show="!xunji.list">正在铺开路线…</p>
      <template x-for="g in xunjiGroups()" :key="g.kind">
        <section class="xj-group">
          <h3 x-text="g.label"></h3>
          <template x-for="t in g.items" :key="t.id">
            <button type="button" class="xj-card" @click="openThread(t.id, 0, { play: true })">
              <span class="xj-card-title" x-text="t.title"></span>
              <span class="xj-card-meta" x-text="t.who + ' · ' + t.span + ' · ' + t.stops.length + ' 站'"></span>
              <span class="xj-card-intro" x-text="t.intro"></span>
            </button>
          </template>
        </section>
      </template>
    </div>
  </template>
  <template x-if="xunji.thread">
    <div class="xj-tour" @touchstart.passive="xunji.playing && xunjiPause()">
      <header class="xj-head" @touchstart.passive="xunjiDragStart($event)" @touchmove="xunjiDragMove($event)" @touchend="xunjiDragEnd()" @touchcancel="xunjiDragEnd()">
        <div class="xj-kick" x-text="xunjiKicker()"></div>
        <div class="xj-title" x-text="xunji.thread.title"></div>
        <div class="xj-tools" @touchstart.stop.passive>
          <button class="icon-btn" @click="xunji.playing ? xunjiPause() : xunjiPlay()" :aria-label="xunji.playing ? '暂停' : '继续'"><span x-text="xunji.playing ? '❚❚' : '▶'"></span></button>
          <button class="icon-btn" @click="shareThread()" title="分享这条路">${icon("share", 17)}</button>
          <button class="icon-btn" @click="closeThread()" aria-label="回到线索列表">${icon("close", 18)}</button>
        </div>
      </header>
      <template x-if="!xunji.ended">
        <div class="xj-stop">
          <div class="xj-when" x-text="xunjiStop().when + ' · ' + xunjiStop().name + '（今' + xunjiStop().modern + '）'"></div>
          <div class="xj-stop-title" x-text="xunjiStop().title"></div>
          <blockquote class="xj-line" x-show="xunjiStop().line" x-text="xunjiStop().line"></blockquote>
          <p class="xj-story" x-show="!xunji.playing" x-text="xunjiStop().story"></p>
          <div class="xj-nav" x-show="!xunji.playing">
            <button class="chip" @click="xunjiGo(xunji.i - 1)" :disabled="xunji.i === 0">‹ 上一站</button>
            <span class="xj-count" x-text="(xunji.i + 1) + ' / ' + xunji.thread.stops.length"></span>
            <button class="chip" @click="xunjiGo(xunji.i + 1)" x-text="xunji.i === xunji.thread.stops.length - 1 ? '走完 ›' : '下一站 ›'"></button>
          </div>
          <div class="xj-prog"><template x-for="(s, k) in xunji.thread.stops" :key="k"><i :class="k <= xunji.i ? 'on' : ''"></i></template></div>
        </div>
      </template>
      <template x-if="xunji.ended">
        <div class="xj-end">
          <p class="xj-intro" x-text="xunji.thread.intro"></p>
          <pre class="xj-poem" x-show="xunji.thread.poem" x-text="xunji.thread.poem ? xunji.thread.poem.title + '\\n' + xunji.thread.poem.text : ''"></pre>
          <button class="xj-cta" @click="threadToTrip()">把这条路变成我的行程 →</button>
          <button class="chip" x-show="xunji.thread.recording" @click="xunjiListen()" x-text="xunji.listening ? '■ 停下' : '听原曲 · 《' + xunjiRecordingName() + '》'"></button>
          <button class="chip" @click="xunjiGo(0); xunjiPlay()">再走一遍</button>
        </div>
      </template>
    </div>
  </template>
</div>`
}
