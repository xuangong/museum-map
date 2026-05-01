export function Drawer(): string {
  return `<aside class="drawer" :class="drawer.open ? 'open' : ''" @click="onDrawerClick($event)">
  <div class="drawer-folio">
    <div class="label" x-text="drawer.kind === 'dynasty' ? 'Dynasty Profile' : 'Museum File'"></div>
    <button class="close" @click="closeDrawer()">×</button>
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
  </div>
</aside>`
}
