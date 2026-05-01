export const themeCss = `
:root {
  --bg:        #F5F1E8;
  --bg-soft:   #EFE9DA;
  --bg-elev:   #FBF8F0;
  --ink:       #1C1A17;
  --ink-soft:  #3D3833;
  --ink-mute:  #847A6E;
  --accent:    #C04A1A;
  --accent-soft: #E8B89A;
  --rule:      #D9D2C2;
  --rule-soft: #E8E2D2;
  --font-display: "Source Serif 4", "Songti SC", "STSong", serif;
  --font-cn:      "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif;
  --font-body:    -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
}
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: var(--font-body); }
h1, h2, h3, .museum-name { font-family: var(--font-cn); font-weight: 600; }
.display { font-family: var(--font-display); }
.rule    { border-bottom: 0.5px solid var(--rule); }
.rule-strong { border-bottom: 1px solid var(--ink); }
.accent { color: var(--accent); }
.bg-elev { background: var(--bg-elev); }

/* Map tile sepia filter */
.leaflet-tile { filter: grayscale(0.4) sepia(0.15) brightness(1.05); }

/* Marker dot — 朱印 style */
.museum-marker {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--accent); border: 1.5px solid var(--bg);
  box-shadow: 0 0 0 1px var(--accent);
}
.museum-marker.selected {
  transform: scale(1.3);
  transition: transform 0.18s ease-out;
}

/* Drawer */
.drawer {
  position: fixed; right: 0; top: 0; bottom: 0; width: min(480px, 100vw);
  background: var(--bg-elev); border-left: 0.5px solid var(--rule);
  transform: translateX(100%); transition: transform 0.28s ease-out;
  overflow-y: auto; z-index: 1000;
}
.drawer.open { transform: translateX(0); }
.drawer-section { padding: 16px 20px; border-bottom: 0.5px solid var(--rule); }

/* Chat panel — bottom slide */
.chat-overlay {
  position: fixed; inset: 0; background: rgba(28,26,23,0.4);
  opacity: 0; pointer-events: none; transition: opacity 0.2s ease; z-index: 1500;
}
.chat-overlay.open { opacity: 1; pointer-events: auto; }
.chat-panel {
  position: fixed; left: 0; right: 0; bottom: 0; height: 70vh;
  background: var(--bg-elev); border-top: 0.5px solid var(--rule);
  transform: translateY(100%); transition: transform 0.28s ease-out;
  z-index: 1600; display: flex; flex-direction: column;
}
.chat-panel.open { transform: translateY(0); }
.chat-input {
  border: none; border-bottom: 1px solid var(--ink);
  background: transparent; padding: 8px 0; outline: none; flex: 1;
  font-family: var(--font-body);
}
.chip {
  display: inline-block; padding: 4px 10px; margin: 4px 6px 4px 0;
  border: 0.5px solid var(--rule); color: var(--ink-soft);
  cursor: pointer; font-size: 13px;
}
.chip:hover { border-color: var(--accent); color: var(--accent); }

/* Timeline */
.timeline { display: flex; gap: 24px; padding: 12px 20px; overflow-x: auto; user-select: none; }
.timeline-item { flex-shrink: 0; cursor: pointer; padding: 6px 4px; position: relative; font-family: var(--font-cn); }
.timeline-item.active::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 1.5px;
  background: var(--accent); transition: all 0.4s ease;
}
`
