export function DynastyTimeline(): string {
  return `<nav class="timeline rule-strong bg-elev">
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
