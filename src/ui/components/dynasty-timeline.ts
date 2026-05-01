export function DynastyTimeline(): string {
  return `<nav class="timeline rule-strong bg-elev">
  <div class="timeline-item"
       :class="!currentDynastyId ? 'active accent' : ''"
       @click="clearDynastyFilter()">
    <div style="font-size:15px;">全部</div>
    <div style="font-size:10px;color:var(--ink-mute);">64 馆</div>
  </div>
  <template x-for="d in dynasties" :key="d.id">
    <div class="timeline-item"
         :class="currentDynastyId === d.id ? 'active accent' : ''"
         @click="selectDynasty(d.id)">
      <div style="font-size:15px;" x-text="d.name"></div>
      <div style="font-size:10px;color:var(--ink-mute);" x-text="d.period || ''"></div>
    </div>
  </template>
</nav>`
}
