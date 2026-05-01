export function Sidebar(): string {
  return `<aside class="toc">
  <!-- Dynasty hero (only when filtered) -->
  <div x-show="currentDynastyId" x-cloak>
    <div class="toc-head">
      <div class="vol">
        Vol. <span class="num" x-text="(currentDynasty() ? (dynasties.findIndex(function(x){return x.id===currentDynasty().id})+1) : 0).toString().padStart(2,'0')"></span>
        <span style="margin-left:8px;">·</span>
        <span style="margin-left:8px;font-style:italic;">Dynasty Edition</span>
      </div>
      <h1 class="dynasty-name" x-text="(currentDynasty() || {}).name || ''"></h1>
      <div class="dynasty-period" x-text="(currentDynasty() || {}).period || ''"></div>
      <p class="dynasty-overview" x-text="(currentDynasty() || {}).overview || ''" x-show="(currentDynasty() || {}).overview"></p>
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
        ← Show all 64 museums
      </button>
    </div>
  </div>

  <!-- All-museums hero (default) -->
  <div x-show="!currentDynastyId" x-cloak>
    <div class="toc-head">
      <div class="vol">
        Vol. <span class="num">00</span>
        <span style="margin-left:8px;">·</span>
        <span style="margin-left:8px;font-style:italic;">Complete Index</span>
      </div>
      <h1 class="dynasty-name">中国博物馆</h1>
      <div class="dynasty-period"><span style="font-style:normal;font-variant-numeric:lining-nums;">64</span> institutions across <span style="font-style:normal;font-variant-numeric:lining-nums;">20</span> dynasties</div>
      <p class="dynasty-overview" style="margin-top:18px;">从仰韶到清，由四面至八方。本卷收录全国 64 座国家级与省级博物馆，按朝代脉络重新编排，以呈现中华文明在地理与时间双轴上的连续展开。</p>
    </div>
  </div>

  <!-- Search -->
  <div class="toc-search">
    <input x-model="search" placeholder="Search museums…" />
  </div>

  <!-- Section label -->
  <div class="toc-section-label">
    <span x-text="currentDynastyId ? 'Featured Museums' : 'Index'"></span>
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
          <div class="toc-item-name" x-text="m.name"></div>
          <div class="toc-item-meta" x-text="m.corePeriod || ''"></div>
        </div>
      </li>
    </template>
    <li x-show="filteredMuseums.length === 0" class="toc-empty">
      No museums match this filter.
    </li>
  </ul>
</aside>`
}
