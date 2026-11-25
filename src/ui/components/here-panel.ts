import { icon } from "../icons"

/** 脚下千年 — a point's land read down through the eras (newest on top). */
export function HerePanel(): string {
  return `<div class="here-panel" x-show="here.open" x-cloak :class="here.mini ? 'mini' : ''" role="dialog" aria-label="脚下千年">
  <button type="button" class="here-grabber" @click="sheetTap('here')" @touchstart.passive="hereDragStart($event)" @touchmove="hereDragMove($event)" @touchend="hereDragEnd()" @touchcancel="hereDragEnd()" :aria-label="here.mini ? '展开' : '收起'"></button>
  <header class="here-head" @touchstart.passive="hereDragStart($event)" @touchmove="hereDragMove($event)" @touchend="hereDragEnd()" @touchcancel="hereDragEnd()">
    <div class="here-id" @click="here.mini && !justDragged() && (here.mini = false)">
      <div class="here-kick" x-text="hereKicker()"></div>
      <div class="here-title" x-html="hereTitle()"></div>
      <div class="here-sub" x-text="hereSub()"></div>
    </div>
    <div class="here-tools">
      <button class="icon-btn" @click="shareHere()" title="分享这片土地">${icon("share", 17)}</button>
      <button class="icon-btn" @click="closeHere()" aria-label="关闭">${icon("close", 18)}</button>
    </div>
  </header>
  <div class="here-body">
    <template x-if="here.loading"><p class="here-empty">正在翻开这片土地…</p></template>
    <template x-if="!here.loading && here.result && !here.result.layers.length">
      <div class="here-empty">
        <p>这里的千年还没写进我们的地图。</p>
        <button class="chip" x-show="here.result.nearest" @click="hereGoNearest()" x-text="'最近的故事在 ' + Math.round((here.result.nearest||{}).km || 0) + ' km 外 →'"></button>
      </div>
    </template>
    <ol class="here-layers" x-show="!here.loading && here.result && here.result.layers.length">
      <template x-for="l in (here.result ? here.result.layers : [])" :key="l.dynastyId">
        <li class="here-layer" :class="(here.openEra === l.dynastyId ? 'open ' : '') + (l.events.length ? '' : 'dim')" :style="'--c:' + hereTint(l.dynastyId)">
          <button type="button" class="hl-head" @click="hereToggle(l.dynastyId)">
            <span class="hl-era" x-text="hereEraName(l.dynastyId)"></span>
            <span class="hl-name" x-show="l.name" x-text="l.name"></span>
            <span class="hl-years" x-text="hereEraYears(l.dynastyId)"></span>
          </button>
          <p class="hl-note" x-show="l.note && here.openEra === l.dynastyId" x-text="l.note"></p>
          <p class="hl-peek" x-show="here.openEra !== l.dynastyId && l.events.length" x-text="herePeek(l)"></p>
          <ol class="hl-events" x-show="here.openEra === l.dynastyId">
            <template x-for="e in l.events" :key="e.date + e.event">
              <li><button type="button" @click="hereFocusEvent(e)"><span class="hl-date" x-text="e.date"></span><span x-text="e.event"></span></button></li>
            </template>
          </ol>
          <div class="hl-museums" x-show="l.museums.length">
            <template x-for="m in l.museums" :key="m.id">
              <button type="button" class="chip" @click="openMuseum(m.id)"><span x-text="m.name"></span> <small x-text="Math.round(m.km) < 1 ? '就在此地' : Math.round(m.km) + ' km'"></small></button>
            </template>
          </div>
          <div class="hl-threads" x-show="hereThreads(l).length">
            <template x-for="x in hereThreads(l)" :key="x.thread.id">
              <button type="button" class="chip" @click="openThread(x.thread.id, x.index, {})" x-text="'循迹 · ' + x.thread.who + ' 第 ' + (x.index + 1) + ' 站 ›'"></button>
            </template>
          </div>
        </li>
      </template>
    </ol>
  </div>
</div>`
}
