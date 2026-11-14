/** 封卷: the panel that seals a scroll (曲 / 行 / 印 / 长卷) before it is sent. */
export function JiPanel(): string {
  return `<div class="ji-sheet" x-show="ji.open" x-cloak x-transition.opacity @click="jiClose()" @keydown.escape.window="jiClose()">
  <div class="ji-card" role="dialog" aria-label="封卷" @click.stop>
    <div class="ji-kicker">封卷</div>
    <h3 x-text="jiTitle()"></h3>
    <label>署名<input x-model="ji.name" maxlength="12" placeholder="无名氏" autocomplete="off"></label>
    <label>附一句（可不填）<input x-model="ji.line" maxlength="40" placeholder="比如：雪夜，在洛阳" autocomplete="off"></label>
    <p class="ji-note">卷上会写下此刻的干支与节气，寄出后不再改动。</p>
    <div class="ji-actions">
      <button class="btn btn-primary" @click="ji.url ? jiSend() : jiSeal()" :disabled="ji.busy" x-text="ji.url ? '再寄一次' : (ji.busy ? '封卷中…' : '封卷，寄出')"></button>
      <a class="btn btn-text" x-show="ji.url" :href="ji.url" target="_blank" rel="noopener">先看看这一卷</a>
      <button class="btn btn-text" @click="jiClose()">罢了</button>
    </div>
  </div>
</div>`
}
