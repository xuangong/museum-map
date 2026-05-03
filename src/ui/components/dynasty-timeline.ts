export function DynastyTimeline(): string {
  return `<nav class="timeline">
  <div class="timeline-item all"
       :class="!currentDynastyId ? 'active' : ''"
       @click="clearDynastyFilter()">
    <div class="name" x-text="visits.footprintMode ? '足迹朝代' : 'All / 全'"></div>
    <div class="period" x-text="visits.footprintMode ? (visitedDynasties().length + ' dynasties') : (museums.length + ' museums')"></div>
  </div>
  <template x-for="d in (visits.footprintMode ? visitedDynasties() : dynasties)" :key="d.id">
    <div class="timeline-item"
         :class="(currentDynastyId === d.id ? 'active ' : '') + (visits.footprintMode ? 'footprint' : (isDynastyVisited(d) ? ('has-visit depth-' + dynastyDepth(d)) : ''))"
         @click="selectDynasty(d.id)">
      <div class="name" x-text="dynastyShortName(d)"></div>
      <div class="period" x-text="dynastyShortPeriod(d)"></div>
    </div>
  </template>
</nav>`
}
