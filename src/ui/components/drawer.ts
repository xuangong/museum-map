export function Drawer(): string {
  return `<aside class="drawer" :class="drawer.open ? 'open' : ''" @click="onDrawerClick($event)">
  <div style="padding:20px;border-bottom:1px solid var(--ink);display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h2 class="display" style="margin:0;font-size:24px;" x-text="drawer.title"></h2>
      <div style="margin-top:6px;color:var(--ink-mute);font-size:13px;" x-text="drawer.subtitle"></div>
    </div>
    <button @click="closeDrawer()" style="border:none;background:transparent;font-size:20px;cursor:pointer;color:var(--ink-mute);">×</button>
  </div>
  <div x-show="drawer.loading" class="drawer-section" style="color:var(--ink-mute);">载入中…</div>
  <div x-show="drawer.error" class="drawer-section" style="color:var(--accent);">
    载入失败 · <a href="#" @click.prevent="reloadDrawer()" style="color:var(--accent);text-decoration:underline;">重试</a>
  </div>
  <template x-for="section in drawer.sections" :key="section.title">
    <div class="drawer-section">
      <h3 style="margin:0 0 8px;font-size:13px;color:var(--ink-mute);font-weight:400;letter-spacing:0.05em;" x-text="section.title"></h3>
      <div x-html="section.html"></div>
    </div>
  </template>
</aside>`
}
