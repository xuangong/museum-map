export const themeCss = `
:root {
  /* Paper palette — refined */
  --paper:        #F4EFE3;
  --paper-warm:   #EFE8D6;
  --paper-elev:   #FBF7EA;
  --paper-deep:   #E8DFC6;

  --ink:          #14110E;
  --ink-soft:     #2E2924;
  --ink-mid:      #5C5347;
  --ink-mute:     #8E8473;
  --ink-faint:    #B8AE99;

  --vermilion:    #B73E18;
  --vermilion-deep: #8C2E11;
  --vermilion-soft: #E5C7B5;

  --rule:         #1C1A17;
  --rule-soft:    #C9BFA8;
  --rule-hair:    #DDD3BA;

  /* Typography */
  --display:      "Source Serif 4", "Noto Serif SC", "Songti SC", "STSong", serif;
  --display-cn:   "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif;
  --body:         "Source Serif 4", "Noto Serif SC", Georgia, serif;
  --mono:         "Iosevka", "JetBrains Mono", "SF Mono", ui-monospace, monospace;
  --sans:         "Söhne", "Inter", -apple-system, BlinkMacSystemFont, sans-serif;

  /* Grid */
  --col: 8.333333%;
  --gutter: 24px;
  --margin: 48px;

  /* Type scale (modular, 1.333 ratio, optical sizing) */
  --t-eyebrow: 11px;
  --t-meta:    13px;
  --t-body:    15px;
  --t-lead:    18px;
  --t-h4:      22px;
  --t-h3:      32px;
  --t-h2:      48px;
  --t-h1:      72px;
  --t-display: 112px;
}

/* ─── Reset + base ─── */
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--body);
  font-size: var(--t-body);
  line-height: 1.55;
  font-feature-settings: "kern", "liga", "onum", "ss01";
  font-variant-numeric: oldstyle-nums;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
body {
  background-image:
    radial-gradient(circle at 50% 0%, transparent 0, var(--paper) 70%),
    repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(140,128,100,0.015) 2px, rgba(140,128,100,0.015) 3px);
}
button { font-family: inherit; cursor: pointer; }
input  { font-family: inherit; }
a { color: inherit; text-decoration: none; }

/* ─── Editorial type ─── */
.eyebrow {
  font-family: var(--sans);
  font-size: var(--t-eyebrow);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-mute);
  font-weight: 500;
}
.meta {
  font-family: var(--sans);
  font-size: var(--t-meta);
  color: var(--ink-mid);
  letter-spacing: 0.02em;
}
.numeral { font-variant-numeric: lining-nums tabular-nums; font-family: var(--display); }
.display-zh { font-family: var(--display-cn); font-weight: 600; letter-spacing: -0.01em; line-height: 1.1; }
.display-en { font-family: var(--display); font-weight: 400; font-style: italic; letter-spacing: -0.015em; }
.serif { font-family: var(--body); }
.body-zh { font-family: var(--display-cn); font-weight: 400; line-height: 1.75; }

.rule-h { border-bottom: 0.5px solid var(--rule); }
.rule-h-strong { border-bottom: 1.5px solid var(--ink); }
.rule-v { border-right: 0.5px solid var(--rule-soft); }
.rule-double { border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); padding: 1px 0; box-shadow: inset 0 2px 0 var(--paper), inset 0 -2px 0 var(--paper); }

.accent { color: var(--vermilion); }
.bg-elev { background: var(--paper-elev); }
.bg-warm { background: var(--paper-warm); }

/* ─── Masthead ─── */
.masthead {
  padding: 14px var(--margin) 12px;
  border-bottom: 1.5px solid var(--ink);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: baseline;
}
.masthead .left  { text-align: left; }
.masthead .center { text-align: center; }
.masthead .right { text-align: right; }
.masthead .title {
  font-family: var(--display-cn);
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1;
}
.masthead .subtitle {
  font-family: var(--display);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-mid);
  margin-top: 4px;
  letter-spacing: 0.05em;
}

/* ─── Timeline (sub-masthead) ─── */
.timeline {
  display: flex;
  gap: 0;
  padding: 0 var(--margin);
  overflow-x: auto;
  user-select: none;
  border-bottom: 0.5px solid var(--rule);
  scrollbar-width: thin;
  scrollbar-color: var(--ink-faint) transparent;
}
.timeline::-webkit-scrollbar { height: 4px; }
.timeline::-webkit-scrollbar-thumb { background: var(--ink-faint); }
.timeline-item {
  flex-shrink: 0;
  padding: 16px 18px 14px;
  cursor: pointer;
  position: relative;
  font-family: var(--display-cn);
  border-right: 0.5px solid var(--rule-hair);
  transition: background 0.15s ease;
}
.timeline-item:hover { background: var(--paper-warm); }
.timeline-item .name {
  font-size: 17px; font-weight: 600; line-height: 1; letter-spacing: 0.01em;
}
.timeline-item .period {
  font-family: var(--display); font-style: italic; font-variant-numeric: oldstyle-nums;
  font-size: 11px; color: var(--ink-mute); margin-top: 4px; letter-spacing: 0.02em;
}
.timeline-item.active { background: var(--ink); }
.timeline-item.active .name   { color: var(--paper); }
.timeline-item.active .period { color: var(--paper-warm); opacity: 0.7; }
.timeline-item.all .name { font-family: var(--sans); font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px; }

/* ─── Main grid ─── */
.stage {
  display: grid;
  grid-template-columns: minmax(320px, 360px) 1fr;
  flex: 1; min-height: 0;
  overflow: hidden;
  position: relative;
}

/* ─── Sidebar = TOC ─── */
.toc {
  background: var(--paper-elev);
  border-right: 0.5px solid var(--rule);
  overflow-y: auto;
  scrollbar-width: thin;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.toc-head {
  padding: 28px var(--margin) 20px;
  border-bottom: 1.5px solid var(--ink);
}
.toc-head .vol {
  font-family: var(--display);
  font-style: italic;
  font-size: 13px;
  color: var(--ink-mid);
  letter-spacing: 0.03em;
}
.toc-head .vol .num { font-style: normal; font-variant-numeric: lining-nums; color: var(--vermilion); }
.toc-head .dynasty-name {
  font-family: var(--display-cn);
  font-weight: 600;
  font-size: 56px;
  line-height: 1;
  letter-spacing: -0.02em;
  margin-top: 8px;
}
.toc-head .dynasty-period {
  font-family: var(--display);
  font-style: italic;
  font-variant-numeric: oldstyle-nums;
  font-size: 14px;
  color: var(--ink-mid);
  margin-top: 6px;
  letter-spacing: 0.04em;
}
.toc-head .dynasty-overview {
  font-family: var(--display-cn);
  font-size: 14px;
  line-height: 1.75;
  color: var(--ink-soft);
  margin-top: 18px;
  /* Drop cap */
}
.toc-head .dynasty-overview::first-letter {
  font-size: 42px; line-height: 1; float: left;
  margin: 4px 6px -4px 0;
  font-weight: 600; color: var(--vermilion);
}
.toc-head .stats {
  display: flex; gap: 28px; margin-top: 22px;
  padding-top: 16px; border-top: 0.5px solid var(--rule-soft);
}
.toc-head .stat .num {
  font-family: var(--display);
  font-variant-numeric: lining-nums;
  font-size: 26px; font-weight: 400; line-height: 1;
}
.toc-head .stat .label {
  font-family: var(--sans); font-size: 10px;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--ink-mute); margin-top: 4px;
}

.toc-search {
  padding: 14px var(--margin);
  border-bottom: 0.5px solid var(--rule-soft);
  background: var(--paper-elev);
  position: sticky; top: 0; z-index: 5;
}
.toc-search input {
  width: 100%; border: none; background: transparent;
  border-bottom: 1px solid var(--rule-soft);
  padding: 6px 0;
  font-family: var(--display-cn);
  font-size: 14px; color: var(--ink);
  outline: none; transition: border-color 0.2s;
}
.toc-search input:focus { border-bottom-color: var(--vermilion); }
.toc-search input::placeholder { color: var(--ink-faint); font-style: italic; }

.toc-section-label {
  padding: 22px var(--margin) 8px;
  font-family: var(--sans);
  font-size: 10px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-mute);
  display: flex; justify-content: space-between; align-items: baseline;
}
.toc-section-label .count { font-family: var(--display); font-variant-numeric: lining-nums; font-size: 13px; color: var(--ink); letter-spacing: 0; text-transform: none; }

.toc-list { list-style: none; margin: 0; padding: 0; }
.toc-item {
  display: grid; grid-template-columns: 32px 1fr;
  gap: 14px; align-items: baseline;
  padding: 14px var(--margin);
  border-bottom: 0.5px solid var(--rule-hair);
  cursor: pointer;
  transition: background 0.12s ease;
}
.toc-item:hover { background: var(--paper-warm); }
.toc-item.selected { background: var(--ink); color: var(--paper); }
.toc-item.selected .toc-item-num,
.toc-item.selected .toc-item-meta { color: var(--paper-warm); opacity: 0.72; }
.toc-item-num {
  font-family: var(--display);
  font-variant-numeric: lining-nums tabular-nums;
  font-size: 14px;
  color: var(--ink-mute);
  text-align: right;
  letter-spacing: 0.02em;
}
.toc-item-name {
  font-family: var(--display-cn);
  font-weight: 600;
  font-size: 17px;
  line-height: 1.2;
  letter-spacing: 0.005em;
}
.toc-item-meta {
  font-family: var(--display);
  font-style: italic;
  font-size: 12px;
  color: var(--ink-mid);
  margin-top: 3px;
  letter-spacing: 0.02em;
}
.toc-empty {
  padding: 60px var(--margin);
  text-align: center;
  color: var(--ink-mute);
  font-family: var(--display);
  font-style: italic;
}

/* ─── Map canvas ─── */
.canvas { position: relative; background: var(--paper); }
.canvas-bg {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle at center, transparent 30%, rgba(20,17,14,0.02) 100%);
  pointer-events: none; z-index: 1;
}
#map { width: 100%; height: 100%; background: var(--paper-warm); }
.leaflet-tile {
  filter: grayscale(0.6) sepia(0.18) brightness(1.04) contrast(0.96);
}
.leaflet-container {
  background: var(--paper-warm);
  font-family: var(--display-cn);
}
.leaflet-popup-content-wrapper {
  background: var(--paper-elev);
  border: 1px solid var(--ink);
  border-radius: 0;
  box-shadow: 4px 4px 0 var(--ink);
  padding: 0;
}
.leaflet-popup-content { margin: 14px 18px; font-family: var(--display-cn); font-size: 13px; line-height: 1.55; }
.leaflet-popup-tip { background: var(--ink); }
.leaflet-control-zoom a {
  background: var(--paper-elev) !important;
  border: 1px solid var(--ink) !important;
  color: var(--ink) !important;
  font-family: var(--display);
  border-radius: 0 !important;
}
.leaflet-control-attribution {
  background: rgba(244,239,227,0.8) !important;
  font-family: var(--sans); font-size: 10px;
  border: 0.5px solid var(--rule-soft);
}

/* Markers */
.museum-marker {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--ink); border: 2px solid var(--paper-elev);
  box-shadow: 0 0 0 0.5px var(--ink), 0 1px 3px rgba(0,0,0,0.2);
  transition: transform 0.18s ease;
}
.museum-marker.recommended {
  width: 18px; height: 18px;
  background: var(--vermilion);
  border: 2.5px solid var(--paper-elev);
  box-shadow: 0 0 0 1px var(--vermilion-deep), 0 0 12px rgba(183,62,24,0.35);
}
.museum-marker:hover { transform: scale(1.35); z-index: 999; }
.museum-marker.selected {
  background: var(--vermilion);
  transform: scale(1.4);
  box-shadow: 0 0 0 2px var(--ink), 0 0 0 4px var(--vermilion);
}

.event-marker {
  width: 12px; height: 12px;
  background: var(--paper-elev);
  border: 2px solid var(--vermilion);
  transform: rotate(45deg);
  box-shadow: 1px 1px 0 var(--vermilion-deep);
}
.event-marker:hover { transform: rotate(45deg) scale(1.3); }

/* Map overlay — dynasty caption */
.map-caption {
  position: absolute; bottom: 32px; left: 32px; z-index: 500;
  background: var(--paper-elev);
  border: 1px solid var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
  padding: 18px 24px;
  max-width: 320px;
  pointer-events: none;
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.map-caption.show { opacity: 1; transform: translateY(0); }
.map-caption .label {
  font-family: var(--sans); font-size: 10px;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-mute);
}
.map-caption .name {
  font-family: var(--display-cn); font-weight: 600;
  font-size: 24px; margin-top: 4px; line-height: 1;
}
.map-caption .period {
  font-family: var(--display); font-style: italic;
  font-variant-numeric: oldstyle-nums;
  color: var(--ink-mid); font-size: 13px; margin-top: 4px;
}

/* Map legend */
.map-legend {
  position: absolute; top: 16px; right: 16px; z-index: 500;
  background: var(--paper-elev);
  border: 0.5px solid var(--rule-soft);
  padding: 10px 14px;
  font-family: var(--sans); font-size: 11px; color: var(--ink-mid);
}
.map-legend .row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.map-legend .dot { width: 10px; height: 10px; }
.map-legend .dot.r { background: var(--vermilion); border-radius: 50%; border: 1.5px solid var(--paper-elev); box-shadow: 0 0 0 0.5px var(--vermilion-deep); }
.map-legend .dot.e { background: var(--paper-elev); border: 1.5px solid var(--vermilion); transform: rotate(45deg); }

/* ─── Drawer = magazine spread ─── */
.drawer {
  position: absolute; right: 0; top: 0; bottom: 0;
  width: min(560px, 92%);
  background: var(--paper-elev);
  border-left: 1.5px solid var(--ink);
  box-shadow: -8px 0 24px -8px rgba(20,17,14,0.18);
  transform: translateX(100%);
  transition: transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1);
  overflow-y: auto;
  z-index: 1000;
  scrollbar-width: thin;
}
.drawer.open { transform: translateX(0); }
.drawer { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }

.drawer-folio {
  padding: 16px var(--margin) 12px;
  display: flex; justify-content: space-between; align-items: baseline;
  border-bottom: 1.5px solid var(--ink);
  position: sticky; top: 0; background: var(--paper-elev); z-index: 10;
}
.drawer-folio .label {
  font-family: var(--sans); font-size: 10px;
  letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--ink-mute);
}
.drawer-folio .close {
  border: none; background: transparent;
  font-family: var(--display); font-size: 26px;
  color: var(--ink); padding: 0 0 0 16px; line-height: 1;
}
.drawer-folio .close:hover { color: var(--vermilion); }

.drawer-hero {
  padding: 36px var(--margin) 28px;
  border-bottom: 0.5px solid var(--rule-soft);
}
.drawer-hero .kicker {
  font-family: var(--sans); font-size: 10px;
  letter-spacing: 0.25em; text-transform: uppercase;
  color: var(--vermilion); margin-bottom: 10px;
}
.drawer-hero .title {
  font-family: var(--display-cn); font-weight: 600;
  font-size: 44px; line-height: 1.05;
  letter-spacing: -0.015em;
}
.drawer-hero .subtitle {
  font-family: var(--display);
  font-style: italic;
  font-variant-numeric: oldstyle-nums;
  font-size: 16px; color: var(--ink-mid);
  margin-top: 12px; letter-spacing: 0.02em;
}

.drawer-section { padding: 24px var(--margin); border-bottom: 0.5px solid var(--rule-hair); }
.drawer-section h3 {
  font-family: var(--sans); font-weight: 500;
  font-size: 11px; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--ink-mute);
  margin: 0 0 14px;
  display: flex; align-items: baseline; gap: 12px;
}
.drawer-section h3::after {
  content: ''; flex: 1; height: 0; border-bottom: 0.5px solid var(--rule-soft);
  transform: translateY(-3px);
}
.drawer-section .body {
  font-family: var(--display-cn); font-size: 15px;
  line-height: 1.75; color: var(--ink-soft);
}
.drawer-section .body p { margin: 0 0 10px; }
.drawer-section ul { margin: 0; padding: 0; list-style: none; }
.drawer-section ul li {
  position: relative; padding-left: 18px; margin-bottom: 6px;
  font-family: var(--display-cn);
}
.drawer-section ul li::before {
  content: '—'; position: absolute; left: 0;
  color: var(--vermilion); font-family: var(--display);
}

.drawer-loading, .drawer-error {
  padding: 32px var(--margin); font-family: var(--display);
  font-style: italic; color: var(--ink-mute); font-size: 14px;
}
.drawer-error a { color: var(--vermilion); border-bottom: 1px solid var(--vermilion); }

/* Artifact card */
.artifact {
  padding: 14px 0; border-bottom: 0.5px dotted var(--rule-soft);
}
.artifact:last-child { border-bottom: none; }
.artifact-name {
  font-family: var(--display-cn); font-weight: 600;
  font-size: 16px; line-height: 1.3;
}
.artifact-period {
  font-family: var(--display); font-style: italic;
  color: var(--ink-mute); font-size: 12px;
  margin-left: 8px; letter-spacing: 0.03em;
}
.artifact-desc {
  font-family: var(--display-cn); font-size: 13.5px;
  color: var(--ink-mid); line-height: 1.65; margin-top: 4px;
}

/* Event row */
.event-row {
  display: grid; grid-template-columns: 96px 1fr;
  gap: 16px; padding: 8px 0;
  border-bottom: 0.5px dotted var(--rule-soft);
}
.event-row:last-child { border-bottom: none; }
.event-row .date {
  font-family: var(--display); font-style: italic;
  font-variant-numeric: oldstyle-nums;
  font-size: 13px; color: var(--vermilion);
  text-align: right; letter-spacing: 0.02em;
}
.event-row .text {
  font-family: var(--display-cn); font-size: 14px;
  line-height: 1.6; color: var(--ink-soft);
}

/* Recommended museum card */
.rec-card {
  display: grid; grid-template-columns: 24px 1fr;
  gap: 14px; padding: 16px 0;
  border-bottom: 0.5px dotted var(--rule-soft);
  cursor: pointer; transition: padding 0.18s ease;
}
.rec-card:last-child { border-bottom: none; }
.rec-card:hover { padding-left: 8px; }
.rec-card .num {
  font-family: var(--display);
  font-variant-numeric: lining-nums tabular-nums;
  font-size: 13px; color: var(--ink-mute);
  text-align: right; padding-top: 2px;
}
.rec-card .name {
  font-family: var(--display-cn); font-weight: 600;
  font-size: 16px; line-height: 1.25; color: var(--ink);
  border-bottom: 1px solid transparent;
  display: inline-block; padding-bottom: 1px;
}
.rec-card:hover .name { border-bottom-color: var(--vermilion); color: var(--vermilion); }
.rec-card .loc {
  font-family: var(--display); font-style: italic;
  font-size: 12px; color: var(--ink-mute);
  margin-top: 2px;
}
.rec-card .reason {
  font-family: var(--display-cn);
  font-size: 13px; color: var(--ink-mid);
  margin-top: 6px; line-height: 1.6;
}

/* Source links */
.source-link {
  display: block; padding: 4px 0;
  font-family: var(--mono);
  font-size: 12px; color: var(--vermilion);
  border-bottom: 0.5px dotted var(--vermilion-soft);
  word-break: break-all;
}

/* ─── Chat panel — editorial ─── */
.chat-overlay {
  position: fixed; inset: 0;
  background: rgba(20,17,14,0.42);
  backdrop-filter: blur(2px);
  opacity: 0; pointer-events: none;
  transition: opacity 0.25s ease; z-index: 1500;
}
.chat-overlay.open { opacity: 1; pointer-events: auto; }
.chat-panel {
  position: fixed; left: 0; right: 0; bottom: 0;
  height: min(70vh, 640px);
  background: var(--paper-elev);
  border-top: 1.5px solid var(--ink);
  box-shadow: 0 -8px 24px -8px rgba(20,17,14,0.2);
  transform: translateY(100%);
  transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
  z-index: 1600;
  display: flex; flex-direction: column;
}
.chat-panel.open { transform: translateY(0); }
.chat-head {
  padding: 18px var(--margin) 14px;
  border-bottom: 1.5px solid var(--ink);
  display: flex; justify-content: space-between; align-items: baseline;
}
.chat-head .title {
  font-family: var(--display-cn); font-weight: 600; font-size: 22px;
}
.chat-head .subtitle {
  font-family: var(--display); font-style: italic;
  color: var(--ink-mid); font-size: 13px; margin-left: 12px;
}
.chat-body {
  flex: 1; overflow-y: auto; padding: 24px var(--margin);
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.chat-msg {
  display: grid; grid-template-columns: 80px 1fr;
  gap: 24px; margin-bottom: 22px;
}
.chat-msg .who {
  font-family: var(--sans); font-size: 10px;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-mute); padding-top: 4px; text-align: right;
}
.chat-msg.user .who { color: var(--vermilion); }
.chat-msg .text {
  font-family: var(--display-cn); font-size: 15px;
  line-height: 1.75; color: var(--ink-soft);
  white-space: pre-wrap;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.chat-msg .text.md { white-space: normal; }
.chat-msg .text p { margin: 0 0 10px; }
.chat-msg .text p:last-child { margin-bottom: 0; }
.chat-msg .text strong { font-weight: 600; color: var(--ink); }
.chat-msg .text em { font-style: italic; }
.chat-msg .text code {
  font-family: var(--mono); font-size: 0.92em;
  background: var(--paper-warm); padding: 1px 5px;
  border: 0.5px solid var(--rule-soft);
}
.chat-msg .text pre {
  background: var(--paper-warm); border: 0.5px solid var(--rule-soft);
  padding: 10px 12px; margin: 8px 0; overflow-x: auto;
  font-family: var(--mono); font-size: 13px; line-height: 1.5;
  white-space: pre;
}
.chat-msg .text pre code { background: none; border: none; padding: 0; }
.chat-msg .text ul, .chat-msg .text ol { margin: 6px 0 10px; padding-left: 22px; }
.chat-msg .text li { margin: 2px 0; }
.chat-msg .text h1, .chat-msg .text h2, .chat-msg .text h3 {
  font-family: var(--display-cn); font-weight: 600; line-height: 1.3;
  margin: 12px 0 6px; color: var(--ink);
}
.chat-msg .text h1 { font-size: 1.25em; }
.chat-msg .text h2 { font-size: 1.15em; }
.chat-msg .text h3 { font-size: 1.05em; }
.chat-msg .text a {
  color: var(--vermilion);
  border-bottom: 0.5px solid var(--vermilion-soft);
}
.chat-msg .text blockquote {
  border-left: 2px solid var(--vermilion); padding-left: 12px;
  color: var(--ink-mid); margin: 8px 0;
}
.chat-loading {
  font-family: var(--display); font-style: italic;
  color: var(--ink-mute); font-size: 13px;
  padding-left: 104px;
}
.chat-chips {
  padding: 12px var(--margin); border-top: 0.5px solid var(--rule-soft);
  display: flex; flex-wrap: wrap; gap: 8px;
}
.chip {
  padding: 6px 12px;
  border: 0.5px solid var(--rule-soft);
  background: transparent;
  font-family: var(--display-cn); font-size: 13px;
  color: var(--ink-mid); cursor: pointer;
  transition: all 0.15s ease;
}
.chip:hover { border-color: var(--vermilion); color: var(--vermilion); background: var(--paper-warm); }
.chat-input-row {
  padding: 16px var(--margin) 20px;
  border-top: 1px solid var(--ink);
  display: grid; grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px; align-items: end;
}
.chat-input {
  border: none; background: transparent;
  border-bottom: 1px solid var(--ink);
  padding: 8px 0; outline: none;
  font-family: var(--display-cn); font-size: 16px;
  color: var(--ink);
  min-width: 0; width: 100%;
}
.chat-input::placeholder { color: var(--ink-faint); font-style: italic; }
.chat-send {
  border: none; background: var(--ink);
  color: var(--paper);
  padding: 10px 22px;
  font-family: var(--sans); font-size: 12px;
  letter-spacing: 0.18em; text-transform: uppercase;
  transition: background 0.15s ease;
  flex-shrink: 0; white-space: nowrap;
}
.chat-send:hover { background: var(--vermilion); }
.chat-send:disabled { background: var(--ink-faint); cursor: not-allowed; }

/* FAB */
.chat-fab {
  position: fixed; bottom: 24px; right: 24px;
  background: var(--ink); color: var(--paper);
  border: none; padding: 14px 22px;
  font-family: var(--sans); font-size: 11px;
  letter-spacing: 0.22em; text-transform: uppercase;
  cursor: pointer; z-index: 1400;
  box-shadow: 4px 4px 0 var(--vermilion);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.chat-fab:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--vermilion); }
.chat-fab .icon {
  display: inline-block; width: 6px; height: 6px;
  background: var(--vermilion); border-radius: 50%;
  margin-right: 8px; vertical-align: middle;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

/* App shell — fills viewport, accounts for iOS safe areas */
.app-shell {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  padding-top: env(safe-area-inset-top);
}
.toc-wrap { display: contents; }
.toc-overlay { display: none; }
.toc-fab { display: none; }

/* Responsive — narrow */
@media (max-width: 920px) {
  :root { --margin: 20px; --gutter: 16px; }

  /* Masthead — compact, stacked */
  .masthead {
    grid-template-columns: 1fr;
    gap: 4px;
    padding: 10px var(--margin) 8px;
    text-align: center;
  }
  .masthead .left, .masthead .right { display: none; }
  .masthead .center { text-align: center; }
  .masthead .title { font-size: 20px; letter-spacing: 0.06em; }
  .masthead .subtitle { font-size: 11px; margin-top: 2px; }

  /* Timeline — slimmer rows, momentum scroll */
  .timeline { padding: 0 var(--margin); -webkit-overflow-scrolling: touch; }
  .timeline-item { padding: 10px 14px 9px; }
  .timeline-item .name { font-size: 15px; }
  .timeline-item .period { font-size: 10px; }
  .timeline-item.all .name { font-size: 11px; }

  /* Stage = single column (map full-width); TOC becomes a slide-in sheet */
  .stage { grid-template-columns: 1fr; position: relative; }
  .toc-wrap {
    display: block;
    position: fixed; left: 0; top: 0; bottom: 0;
    width: min(360px, 88vw);
    z-index: 1700;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1);
    box-shadow: 8px 0 24px -8px rgba(20,17,14,0.25);
  }
  .toc-wrap.open { transform: translateX(0); }
  .toc-wrap .toc {
    display: block;
    height: 100%;
    border-right: 1.5px solid var(--ink);
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .toc-overlay {
    display: block; position: fixed; inset: 0;
    background: rgba(20,17,14,0.45);
    backdrop-filter: blur(2px);
    opacity: 0; pointer-events: none;
    transition: opacity 0.25s ease; z-index: 1650;
  }
  .toc-overlay.open { opacity: 1; pointer-events: auto; }

  .toc-head { padding: 22px var(--margin) 16px; }
  .toc-head .dynasty-name { font-size: 36px; }
  .toc-head .dynasty-overview { font-size: 13.5px; }
  .toc-head .dynasty-overview::first-letter { font-size: 34px; }
  .toc-head .stats { gap: 18px; margin-top: 16px; padding-top: 12px; }
  .toc-head .stat .num { font-size: 22px; }

  /* TOC FAB — bottom-left */
  .toc-fab {
    display: inline-flex; align-items: center; gap: 8px;
    position: fixed; left: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    background: var(--paper-elev); color: var(--ink);
    border: 1.5px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    padding: 10px 14px;
    font-family: var(--display-cn); font-weight: 600; font-size: 13px;
    cursor: pointer; z-index: 1400;
  }
  .toc-fab .bars { display: inline-flex; flex-direction: column; gap: 3px; }
  .toc-fab .bars span { width: 14px; height: 1.5px; background: var(--ink); display: block; }
  .toc-fab .lbl { letter-spacing: 0.08em; }

  /* Map overlays — compact, repositioned */
  .map-legend { top: 12px; right: 12px; padding: 8px 10px; font-size: 10px; }
  .map-legend .row { padding: 2px 0; }
  .map-caption {
    bottom: calc(16px + env(safe-area-inset-bottom));
    left: 50%; transform: translate(-50%, 8px);
    max-width: calc(100vw - 32px);
    padding: 12px 18px;
  }
  .map-caption.show { transform: translate(-50%, 0); }
  .map-caption .name { font-size: 20px; }

  /* Drawer — full width with handle, slides up */
  .drawer {
    position: fixed;
    width: 100vw;
    top: auto; left: 0; right: 0; bottom: 0;
    height: 88dvh;
    border-left: none;
    border-top: 1.5px solid var(--ink);
    border-top-left-radius: 12px;
    border-top-right-radius: 12px;
    transform: translateY(100%);
    box-shadow: 0 -8px 24px -8px rgba(20,17,14,0.25);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .drawer.open { transform: translateY(0); }
  .drawer::before {
    content: ''; display: block;
    width: 36px; height: 4px;
    background: var(--ink-faint); border-radius: 2px;
    margin: 8px auto 0;
  }
  .drawer-folio { padding: 12px var(--margin) 10px; }
  .drawer-hero { padding: 22px var(--margin) 18px; }
  .drawer-hero .title { font-size: 30px; }
  .drawer-hero .subtitle { font-size: 14px; }
  .drawer-section { padding: 18px var(--margin); }
  .drawer-section .body { font-size: 14.5px; }

  .event-row { grid-template-columns: 70px 1fr; gap: 12px; }
  .event-row .date { font-size: 12px; }
  .rec-card { grid-template-columns: 22px 1fr; gap: 10px; padding: 14px 0; }
  .rec-card:hover { padding-left: 0; } /* disable hover-indent on touch */

  /* Chat — full width, taller */
  .chat-panel {
    height: min(85dvh, 720px);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .chat-head { padding: 14px var(--margin) 12px; }
  .chat-head .title { font-size: 18px; }
  .chat-head .subtitle { display: none; }
  .chat-body { padding: 18px var(--margin); }
  .chat-msg { grid-template-columns: 48px 1fr; gap: 12px; margin-bottom: 16px; }
  .chat-msg .who { font-size: 9px; letter-spacing: 0.18em; }
  .chat-msg .text { font-size: 14.5px; }
  .chat-loading { padding-left: 60px; }
  .chat-chips { padding: 10px var(--margin); gap: 6px; overflow-x: auto; flex-wrap: nowrap; }
  .chip { white-space: nowrap; flex-shrink: 0; }
  .chat-input-row { padding: 12px var(--margin) 14px; gap: 10px; }
  .chat-input { font-size: 16px; } /* prevent iOS zoom */
  .chat-send { padding: 10px 16px; font-size: 11px; letter-spacing: 0.14em; }

  /* FAB — bottom-right with safe-area */
  .chat-fab {
    bottom: calc(20px + env(safe-area-inset-bottom));
    right: 16px;
    padding: 12px 18px; font-size: 11px;
  }

  /* Search input — prevent iOS zoom */
  .toc-search input { font-size: 16px; }
}

/* Very narrow phones */
@media (max-width: 380px) {
  :root { --margin: 14px; }
  .masthead .title { font-size: 18px; }
  .toc-head .dynasty-name { font-size: 30px; }
  .drawer-hero .title { font-size: 26px; }
}

/* Touch — disable hover-only effects */
@media (hover: none) {
  .timeline-item:not(.active):hover { background: transparent; }
  .toc-item:not(.selected):hover { background: transparent; }
  .rec-card:hover { padding-left: 0; }
  .rec-card:hover .name { border-bottom-color: transparent; color: var(--ink); }
  .chip:hover { border-color: var(--rule-soft); color: var(--ink-mid); background: transparent; }
}
`
