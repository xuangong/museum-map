export function Sidebar(): string {
  return `<aside class="sidebar bg-elev" style="width:300px;border-right:0.5px solid var(--rule);overflow-y:auto;">
  <div style="padding:16px 20px;border-bottom:1px solid var(--ink);">
    <h2 class="display" style="margin:0;font-size:18px;">中国博物馆</h2>
    <div x-show="currentDynastyId" style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--ink-soft);">
      <span>
        <span style="color:var(--ink-mute);">朝代：</span>
        <span class="accent" x-text="(currentDynasty() || {}).name || ''"></span>
        <span style="color:var(--ink-mute);" x-text="' · ' + filteredMuseums.length + ' 馆'"></span>
      </span>
      <button @click="clearDynastyFilter()" style="border:none;background:transparent;color:var(--accent);cursor:pointer;font-size:12px;">清除</button>
    </div>
    <input x-model="search" placeholder="搜索博物馆…"
      class="chat-input" style="margin-top:10px;font-size:13px;width:100%;border-bottom:0.5px solid var(--rule);" />
  </div>
  <ul style="list-style:none;margin:0;padding:0;">
    <template x-for="m in filteredMuseums" :key="m.id">
      <li @click="openMuseum(m.id)"
          class="rule"
          style="padding:12px 20px;cursor:pointer;"
          :style="selectedMuseumId === m.id ? 'background:var(--bg-soft);' : ''">
        <div class="museum-name" style="font-size:15px;" x-text="m.name"></div>
        <div style="font-size:11px;color:var(--ink-mute);margin-top:2px;" x-text="m.corePeriod || ''"></div>
      </li>
    </template>
    <li x-show="filteredMuseums.length === 0" style="padding:20px;color:var(--ink-mute);text-align:center;font-size:13px;">
      该朝代无推荐博物馆
    </li>
  </ul>
</aside>`
}
