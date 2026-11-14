import { icon } from "../icons"

/** The achievement sheet: what it is, why it's worth it, where to go next, and the 展签. */
export function AchievementSheet(): string {
  return `<div class="ach-overlay" x-show="ach.sheetId" x-cloak @click="closeAch()"></div>
<section class="ach-sheet" x-show="ach.sheetId" x-cloak role="dialog" aria-label="成就">
  <template x-if="ach.sheetId && achById(ach.sheetId)">
    <div x-data="{ get a(){ return achById(ach.sheetId) || {} }, get r(){ return achResult(ach.sheetId) || { have: 0, total: 1, reach: 1, missing: [] } } }">
      <header class="ach-sheet-head">
        <span class="ach-seal big" :class="'lv' + achLevel(a.id) + ' line-' + a.line" x-text="a.seal"></span>
        <div class="ach-sheet-title">
          <div class="ach-kicker" x-text="({ theme: '专题收集', region: '区域', era: '朝代' })[a.line]"></div>
          <h2 x-text="a.name"></h2>
          <div class="ach-status" x-text="achStatus(a.id) + (achDate(a.id) ? ' · ' + achDate(a.id) : '')"></div>
        </div>
        <button class="icon-btn" @click="closeAch()" aria-label="关闭">${icon("close", 18)}</button>
      </header>
      <p class="ach-hook" x-text="a.hook"></p>
      <div class="ach-bar big"><i :style="'width:' + Math.min(100, Math.round(100 * r.have / (r.total || 1))) + '%'"></i><b x-show="r.reach < r.total" :style="'left:' + Math.round(100 * r.reach / (r.total || 1)) + '%'"></b></div>
      <div class="ach-count" x-text="r.have + ' / ' + r.total + (r.reach < r.total ? '（' + r.reach + ' 处达成，' + r.total + ' 处圆满）' : '')"></div>
      <h3>为什么值得</h3>
      <p x-text="a.why"></p>
      <template x-if="achDone(a.id).length">
        <div><h3>已经集到</h3>
          <ul class="ach-list"><template x-for="m in achDone(a.id)" :key="m.id + m.name"><li class="done"><button @click="achGo({ kind: 'museum', id: m.id })">${icon("check", 14)}<span x-text="m.name"></span></button></li></template></ul>
        </div>
      </template>
      <template x-if="achMissing(a.id).length">
        <div><h3 x-text="achLevel(a.id) ? '再去这些，就圆满' : '还差这些'"></h3>
          <ul class="ach-list"><template x-for="x in achMissing(a.id)" :key="x.kind + x.name">
            <li><button @click="achGo(x)">
              <span x-text="x.name"></span><small x-text="x.km != null ? '离你 ' + Math.round(x.km) + ' 公里' : x.sub"></small>
            </button></li>
          </template></ul>
        </div>
      </template>
      <h3>展签 · <span x-text="a.labelTitle"></span></h3>
      <p class="ach-label" :class="achLevel(a.id) ? '' : 'locked'" x-text="achLabel(a.id)"></p>
      <p class="ach-locked-note" x-show="!achLevel(a.id)">达成后读全文</p>
    </div>
  </template>
</section>`
}

/** 落印: shown once per new unlock right after a stamp. */
export function AchievementCeremony(): string {
  return `<div class="ach-ceremony" x-show="achCeremony()" x-cloak x-transition.opacity>
  <template x-if="achCeremony()">
    <div class="ach-ceremony-card" x-data="{ get c(){ return achCeremony() || {} }, get a(){ return achById((achCeremony() || {}).id) || {} } }">
      <div class="ach-ceremony-kicker" x-text="c.level === 2 && achResult(a.id) && achResult(a.id).reach < achResult(a.id).total ? '圆满' : '解锁成就'"></div>
      <span class="ach-seal stamp" :class="'lv' + c.level + ' line-' + a.line" x-text="a.seal"></span>
      <h2 x-text="a.name"></h2>
      <p x-text="a.hook"></p>
      <div class="ach-ceremony-actions">
        <button class="btn btn-primary" @click="openAch(a.id); achDismiss()">读展签</button>
        <button class="btn btn-text" @click="achDismiss()">好</button>
      </div>
    </div>
  </template>
</div>`
}
