export function DynastyTimeline(): string {
  return `<nav class="timeline">
  <div class="timeline-item all"
       :class="!currentDynastyId ? 'active' : ''"
       @click="clearDynastyFilter()">
    <div class="name">All / 全</div>
    <div class="period">64 museums</div>
  </div>
  <template x-for="d in dynasties" :key="d.id">
    <div class="timeline-item"
         :class="currentDynastyId === d.id ? 'active' : ''"
         @click="selectDynasty(d.id)">
      <div class="name" x-text="d.name"></div>
      <div class="period" x-text="d.period || ''"></div>
    </div>
  </template>
</nav>`
}
