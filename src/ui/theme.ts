// 「夜展」Night Gallery theme — a darkened exhibition hall where content is lit
// like a vitrine. Gilt (鎏金) marks lit information; cinnabar (朱砂) marks the
// user's own actions (stamps, visits). See docs/superpowers/specs/2026-11-14-night-gallery-redesign-design.md
export const themeCss = `
/* Three halls, one set of tokens. data-theme on <html> is set before first paint
   (see THEME_BOOT in layout.ts); with no attribute the night hall applies.
   *-rgb tokens are bare channels for translucent tints: rgba(var(--gilt-rgb),0.2). */

/* 夜展 · Night — the lights are off, only the vitrines glow */
:root, [data-theme="night"] {
  color-scheme: dark;
  --bg:         #0D0C0B;
  --bg-2:       #131210;
  --surface:    #1A1815;
  --surface-2:  #23201C;
  --surface-3:  #2C2823;
  --text:       #EFE8DA;
  --text-2:     #C5BCAA;
  --text-3:     #8E8574;
  --text-4:     #5C564B;
  --gilt:       #D4B072;
  --gilt-hi:    #E9C98D;
  --gilt-lo:    #B8924F;
  --seal:       #E0492F;
  --seal-deep:  #B7351F;
  --patina:     #8DB8A9;

  --fg-rgb: 239,232,218;  --bg-rgb: 13,12,11;  --bg2-rgb: 19,18,16;
  --surface-rgb: 26,24,21;  --surface2-rgb: 35,32,28;
  --gilt-rgb: 212,176,114;  --seal-rgb: 224,73,47;  --patina-rgb: 141,184,169;  --spot-rgb: 239,232,218;

  --sh-60: rgba(0,0,0,0.6);  --sh-90: rgba(0,0,0,0.9);  --sh-95: rgba(0,0,0,0.95);
  --on-gilt: #1A140A;            /* text on gilt buttons/badges */
  --seal-ink-hi: #FFE3D9;        /* cinnabar-tinted text, strongest → softest */
  --seal-ink: #FFAE9C;
  --seal-ink-strong: #F26A4E;
  --map-bg: #0B0B0A;
  --tile-filter: invert(1) hue-rotate(180deg) saturate(0.32) sepia(0.22) brightness(0.84) contrast(0.9);
  --vitrine-bg: #141210;
  --stage-bg: #0A0908;
  --strata-glow-a: rgba(212,176,114,0.08);
  --strata-glow-b: rgba(224,73,47,0.06);
}

/* 宣纸 · Paper — a daylight hall: rice paper, ink, cinnabar, bronze */
[data-theme="paper"] {
  color-scheme: light;
  --bg:         #F1ECE1;
  --bg-2:       #F8F4EC;
  --surface:    #FCFAF5;
  --surface-2:  #F2ECE0;
  --surface-3:  #E6DECD;
  --text:       #231D16;
  --text-2:     #4E453A;
  --text-3:     #7C7162;
  --text-4:     #A99E8D;
  --gilt:       #98712C;
  --gilt-hi:    #7A5617;
  --gilt-lo:    #B08A44;
  --seal:       #C8371E;
  --seal-deep:  #A12914;
  --patina:     #3D7868;

  --fg-rgb: 35,29,22;  --bg-rgb: 241,236,225;  --bg2-rgb: 248,244,236;
  --surface-rgb: 252,250,245;  --surface2-rgb: 242,236,224;
  --gilt-rgb: 152,113,44;  --seal-rgb: 200,55,30;  --patina-rgb: 61,120,104;  --spot-rgb: 255,255,255;

  --sh-60: rgba(84,62,32,0.12);  --sh-90: rgba(84,62,32,0.2);  --sh-95: rgba(84,62,32,0.24);
  --on-gilt: #FFF9EE;
  --seal-ink-hi: #9E2A14;
  --seal-ink: #B5361C;
  --seal-ink-strong: #C23A1F;
  --map-bg: #ECE5D6;
  --tile-filter: sepia(0.3) saturate(0.62) brightness(1.03) contrast(0.94);
  --vitrine-bg: #FCFAF5;
  --stage-bg: #E9E2D3;
  --strata-glow-a: rgba(255,255,255,0.6);
  --strata-glow-b: rgba(200,55,30,0.05);
}

/* 只此青绿 · Qinglü — azurite and malachite from 千里江山图, silk-white text, gold */
[data-theme="qinglu"] {
  color-scheme: dark;
  --bg:         #0F2629;
  --bg-2:       #132D31;
  --surface:    #17353A;
  --surface-2:  #1D4046;
  --surface-3:  #244C52;
  --text:       #EAF0E8;
  --text-2:     #B8CDC4;
  --text-3:     #82A197;
  --text-4:     #567469;
  --gilt:       #E0BA6C;
  --gilt-hi:    #F2D597;
  --gilt-lo:    #BC934E;
  --seal:       #E8553A;
  --seal-deep:  #BF3E28;
  --patina:     #7DCBB0;

  --fg-rgb: 234,240,232;  --bg-rgb: 15,38,41;  --bg2-rgb: 19,45,49;
  --surface-rgb: 23,53,58;  --surface2-rgb: 29,64,70;
  --gilt-rgb: 224,186,108;  --seal-rgb: 232,85,58;  --patina-rgb: 125,203,176;  --spot-rgb: 214,240,230;

  --sh-60: rgba(0,12,14,0.55);  --sh-90: rgba(0,12,14,0.85);  --sh-95: rgba(0,12,14,0.9);
  --on-gilt: #13221E;
  --seal-ink-hi: #FFE1D6;
  --seal-ink: #FFB09C;
  --seal-ink-strong: #F47A5C;
  --map-bg: #0E2326;
  /* Partial invert keeps land off pure black; the sepia pass turns land and sea one family
     before the hue turn, so the sea lands on teal instead of mauve. */
  --tile-filter: invert(0.86) hue-rotate(180deg) sepia(0.9) hue-rotate(128deg) saturate(2.4) brightness(0.74) contrast(1.08);
  --vitrine-bg: #132D31;
  --stage-bg: #0A1C1F;
  --strata-glow-a: rgba(125,203,176,0.12);
  --strata-glow-b: rgba(76,150,196,0.14);
}

/* Theme-independent tokens (derived ones resolve per theme) */
:root {
  --line-faint:  rgba(var(--fg-rgb),0.06);
  --line:        rgba(var(--fg-rgb),0.10);
  --line-strong: rgba(var(--fg-rgb),0.20);
  --gilt-soft:   rgba(var(--gilt-rgb),0.12);
  --seal-soft:   rgba(var(--seal-rgb),0.16);

  /* Type */
  --serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
  --sans:  "Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --mono:  "JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace;
  --latin-serif: "Source Serif 4", "Noto Serif SC", Georgia, serif;

  /* Layout */
  --pad: 28px;
  --pad-toc: 22px;
  --pad-d: 28px;
  --ease: cubic-bezier(0.2, 0.9, 0.25, 1);

  /* Legacy aliases — pages/inline styles written for the paper theme keep working */
  --paper:        var(--bg);
  --paper-warm:   var(--surface-2);
  --paper-elev:   var(--surface);
  --paper-deep:   var(--surface-3);
  --ink:          var(--text);
  --ink-soft:     var(--text);
  --ink-mid:      var(--text-2);
  --ink-mute:     var(--text-3);
  --ink-faint:    var(--text-4);
  --vermilion:      var(--seal);
  --vermilion-deep: var(--seal-deep);
  --vermilion-soft: var(--seal-soft);
  --rule:         var(--line-strong);
  --rule-soft:    var(--line);
  --rule-hair:    var(--line-faint);
  --display:      var(--serif);
  --display-cn:   var(--serif);
  --body:         var(--sans);
}

/* ─── Base ─── */
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.6;
  font-feature-settings: "kern", "liga";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
body {
  background-image: radial-gradient(120% 60% at 50% -10%, rgba(var(--gilt-rgb),0.06), transparent 60%);
  background-attachment: fixed;
}
button { font-family: inherit; cursor: pointer; color: inherit; }
input { font-family: inherit; }
a { color: inherit; text-decoration: none; }
::selection { background: rgba(var(--gilt-rgb),0.32); color: var(--text); }
:focus-visible { outline: 2px solid var(--gilt); outline-offset: 2px; }
[x-cloak] { display: none !important; }
.ic { display: inline-block; flex: none; vertical-align: middle; }
.mono { font-family: var(--mono); }
* { scrollbar-width: thin; scrollbar-color: rgba(var(--fg-rgb),0.14) transparent; }
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: rgba(var(--fg-rgb),0.14); border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }

/* Utility type kept for error/legacy pages */
.eyebrow {
  font-family: var(--mono); font-size: 11px; letter-spacing: 0.24em;
  text-transform: uppercase; color: var(--text-3);
}
.display-zh { font-family: var(--serif); font-weight: 700; letter-spacing: 0; line-height: 1.15; }
.accent { color: var(--seal); }

/* ─── Buttons & controls ─── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  height: 38px; padding: 0 16px; border-radius: 999px;
  border: 1px solid transparent; background: transparent;
  font-size: 13px; font-weight: 500; letter-spacing: 0.02em; white-space: nowrap;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease, filter 0.2s ease;
}
.btn:active { transform: scale(0.97); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
.btn-primary { background: linear-gradient(135deg, var(--gilt-hi), var(--gilt-lo)); color: var(--on-gilt); }
.btn-primary:hover:not(:disabled) { filter: brightness(1.07); }
.btn-seal { background: var(--seal); color: #FFF4EC; box-shadow: 0 0 22px -6px rgba(var(--seal-rgb),0.85); }
.btn-seal:hover:not(:disabled) { filter: brightness(1.08); }
.btn-ghost { border-color: var(--line-strong); color: var(--text); background: rgba(var(--fg-rgb),0.03); }
.btn-ghost:hover:not(:disabled) { border-color: rgba(var(--gilt-rgb),0.5); color: var(--gilt-hi); }
.btn-text { height: auto; padding: 6px 2px; color: var(--text-3); border-radius: 6px; }
.btn-text:hover:not(:disabled) { color: var(--text); }
.btn-block { width: 100%; }
.pill {
  display: inline-flex; align-items: center; gap: 5px;
  height: 28px; padding: 0 10px; border-radius: 999px;
  border: 1px solid var(--line); background: transparent;
  color: var(--text-3); font-size: 12px; white-space: nowrap;
  transition: color 0.2s, border-color 0.2s;
}
.pill:hover { color: var(--text); border-color: var(--line-strong); }
.pill.on { color: var(--gilt); border-color: rgba(var(--gilt-rgb),0.4); }
.pill .ic { width: 14px; height: 14px; }
.icon-btn {
  width: 34px; height: 34px; border-radius: 50%;
  display: inline-grid; place-items: center;
  border: none; background: transparent; color: var(--text-3);
  transition: background 0.2s, color 0.2s;
}
.icon-btn:hover { background: var(--surface-2); color: var(--text); }
.field {
  width: 100%; height: 42px; padding: 0 14px;
  border-radius: 12px; border: 1px solid var(--line-strong);
  background: var(--bg); color: var(--text);
  font-size: 16px; outline: none; transition: border-color 0.2s;
}
.field:focus { border-color: rgba(var(--gilt-rgb),0.6); }
.field::placeholder { color: var(--text-4); }

/* ─── App shell ─── */
.app-shell {
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh;
  width: 100%; max-width: 100vw;
  overflow-x: hidden;
  padding-top: env(safe-area-inset-top);
  background: var(--bg);
}
.readonly-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 8px var(--pad);
  background: linear-gradient(90deg, rgba(var(--seal-rgb),0.28), rgba(var(--seal-rgb),0.10));
  border-bottom: 1px solid rgba(var(--seal-rgb),0.4);
  font-size: 12.5px; color: var(--text);
}
.readonly-bar a { color: var(--seal-ink-hi); text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }

/* ─── Top bar ─── */
.topbar {
  display: flex; align-items: center; gap: 16px;
  padding: 12px var(--pad) 11px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--line);
  position: relative; z-index: 20;
}
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.brand-seal {
  width: 34px; height: 34px; flex: none; border-radius: 7px;
  display: grid; place-items: center;
  background: var(--seal); color: #FFF2E8;
  font-family: var(--serif); font-weight: 900; font-size: 19px; line-height: 1;
  box-shadow: inset 0 0 0 2px rgba(255,242,232,0.55), inset 0 0 0 4px var(--seal), 0 0 22px -6px rgba(var(--seal-rgb),0.8);
}
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-name {
  font-family: var(--serif); font-weight: 700; font-size: 19px;
  letter-spacing: 0.08em; line-height: 1.15; color: var(--text); white-space: nowrap;
}
.brand-sub {
  font-family: var(--mono); font-size: 9.5px; letter-spacing: 0.3em;
  color: var(--text-3); margin-top: 3px; white-space: nowrap;
}
.brand-sub.brand-motto { font-family: var(--serif); font-size: 11px; letter-spacing: 0.16em; }
.topbar-stats {
  margin-left: auto; display: flex; gap: 18px; align-items: baseline;
  font-size: 12px; color: var(--text-3); white-space: nowrap;
}
.topbar-stats b { font-family: var(--mono); font-weight: 500; color: var(--gilt); margin-right: 4px; font-size: 13px; }
.topbar-actions { display: flex; gap: 8px; align-items: center; margin-left: 20px; }
.tb-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 14px; border-radius: 999px;
  border: 1px solid var(--line-strong); background: transparent;
  color: var(--text-2); font-size: 13px; font-weight: 500; white-space: nowrap;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.tb-btn:hover { color: var(--text); border-color: rgba(var(--fg-rgb),0.35); background: var(--surface); }
.tb-btn .ic { width: 16px; height: 16px; }
.tb-stamp {
  color: var(--seal-ink-hi); border-color: rgba(var(--seal-rgb),0.55);
  background: linear-gradient(180deg, rgba(var(--seal-rgb),0.24), rgba(var(--seal-rgb),0.10));
}
.tb-stamp b { font-family: var(--mono); font-weight: 500; }
.tb-stamp:hover { color: #fff; border-color: var(--seal); background: rgba(var(--seal-rgb),0.3); }
.tb-stamp.active { background: var(--seal); border-color: var(--seal); color: #fff; box-shadow: 0 0 22px -6px rgba(var(--seal-rgb),0.85); }

/* ─── Dynasty timeline (SSR + imperative sync — no mask-image here, see iOS note) ─── */
.timeline-wrap { position: relative; background: var(--bg-2); border-bottom: 1px solid var(--line); z-index: 15; }
.timeline-wrap::before, .timeline-wrap::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 26px;
  pointer-events: none; z-index: 2;
}
.timeline-wrap::before { left: 0; background: linear-gradient(90deg, var(--bg-2), rgba(var(--bg2-rgb),0)); }
.timeline-wrap::after { right: 0; background: linear-gradient(270deg, var(--bg-2), rgba(var(--bg2-rgb),0)); }
.timeline {
  display: flex; gap: 0;
  padding: 0 calc(var(--pad) - 14px);
  overflow-x: auto; overflow-y: hidden;
  min-width: 0; max-width: 100%;
  user-select: none; -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.timeline::-webkit-scrollbar { display: none; }
.timeline-item {
  flex-shrink: 0; position: relative;
  padding: 11px 15px 12px;
  cursor: pointer; white-space: nowrap;
  transition: background 0.2s ease;
}
.timeline-item::before {
  content: ''; position: absolute; left: 0; bottom: 0;
  width: 1px; height: 7px; background: var(--line-strong);
}
.timeline-item .name {
  font-family: var(--serif); font-weight: 600; font-size: 15px;
  line-height: 1.15; letter-spacing: 0.03em; color: var(--text-2);
  white-space: nowrap; transition: color 0.2s;
}
.timeline-item .period {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.02em;
  color: var(--text-4); margin-top: 5px; white-space: nowrap;
}
.timeline-item:hover .name { color: var(--text); }
.timeline-item.active {
  background:
    linear-gradient(var(--gilt), var(--gilt)) no-repeat center bottom / calc(100% - 22px) 2px,
    radial-gradient(70% 90% at 50% 100%, rgba(var(--gilt-rgb),0.16), transparent 72%);
}
.timeline-item.active .name { color: var(--gilt-hi); }
.timeline-item.active .period { color: rgba(var(--gilt-rgb),0.75); }
.timeline-item.has-visit::after {
  content: ''; position: absolute; top: 9px; right: 6px;
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--seal); box-shadow: 0 0 8px rgba(var(--seal-rgb),0.8);
  opacity: 0.45;
}
.timeline-item.has-visit.depth-2::after  { opacity: 0.5; }
.timeline-item.has-visit.depth-3::after  { opacity: 0.6; width: 6px; height: 6px; }
.timeline-item.has-visit.depth-4::after  { opacity: 0.7; width: 6px; height: 6px; }
.timeline-item.has-visit.depth-5::after  { opacity: 0.8; width: 7px; height: 7px; }
.timeline-item.has-visit.depth-6::after  { opacity: 0.85; width: 7px; height: 7px; }
.timeline-item.has-visit.depth-7::after  { opacity: 0.9; width: 8px; height: 8px; }
.timeline-item.has-visit.depth-8::after  { opacity: 1; width: 8px; height: 8px; }
.timeline-item.has-visit.depth-9::after  { opacity: 1; width: 9px; height: 9px; }
.timeline-item.has-visit.depth-10::after { opacity: 1; width: 9px; height: 9px; box-shadow: 0 0 0 2px var(--bg-2), 0 0 0 3px var(--seal), 0 0 12px rgba(var(--seal-rgb),0.9); }
.timeline-item.footprint .name { color: var(--seal-ink); }
.timeline-item.footprint.active {
  background:
    linear-gradient(var(--seal), var(--seal)) no-repeat center bottom / calc(100% - 22px) 2px,
    radial-gradient(70% 90% at 50% 100%, rgba(var(--seal-rgb),0.18), transparent 72%);
}
.timeline-item.footprint.active .name { color: var(--seal-ink-hi); }
.timeline-item.all .name { font-family: var(--sans); font-weight: 600; font-size: 13px; letter-spacing: 0.1em; }
.timeline-item.hidden { display: none; }

/* ─── Stage ─── */
.stage {
  display: grid;
  grid-template-columns: var(--toc-w, 380px) 6px 1fr;
  flex: 1; min-height: 0;
  overflow: hidden; position: relative;
}
.toc-resize {
  cursor: col-resize; background: var(--bg-2);
  border-left: 1px solid var(--line); border-right: 1px solid transparent;
  transition: background 0.2s, border-color 0.2s;
  user-select: none; touch-action: none;
}
.toc-resize:hover, .toc-resize.dragging { background: var(--surface); border-left-color: rgba(var(--gilt-rgb),0.5); }
body.toc-resizing, body.toc-resizing * { cursor: col-resize !important; user-select: none !important; }
.toc-wrap { display: contents; }
.toc-overlay { display: none; }

/* ─── Index (TOC) ─── */
.toc {
  background: var(--bg-2);
  overflow-y: auto; overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.toc-account { padding: 16px var(--pad-toc) 14px; border-bottom: 1px solid var(--line); }

/* 展厅灯光 — hall (theme) picker */
.hall-row {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 10px;
  padding: 10px var(--pad-toc); border-bottom: 1px solid var(--line);
}
.hall-label { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-3); white-space: nowrap; }
.hall-label .ic { color: var(--gilt); }
.hall-opts { display: flex; gap: 2px; padding: 3px; border-radius: 999px; background: rgba(var(--fg-rgb),0.04); border: 1px solid var(--line); }
.hall-opt {
  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px 0 6px;
  border: none; border-radius: 999px; background: transparent;
  font-size: 12px; color: var(--text-3); white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}
.hall-opt:hover { color: var(--text); }
.hall-opt.active { background: var(--surface-3); color: var(--text); box-shadow: inset 0 0 0 1px rgba(var(--gilt-rgb),0.4); }
.hall-swatch { width: 13px; height: 13px; flex: none; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(127,127,127,0.45); }
.sw-auto   { background: linear-gradient(135deg, #F1ECE1 0 50%, #0D0C0B 50% 100%); }
.sw-night  { background: radial-gradient(circle, #D4B072 0 2px, #0D0C0B 2.6px); }
.sw-paper  { background: radial-gradient(circle, #C8371E 0 2px, #F1ECE1 2.6px); }
.sw-qinglu { background: radial-gradient(circle, #E0BA6C 0 2px, transparent 2.6px), linear-gradient(135deg, #2B6C8F, #3E9A80); }
.acct-toggle {
  display: flex; align-items: center; gap: 12px; width: 100%;
  border: none; background: transparent; padding: 0; text-align: left;
}
.acct-cta { flex: 1; font-size: 13px; color: var(--text-2); }
.acct-cta b { color: var(--text); font-weight: 600; }
.acct-plus { font-family: var(--mono); font-size: 16px; color: var(--gilt); width: 20px; text-align: center; }
.acct-avatar {
  width: 38px; height: 38px; flex: none; border-radius: 50%;
  display: grid; place-items: center;
  background: radial-gradient(circle at 30% 28%, #F26B50, var(--seal-deep));
  color: #FFF4EC; font-family: var(--serif); font-weight: 700; font-size: 17px;
  box-shadow: 0 0 0 3px rgba(var(--seal-rgb),0.18);
}
.acct-avatar.ghost { background: var(--surface-2); color: var(--text-3); box-shadow: inset 0 0 0 1px var(--line-strong); }
.acct-row { display: flex; align-items: center; gap: 12px; }
.acct-id { flex: 1; min-width: 0; }
.acct-name { font-size: 14.5px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acct-handle { font-family: var(--mono); font-size: 11px; color: var(--text-3); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acct-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.auth-form { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.auth-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
.auth-note { font-size: 12px; color: var(--text-3); }
.auth-note code { font-family: var(--mono); color: var(--gilt); }
.auth-error { font-size: 12.5px; color: var(--seal-ink); }
.name-form { display: flex; flex-direction: column; gap: 8px; }
.name-form .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.toc-hero {
  position: relative; overflow: hidden;
  padding: 26px var(--pad-toc) 22px;
  border-bottom: 1px solid var(--line);
}
.toc-hero::before {
  content: ''; position: absolute; left: -20%; right: -20%; top: -140px; height: 300px;
  background: radial-gradient(50% 50% at 50% 50%, rgba(var(--gilt-rgb),0.11), transparent 70%);
  pointer-events: none;
}
.toc-hero.is-stamps::before { background: radial-gradient(50% 50% at 50% 50%, rgba(var(--seal-rgb),0.14), transparent 70%); }
.hero-glyph {
  position: absolute; right: -14px; top: -22px;
  font-family: var(--serif); font-weight: 900; font-size: 168px; line-height: 1;
  color: rgba(var(--gilt-rgb),0.075); white-space: nowrap;
  pointer-events: none; user-select: none;
}
.hero-kicker {
  position: relative; display: flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 500; letter-spacing: 0.08em; color: var(--gilt);
}
.hero-kicker .ic { width: 15px; height: 15px; }
.hero-kicker .mono { font-size: 10.5px; letter-spacing: 0.22em; color: var(--text-3); font-weight: 400; }
.is-stamps .hero-kicker { color: var(--seal-ink); }
.hero-title {
  position: relative; margin: 10px 0 0;
  font-family: var(--serif); font-weight: 900; font-size: 38px;
  line-height: 1.1; letter-spacing: 0.02em; color: var(--text);
}
.big-num { color: var(--gilt-hi); font-variant-numeric: lining-nums; }
.is-stamps .big-num { color: var(--seal-ink-strong); }
.hero-period { position: relative; font-family: var(--mono); font-size: 12px; color: var(--gilt); margin-top: 10px; letter-spacing: 0.04em; }
.hero-lede, .hero-overview {
  position: relative; margin: 16px 0 0;
  font-family: var(--serif); font-size: 14.5px; line-height: 1.9; color: var(--text-2);
}
.hero-overview p { margin: 0 0 10px; }
.hero-overview p:last-child { margin-bottom: 0; }
.hero-overview strong { color: var(--text); }
.hero-stats {
  position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px; margin-top: 18px;
  background: var(--line); border: 1px solid var(--line);
  border-radius: 14px; overflow: hidden;
}
.hero-stats .stat { background: var(--bg-2); padding: 12px 12px 10px; min-width: 0; }
.hero-stats .stat b {
  display: block; font-family: var(--serif); font-weight: 700; font-size: 24px;
  line-height: 1; color: var(--text); font-variant-numeric: lining-nums;
}
.hero-stats .stat span { display: block; font-size: 11px; color: var(--text-3); margin-top: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hero-note { position: relative; font-size: 13.5px; color: var(--text-2); line-height: 1.75; margin: 16px 0 0; }
.hero-note.loading { display: flex; align-items: center; gap: 10px; color: var(--gilt); }
.hero-actions { position: relative; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; align-items: center; }
.notice { position: relative; margin-top: 12px; padding: 10px 12px; border-radius: 12px; font-size: 12.5px; line-height: 1.65; }
.notice--stale { background: rgba(var(--seal-rgb),0.14); border: 1px solid rgba(var(--seal-rgb),0.45); color: var(--seal-ink-hi); }
.notice--chat { background: var(--gilt-soft); border: 1px solid rgba(var(--gilt-rgb),0.32); color: var(--gilt-hi); }

.toc-controls {
  position: sticky; top: 0; z-index: 5;
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px var(--pad-toc);
  background: rgba(var(--bg2-rgb),0.97);
  border-bottom: 1px solid var(--line);
}
.seg {
  display: flex; gap: 3px; padding: 3px;
  border-radius: 12px; background: var(--surface); border: 1px solid var(--line);
  overflow-x: auto; scrollbar-width: none;
}
.seg::-webkit-scrollbar { display: none; }
.seg-btn {
  flex: 1 0 auto; height: 30px; padding: 0 10px;
  display: inline-flex; align-items: center; justify-content: center; gap: 5px;
  border: none; border-radius: 9px; background: transparent;
  color: var(--text-3); font-size: 12.5px; white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}
.seg-btn:hover { color: var(--text); }
.seg-btn.active { background: var(--surface-3); color: var(--text); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px -2px var(--sh-60); }
.seg-count { font-family: var(--mono); font-size: 10.5px; color: var(--text-4); }
/* Five level filters must fit the sidebar without hiding 拾遗 off the edge. */
.toc-controls .seg-btn { padding: 0 6px; gap: 3px; font-size: 12px; }
.toc-controls .seg-count { font-size: 10px; }
.seg-btn.active .seg-count { color: var(--gilt); }
.search {
  display: flex; align-items: center; gap: 8px;
  height: 40px; padding: 0 12px; border-radius: 12px;
  background: var(--surface); border: 1px solid var(--line);
  color: var(--text-3); transition: border-color 0.2s;
}
.search:focus-within { border-color: rgba(var(--gilt-rgb),0.5); color: var(--gilt); }
.search input {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  color: var(--text); font-size: 14px;
}
.search input::placeholder { color: var(--text-4); }

.toc-section-label {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px var(--pad-toc) 6px;
  font-size: 11.5px; letter-spacing: 0.12em; color: var(--text-3);
}
.toc-section-label .count { font-family: var(--mono); color: var(--gilt); letter-spacing: 0; }
.toc-list { list-style: none; margin: 0; padding: 0 10px 28px; }
.toc-item { list-style: none; cursor: pointer; }
.toc-item-inner {
  display: grid; grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 12px; align-items: center;
  padding: 8px 10px; border-radius: 14px;
  transition: background 0.15s ease;
}
.toc-item:hover .toc-item-inner { background: var(--surface); }
.toc-item-inner.selected { background: var(--surface-2); box-shadow: inset 0 0 0 1px rgba(var(--gilt-rgb),0.35); }
.toc-group { list-style: none; }
.toc-group-inner {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 16px 10px 6px; margin-bottom: 4px;
  font-family: var(--serif); font-weight: 700; font-size: 14px; color: var(--gilt-hi);
  border-bottom: 1px solid var(--line);
}
.toc-group-inner .count { font-family: var(--mono); font-weight: 400; font-size: 11px; color: var(--text-3); }
.search-row { display: flex; gap: 8px; }
.search-row .search { flex: 1; min-width: 0; }
.sort-btn {
  flex: none; height: 40px; padding: 0 12px; border-radius: 12px;
  border: 1px solid var(--line); background: var(--surface);
  color: var(--text-2); font-size: 12.5px; white-space: nowrap;
}
.sort-btn:hover { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.4); }
.toc-dist { font-family: var(--mono); font-size: 10.5px; color: var(--gilt); white-space: nowrap; }
.trip-dot { display: inline-grid; color: var(--gilt); }
.toc-thumb {
  width: 48px; height: 48px; border-radius: 12px;
  display: grid; place-items: center;
  background: radial-gradient(circle at 50% 40%, rgba(var(--fg-rgb),0.05), transparent 70%);
}
.toc-thumb.is-collected { background: radial-gradient(circle at 50% 45%, rgba(var(--seal-rgb),0.18), transparent 70%); }
.toc-thumb .seal-sm { font-size: 12.5px; }
.toc-item-name {
  font-family: var(--serif); font-weight: 600; font-size: 15.5px; line-height: 1.35;
  color: var(--text);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.toc-item-meta { font-size: 12px; color: var(--text-3); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.toc-item-side { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.tier-badge {
  font-size: 10.5px; line-height: 1; padding: 4px 6px; border-radius: 6px; white-space: nowrap;
  color: var(--gilt); background: rgba(var(--gilt-rgb),0.09); border: 1px solid rgba(var(--gilt-rgb),0.24);
}
.tier-badge.t2 { color: var(--text-2); background: rgba(var(--fg-rgb),0.04); border-color: var(--line); }
.tier-badge.th { color: var(--patina); background: rgba(var(--patina-rgb),0.08); border-color: rgba(var(--patina-rgb),0.28); }
.mini-seal {
  display: inline-grid; place-items: center; width: 19px; height: 19px; flex: none;
  border-radius: 4px; background: var(--seal); color: #FFF2E8;
  font-family: var(--serif); font-weight: 900; font-size: 11px; line-height: 1;
  transform: rotate(-8deg);
  box-shadow: inset 0 0 0 1px rgba(255,242,232,0.5), 0 0 10px -2px rgba(var(--seal-rgb),0.8);
}
.toc-empty { padding: 48px 20px; text-align: center; color: var(--text-3); font-size: 13px; line-height: 1.7; }

/* ─── Map ─── */
.canvas { position: relative; background: var(--bg); overflow: hidden; }
#map { width: 100%; height: 100%; background: var(--map-bg); }
.leaflet-container { background: var(--map-bg); font-family: var(--sans); }
.leaflet-tile { filter: var(--tile-filter); }
.map-vignette {
  position: absolute; inset: 0; z-index: 450; pointer-events: none;
  background: radial-gradient(120% 95% at 50% 45%, transparent 55%, rgba(var(--bg-rgb),0.6) 100%);
}
.leaflet-control-zoom { border: none !important; box-shadow: 0 10px 30px -12px var(--sh-90) !important; }
.leaflet-control-zoom a {
  width: 34px !important; height: 34px !important; line-height: 32px !important;
  background: rgba(var(--surface-rgb),0.94) !important; color: var(--text-2) !important;
  border: 1px solid var(--line-strong) !important;
  font-family: var(--sans); font-weight: 300; font-size: 18px !important;
}
.leaflet-control-zoom a:hover { color: var(--gilt) !important; }
.leaflet-control-zoom a:first-child { border-radius: 12px 12px 0 0 !important; border-bottom: none !important; }
.leaflet-control-zoom a:last-child { border-radius: 0 0 12px 12px !important; }
.leaflet-control-attribution {
  background: rgba(var(--bg-rgb),0.65) !important; color: var(--text-4) !important;
  font-family: var(--sans); font-size: 10px; border-radius: 6px 0 0 0;
}
.leaflet-control-attribution a { color: var(--text-3) !important; }
.leaflet-popup-content-wrapper {
  background: var(--surface); color: var(--text);
  border: 1px solid var(--line-strong); border-radius: 14px;
  box-shadow: 0 20px 50px -14px var(--sh-90);
}
.leaflet-popup-tip { background: var(--surface); box-shadow: none; }
.leaflet-popup-content { margin: 14px 16px; font-size: 13px; line-height: 1.6; }
.leaflet-container a.leaflet-popup-close-button { color: var(--text-3); }
.ev-pop { min-width: 200px; }
.ev-date { font-family: var(--mono); font-size: 12px; color: var(--gilt); }
.ev-text { margin-top: 4px; color: var(--text); font-size: 13.5px; }
.ev-rel-label { margin-top: 10px; font-size: 11px; color: var(--text-3); letter-spacing: 0.06em; }
.popup-museum { display: flex; align-items: center; gap: 6px; margin-top: 6px; color: var(--gilt-hi); cursor: pointer; font-size: 12.5px; }
.popup-museum .ic { width: 13px; height: 13px; }
#map { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
#map .leaflet-popup { -webkit-user-select: text; user-select: text; }
.here-pin { width: 14px; height: 14px; border-radius: 50%; background: var(--seal); box-shadow: 0 0 0 6px rgba(var(--seal-rgb), .25), 0 0 0 14px rgba(var(--seal-rgb), .1); }
.thread-dot { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font: 600 10px/1 var(--mono); color: rgba(var(--fg-rgb), .55); background: rgba(var(--bg-rgb), .85); border: 1px solid rgba(var(--seal-rgb), .35); }
.thread-dot.on { color: var(--seal-ink-hi); border-color: var(--seal); }
.thread-line, .thread-walked { stroke: var(--seal); }
.thread-seg, .thread-seg-dot { stroke: var(--gilt); }
.thread-dot.cur { background: var(--seal); color: #fff; box-shadow: 0 0 0 6px rgba(var(--seal-rgb), .22); }
.popup-museum .pm-km { margin-left: auto; padding-left: 10px; font-family: var(--mono, 'JetBrains Mono', monospace); font-size: 10.5px; color: var(--text-3); }

/* Markers — lit points */
.museum-marker {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--text);
  border: 2px solid rgba(var(--bg-rgb),0.92);
  box-shadow: 0 0 0 1px rgba(var(--fg-rgb),0.35), 0 0 12px rgba(var(--fg-rgb),0.32);
  transition: transform 0.2s var(--ease);
  position: relative;
}
.museum-marker.w-curated { width: 18px; height: 18px; }
.museum-marker.w-tier1 { width: 14px; height: 14px; }
.museum-marker.w-other { width: 10px; height: 10px; border-width: 1.5px; opacity: 0.85; }
.museum-marker.recommended {
  background: var(--gilt);
  box-shadow: 0 0 0 1px rgba(var(--gilt-rgb),0.55), 0 0 16px rgba(var(--gilt-rgb),0.6);
}
.museum-marker.visited, .museum-marker.recommended.visited {
  background: var(--seal);
  box-shadow: 0 0 0 1px rgba(255,180,160,0.5), 0 0 16px rgba(var(--seal-rgb),0.85);
}
.museum-marker.candidate { background: rgba(var(--bg-rgb),0.6); border: 2px dashed var(--gilt-hi); box-shadow: 0 0 12px rgba(var(--gilt-rgb),0.55); }
.museum-marker:hover { transform: scale(1.35); }
.museum-marker.selected { transform: scale(1.35); background: var(--gilt-hi); }
.museum-marker.selected::after {
  content: ''; position: absolute; inset: -9px; border-radius: 50%;
  border: 1.5px solid var(--gilt-hi);
  animation: marker-pulse 1.8s ease-out infinite;
}
@keyframes marker-pulse {
  0% { transform: scale(0.55); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}
.event-marker {
  width: 11px; height: 11px;
  background: rgba(var(--bg-rgb),0.85);
  border: 1.5px solid var(--gilt);
  transform: rotate(45deg);
  box-shadow: 0 0 12px rgba(var(--gilt-rgb),0.55);
}
.event-marker:hover { transform: rotate(45deg) scale(1.3); }

.map-legend {
  position: absolute; left: 16px; bottom: 18px; z-index: 500;
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 12px; border-radius: 12px;
  background: rgba(var(--bg2-rgb),0.88); border: 1px solid var(--line);
  font-size: 11.5px; color: var(--text-2);
}
.map-legend .row { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.map-legend .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.map-legend .dot.r { background: var(--seal); box-shadow: 0 0 8px rgba(var(--seal-rgb),0.85); }
.map-legend .dot.k { background: var(--text); box-shadow: 0 0 6px rgba(var(--fg-rgb),0.5); }
.map-legend .dot.g { background: var(--gilt); box-shadow: 0 0 8px rgba(var(--gilt-rgb),0.75); }
.map-legend .dot.c { background: transparent; border: 1.5px dashed var(--gilt-hi); }
.map-legend .dot.e { width: 8px; height: 8px; border-radius: 1px; transform: rotate(45deg); border: 1.5px solid var(--gilt); background: transparent; }

.map-caption {
  position: absolute; left: 40px; bottom: 110px; z-index: 520;
  pointer-events: none; opacity: 0; transform: translateY(14px);
  transition: opacity 0.5s ease, transform 0.7s var(--ease);
  max-width: calc(100% - 72px);
}
.map-caption::before {
  content: ''; position: absolute; inset: -80px -120px -60px -80px; z-index: -1;
  background: radial-gradient(closest-side, rgba(var(--bg-rgb),0.82), transparent);
}
.map-caption.show { opacity: 1; transform: translateY(0); }
/* In 时空 the era's credit block (name · 疆域 · 在地图上看) already names it, in the same corner. */
.canvas.is-strata .map-caption { display: none; }
.cap-kicker { font-family: var(--mono); font-size: 11px; letter-spacing: 0.4em; color: var(--gilt); }
.cap-name {
  font-family: var(--serif); font-weight: 900; font-size: 60px; line-height: 1.05;
  letter-spacing: 0.08em; color: var(--text); margin-top: 10px; white-space: nowrap;
  text-shadow: 0 0 50px rgba(var(--gilt-rgb),0.3);
}
.cap-period { font-family: var(--mono); font-size: 13px; color: var(--text-2); margin-top: 10px; }

/* ─── Drawer (museum / dynasty) ─── */
.drawer {
  position: absolute; right: 0; top: 0; bottom: 0;
  width: min(580px, 94%);
  background: var(--surface);
  border-left: 1px solid var(--line-strong);
  box-shadow: -40px 0 80px -40px var(--sh-95);
  transform: translateX(104%);
  transition: transform 0.45s var(--ease);
  overflow-y: auto; overflow-x: hidden;
  z-index: 1000;
  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
}
.drawer.open { transform: translateX(0); }
.drawer-bar { position: sticky; top: 0; height: 0; z-index: 30; }
.drawer-bar-inner {
  position: relative; display: flex; justify-content: space-between; align-items: center; gap: 8px;
  padding: 14px 14px 0; pointer-events: none;
}
.drawer-bar-inner > div { display: flex; gap: 8px; align-items: center; }
.drawer-bar-inner button { pointer-events: auto; }
/* Once past the hero, scrolled text fades out under the floating buttons instead of
   running through them. */
.drawer-bar-inner::before {
  content: ''; position: absolute; z-index: -1; left: 0; right: 0; top: 0; height: 78px;
  background: linear-gradient(180deg, var(--surface) 0%, var(--surface) 52%, rgba(var(--surface-rgb),0) 100%);
  opacity: 0; transition: opacity 0.25s ease; pointer-events: none;
}
.drawer.scrolled .drawer-bar-inner::before { opacity: 1; }
.drawer-grabber { display: none; }
.round-btn {
  height: 36px; min-width: 36px; padding: 0 13px;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border-radius: 999px; border: 1px solid rgba(var(--fg-rgb),0.16);
  background: rgba(var(--bg-rgb),0.66); color: var(--text);
  font-size: 12.5px; font-weight: 500; white-space: nowrap;
  box-shadow: 0 6px 20px -8px var(--sh-90);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.round-btn.icon-only { padding: 0; width: 36px; }
.round-btn:hover { background: rgba(var(--surface2-rgb),0.92); border-color: rgba(var(--gilt-rgb),0.45); color: var(--gilt-hi); }
.round-btn:disabled { opacity: 0.55; cursor: default; }
.round-btn .ic.spinning { animation: shakeSpin 0.6s linear infinite; }
/* gilt tint over a solid surface, so drawer text scrolling under the bar never shows through */
.round-btn.gilt { background: linear-gradient(rgba(var(--gilt-rgb),0.18), rgba(var(--gilt-rgb),0.18)), var(--surface); border-color: rgba(var(--gilt-rgb),0.5); color: var(--gilt-hi); }

.drawer-loading { padding: 140px 24px; text-align: center; color: var(--text-3); font-size: 13px; letter-spacing: 0.12em; }
.drawer-error { padding: 140px 24px; text-align: center; color: var(--text-3); font-size: 13px; }
.drawer-error a { color: var(--gilt); text-decoration: underline; text-underline-offset: 3px; }
.spinner {
  display: block; margin: 0 auto 16px; width: 28px; height: 28px; border-radius: 50%;
  border: 1.5px solid var(--line-strong); border-top-color: var(--gilt);
  animation: spin 0.9s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.drawer-hero {
  position: relative; overflow: hidden;
  min-height: 230px;
  display: flex; flex-direction: column; justify-content: flex-end;
  padding: 76px var(--pad-d) 24px;
  background: radial-gradient(110% 85% at 75% 0%, rgba(var(--gilt-rgb),0.13), transparent 62%), var(--surface);
}
.drawer-hero.has-image { min-height: min(54vh, 460px); }
.hero-media { position: absolute; inset: 0; margin: 0; background: var(--bg); }
.hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in; }
.hero-media::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(var(--bg-rgb),0.45) 0%, rgba(var(--bg-rgb),0) 26%, rgba(var(--surface-rgb),0.35) 55%, rgba(var(--surface-rgb),0.92) 84%, var(--surface) 100%);
}
.hero-media .artifact-image-caption { display: none; }
.drawer-hero .hero-glyph { right: -22px; top: 6px; font-size: 220px; }
.hero-text { position: relative; z-index: 2; pointer-events: none; }
.drawer-hero .hero-title {
  font-size: 36px; line-height: 1.14; margin-top: 10px;
  text-shadow: 0 2px 30px rgba(var(--bg-rgb),0.65);
}
.hero-sub { font-size: 13.5px; color: var(--text-2); margin-top: 10px; line-height: 1.6; text-shadow: 0 1px 12px rgba(var(--bg-rgb),0.8); }
/* Over a cover photo the kicker sits mid-gradient; a halo in the sheet's own tone keeps it
   legible whether the hall is dark or paper. */
.drawer-hero.has-image .hero-kicker { text-shadow: 0 0 14px rgba(var(--surface-rgb),0.95), 0 0 3px rgba(var(--surface-rgb),0.9); }
.hero-credit { margin-top: 12px; font-family: var(--mono); font-size: 10px; color: var(--text-4); overflow-wrap: anywhere; }

.drawer-section {
  padding: 22px var(--pad-d);
  border-top: 1px solid var(--line);
  min-width: 0; overflow-wrap: anywhere; word-break: break-word;
}
.drawer.open .drawer-section { animation: rise 0.55s var(--ease) both; }
.drawer.open .drawer-section:nth-child(2) { animation-delay: 0.03s; }
.drawer.open .drawer-section:nth-child(3) { animation-delay: 0.06s; }
.drawer.open .drawer-section:nth-child(4) { animation-delay: 0.09s; }
.drawer.open .drawer-section:nth-child(5) { animation-delay: 0.12s; }
.drawer.open .drawer-section:nth-child(6) { animation-delay: 0.15s; }
@keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.drawer-section h3 {
  display: flex; align-items: baseline; gap: 10px;
  margin: 0 0 14px;
  font-family: var(--serif); font-weight: 700; font-size: 17px;
  letter-spacing: 0.06em; color: var(--text);
}
.drawer-section h3 .sec-en { font-family: var(--mono); font-weight: 400; font-size: 10px; letter-spacing: 0.24em; color: var(--text-4); }
.drawer-section h3 .sec-count { margin-left: auto; font-family: var(--mono); font-weight: 400; font-size: 11px; letter-spacing: 0.04em; color: var(--gilt); }
.drawer-section .body { font-size: 15px; line-height: 1.85; color: var(--text-2); }
.drawer-section .body p { margin: 0 0 10px; }
.drawer-section .body p:last-child { margin-bottom: 0; }
.drawer-section.sec-visit { border-top: none; padding-top: 4px; padding-bottom: 18px; }
.lead { font-family: var(--serif); font-size: 16px; line-height: 1.95; color: var(--text); margin: 0; }

/* Stamp — check-in */
.stamp-row { display: flex; align-items: center; gap: 16px; }
.stamp-btn {
  flex: 1; display: flex; align-items: center; gap: 14px;
  padding: 12px 16px 12px 12px; border-radius: 18px; text-align: left;
  border: 1px dashed rgba(var(--seal-rgb),0.6);
  background: linear-gradient(180deg, rgba(var(--seal-rgb),0.14), rgba(var(--seal-rgb),0.04));
  color: var(--text);
  transition: background 0.2s, transform 0.15s, border-color 0.2s;
}
.stamp-btn:hover { background: linear-gradient(180deg, rgba(var(--seal-rgb),0.22), rgba(var(--seal-rgb),0.08)); border-color: var(--seal); }
.stamp-btn:active { transform: scale(0.98); }
.stamp-btn-seal {
  width: 46px; height: 46px; flex: none; border-radius: 12px;
  display: grid; place-items: center; background: var(--seal); color: #FFF4EC;
  box-shadow: inset 0 0 0 2px rgba(255,242,232,0.4), 0 0 24px -6px rgba(var(--seal-rgb),0.95);
}
.stamp-btn-seal .ic { width: 22px; height: 22px; }
.stamp-btn-text b { display: block; font-family: var(--serif); font-weight: 700; font-size: 16.5px; letter-spacing: 0.1em; }
.stamp-btn-text small { display: block; font-size: 12px; color: var(--text-3); margin-top: 2px; }
.stamp-count { text-align: right; font-size: 11px; color: var(--text-3); line-height: 1.4; white-space: nowrap; }
.stamp-count b { display: block; font-family: var(--mono); font-size: 19px; font-weight: 500; color: var(--text); }
.seal-mark { position: relative; display: grid; place-items: center; width: 84px; height: 84px; flex: none; }
.stamp-row.is-stamped { gap: 14px; }
.stamp-meta { min-width: 0; flex: 1; }
.stamp-title { font-family: var(--serif); font-weight: 700; font-size: 16px; color: var(--text); }
.stamp-sub { font-size: 12.5px; color: var(--text-3); margin-top: 3px; }
.stamp-undo {
  margin-top: 8px; border: none; background: none; padding: 0;
  font-size: 12px; color: var(--text-4); text-decoration: underline; text-underline-offset: 3px;
}
.stamp-undo:hover { color: var(--text-2); }
.just-stamped .seal-mark .seal { animation: stamp-in 0.62s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
.just-stamped .seal-mark::after {
  content: ''; position: absolute; inset: -6px; border-radius: 22px;
  border: 2px solid rgba(var(--seal-rgb),0.6);
  animation: stamp-ring 0.8s ease-out 0.24s both;
}
@keyframes stamp-in {
  0% { transform: rotate(calc(var(--r) - 18deg)) scale(2.4); opacity: 0; }
  55% { transform: rotate(calc(var(--r) + 2deg)) scale(0.92); opacity: 1; }
  100% { transform: rotate(var(--r)) scale(1); opacity: 1; }
}

/* ─── Seals (馆印) — every museum carves its own ─── */
.seal {
  --r: -6deg;
  position: relative; flex: none;
  display: inline-grid; place-items: center;
  width: 3em; height: 3em; font-size: 15px;
  font-family: var(--serif); font-weight: 900; line-height: 1;
  transform: rotate(var(--r));
}
.seal-t { writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 0.02em; line-height: 1.02; white-space: normal; }
.seal-n1 .seal-t { font-size: 1.62em; }
.seal-n2 .seal-t { font-size: 1.16em; }
.seal-n3 .seal-t { font-size: 0.86em; }
.seal-n4 .seal-t { font-size: 1.02em; height: 2.12em; }
.seal-sq { border-radius: 0.2em; }
.seal-rd { border-radius: 0.62em; }
.seal-ci { border-radius: 50%; }
.seal-ov { border-radius: 50% / 42%; width: 2.55em; height: 3.15em; }
.seal-yin {
  background-color: var(--seal); color: #FFF2E8;
  background-image:
    radial-gradient(circle at 18% 24%, rgba(255,255,255,0.16) 0 0.05em, transparent 0.09em),
    radial-gradient(circle at 74% 66%, rgba(0,0,0,0.16) 0 0.08em, transparent 0.12em),
    radial-gradient(circle at 42% 86%, rgba(255,255,255,0.12) 0 0.05em, transparent 0.09em),
    radial-gradient(120% 100% at 30% 20%, rgba(255,140,110,0.35), transparent 60%);
  box-shadow: inset 0 0 0 0.12em var(--seal), inset 0 0 0 0.19em rgba(255,242,232,0.55), 0 0 1.2em -0.3em rgba(var(--seal-rgb),0.85);
}
.seal-yang {
  color: var(--seal-ink-strong); background: rgba(var(--seal-rgb),0.07);
  box-shadow: inset 0 0 0 0.16em var(--seal-ink-strong), 0 0 1.1em -0.35em rgba(var(--seal-rgb),0.75);
  text-shadow: 0 0 0.6em rgba(var(--seal-rgb),0.45);
}
.seal-sm { font-size: 10px; }
.seal-lg { font-size: 23px; }
/* Not yet collected: the carving waits, unlit. */
.seal.seal-ghost {
  color: rgba(var(--fg-rgb),0.38); background: transparent;
  box-shadow: inset 0 0 0 0.12em rgba(var(--fg-rgb),0.2);
  text-shadow: none; background-image: none;
}
.toc-thumb .seal { transition: transform 0.25s var(--ease); }
.toc-item:hover .toc-thumb .seal { transform: rotate(0deg) scale(1.06); }
@keyframes stamp-ring {
  from { opacity: 0.95; transform: scale(0.7); }
  to { opacity: 0; transform: scale(1.45); }
}

/* Object label (展签) */
.label-card {
  margin: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden;
  background: rgba(var(--fg-rgb),0.02);
}
.label-card > div {
  display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 12px;
  padding: 11px 14px; border-top: 1px solid var(--line);
}
.label-card > div:first-child { border-top: none; }
.label-card dt { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.16em; color: var(--text-3); padding-top: 3px; }
.label-card dd { margin: 0; font-size: 13.5px; line-height: 1.65; color: var(--text); }

/* Treasures */
.treasure-list { list-style: none; margin: 0; padding: 0; }
.treasure-list li {
  display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 10px; align-items: baseline;
  padding: 11px 0; border-top: 1px solid var(--line);
}
.treasure-list li:first-child { border-top: none; padding-top: 2px; }
.t-num { font-family: var(--mono); font-size: 12px; color: var(--gilt); }
.t-name { font-family: var(--serif); font-size: 15.5px; line-height: 1.65; color: var(--text); }

/* Artifacts as lit vitrines */
.vitrines { display: flex; flex-direction: column; gap: 18px; }
.vitrine { border-radius: 18px; overflow: hidden; background: var(--vitrine-bg); border: 1px solid var(--line); }
.vitrine-stage {
  position: relative; display: flex; align-items: center; justify-content: center;
  padding: 20px 18px 30px; min-height: 200px;
  background: radial-gradient(70% 62% at 50% 36%, rgba(var(--spot-rgb),0.11), rgba(var(--spot-rgb),0) 72%), var(--stage-bg);
}
.vitrine-stage img {
  display: block; max-width: 100%; max-height: 380px; object-fit: contain;
  border-radius: 4px; cursor: zoom-in;
  box-shadow: 0 24px 40px -22px var(--sh-95);
}
.vitrine-stage .artifact-image-caption {
  position: absolute; left: 14px; right: 14px; bottom: 9px;
  font-family: var(--mono); font-size: 9.5px; color: rgba(var(--fg-rgb),0.36);
  text-align: right; overflow-wrap: anywhere; word-break: break-word;
}
.vitrine-label { padding: 16px 18px 18px; }
.vitrine.no-image .vitrine-label { box-shadow: inset 2px 0 0 rgba(var(--gilt-rgb),0.55); }
.vitrine-no { font-family: var(--mono); font-size: 10px; letter-spacing: 0.22em; color: var(--text-4); }
.vitrine-name { font-family: var(--serif); font-weight: 700; font-size: 18px; line-height: 1.4; color: var(--text); margin: 6px 0 0; }
.vitrine-period {
  display: inline-block; margin-top: 8px; padding: 3px 9px; border-radius: 7px;
  font-size: 11.5px; line-height: 1.5; color: var(--gilt);
  background: rgba(var(--gilt-rgb),0.08); border: 1px solid rgba(var(--gilt-rgb),0.2);
}
.vitrine-desc { margin: 12px 0 0; font-size: 14px; line-height: 1.9; color: var(--text-2); }

.tag-list { display: flex; flex-wrap: wrap; gap: 8px; }
.tag {
  padding: 6px 12px; border-radius: 999px; font-size: 13px; line-height: 1.45;
  background: var(--surface-2); border: 1px solid var(--line); color: var(--text);
}

/* Vertical chain (history / coverage) */
.chain { list-style: none; margin: 0; padding: 0; }
.chain li { position: relative; padding: 0 0 14px 24px; font-size: 14px; line-height: 1.75; color: var(--text-2); }
.chain li::before {
  content: ''; position: absolute; left: 3px; top: 8px; width: 8px; height: 8px; border-radius: 50%;
  background: var(--surface); border: 1.5px solid var(--gilt); box-sizing: border-box;
}
.chain li::after { content: ''; position: absolute; left: 7px; top: 19px; bottom: 2px; width: 1px; background: var(--line-strong); }
.chain li:last-child { padding-bottom: 0; }
.chain li:last-child::after { display: none; }
.chain li:last-child::before { background: var(--gilt); box-shadow: 0 0 10px rgba(var(--gilt-rgb),0.75); }

.ties { display: flex; flex-direction: column; gap: 12px; }
.tie { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: baseline; }
.tie-dyn {
  font-family: var(--serif); font-weight: 700; font-size: 13px; color: var(--gilt);
  padding: 3px 9px; border-radius: 8px; white-space: nowrap;
  background: rgba(var(--gilt-rgb),0.09); border: 1px solid rgba(var(--gilt-rgb),0.22);
}
.tie p { margin: 0; font-size: 14px; color: var(--text-2); line-height: 1.8; }
.tie-text { font-size: 14px; color: var(--text-2); line-height: 1.8; min-width: 0; }
.tie-text p { margin: 0; }
.tie-text p + p, .tie-text p + ul, .tie-text ul + p { margin-top: 6px; }
.tie-text ul { margin: 4px 0 0; padding-left: 1.2em; }
.tie-text li { margin: 2px 0; }
.tie-text strong { color: var(--text); font-weight: 700; }

.sources { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.source-link {
  display: flex; flex-direction: column; gap: 3px;
  padding: 10px 12px; border-radius: 12px;
  background: rgba(var(--fg-rgb),0.025); border: 1px solid var(--line);
  color: var(--text-2); font-size: 13px; line-height: 1.55;
  overflow-wrap: anywhere; word-break: break-word;
  transition: border-color 0.2s, color 0.2s;
}
a.source-link:hover { border-color: rgba(var(--gilt-rgb),0.45); color: var(--text); }
.src-host { font-family: var(--mono); font-size: 10.5px; color: var(--text-4); }

/* Dynasty drawer pieces */
.culture-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.culture-card { padding: 14px 14px 12px; border-radius: 14px; background: rgba(var(--fg-rgb),0.03); border: 1px solid var(--line); min-width: 0; }
.cc-cat { font-family: var(--serif); font-weight: 700; font-size: 15px; color: var(--gilt-hi); }
.cc-desc { margin-top: 6px; font-size: 13px; line-height: 1.75; color: var(--text-2); }
.cc-desc p { margin: 0; }
.chronicle { list-style: none; margin: 0; padding: 0; position: relative; }
.chronicle::before { content: ''; position: absolute; left: 87px; top: 8px; bottom: 8px; width: 1px; background: var(--line-strong); }
.chronicle li { position: relative; display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 24px; padding: 7px 0; }
.chronicle li::before {
  content: ''; position: absolute; left: 84px; top: 15px; width: 7px; height: 7px; border-radius: 50%;
  background: var(--surface); border: 1.5px solid var(--gilt); box-sizing: border-box;
}
.ch-date { font-family: var(--mono); font-size: 12px; line-height: 1.6; color: var(--gilt); text-align: right; padding-top: 2px; }
.ch-text { font-size: 14px; line-height: 1.8; color: var(--text-2); }
.ch-text p { margin: 0; }
.rec-list { display: flex; flex-direction: column; gap: 10px; }
.rec-card {
  display: grid; grid-template-columns: 28px minmax(0, 1fr) 18px; gap: 12px;
  padding: 14px; border-radius: 16px;
  background: rgba(var(--fg-rgb),0.03); border: 1px solid var(--line);
  transition: border-color 0.2s, background 0.2s;
}
.rec-card.dynasty-rec { cursor: pointer; }
.rec-card.dynasty-rec:hover { border-color: rgba(var(--gilt-rgb),0.42); background: rgba(var(--gilt-rgb),0.05); }
.rec-card.static { cursor: default; opacity: 0.78; }
.rec-num { font-family: var(--mono); font-size: 12px; color: var(--gilt); padding-top: 3px; }
.rec-name { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-family: var(--serif); font-weight: 700; font-size: 16px; line-height: 1.4; color: var(--text); }
.rec-loc { display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 12px; color: var(--text-3); }
.rec-loc .ic { width: 13px; height: 13px; }
.rec-reason { margin-top: 8px; font-size: 13.5px; line-height: 1.8; color: var(--text-2); }
.rec-reason p { margin: 0; }
.rec-go { align-self: center; color: var(--text-4); transition: color 0.2s, transform 0.2s; }
.rec-card.dynasty-rec:hover .rec-go { color: var(--gilt); transform: translateX(2px); }
.dyn-stats { margin-top: 0; }

/* Guide card (AI 评价 / 导览词) */
.guide-card {
  position: relative; padding: 18px 18px 16px; border-radius: 18px;
  background: linear-gradient(180deg, rgba(var(--gilt-rgb),0.09), rgba(var(--gilt-rgb),0.02));
  border: 1px solid rgba(var(--gilt-rgb),0.26);
}
.guide-empty { font-size: 14px; color: var(--text-2); line-height: 1.8; margin: 0; }
.guide-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }

/* Rich markdown (AI reviews, overviews, chat) */
.md-rich { font-family: var(--serif); font-size: 14.5px; line-height: 1.9; color: var(--text); }
.md-rich p { margin: 0 0 10px; }
.md-rich p:last-child { margin-bottom: 0; }
.md-rich h1, .md-rich h2, .md-rich h3 { font-family: var(--serif); font-weight: 700; line-height: 1.4; margin: 16px 0 8px; color: var(--gilt-hi); }
.md-rich h1:first-child, .md-rich h2:first-child, .md-rich h3:first-child { margin-top: 0; }
.md-rich h1 { font-size: 17px; }
.md-rich h2 { font-size: 16px; }
.md-rich h3 { font-size: 15px; }
.md-rich strong { color: var(--text); font-weight: 700; }
.md-rich em { color: var(--text-2); }
.md-rich ul, .md-rich ol { margin: 6px 0 12px; padding-left: 20px; }
.md-rich li { margin: 4px 0; }
.md-rich li::marker { color: var(--gilt); }
.md-rich blockquote { margin: 10px 0; padding: 2px 0 2px 14px; border-left: 2px solid var(--gilt); color: var(--text-2); }
.md-rich code { font-family: var(--mono); font-size: 0.88em; padding: 1px 6px; border-radius: 6px; background: var(--surface-3); border: 1px solid var(--line); }
.md-rich pre { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; overflow-x: auto; font-size: 13px; line-height: 1.55; white-space: pre; }
.md-rich pre code { background: none; border: none; padding: 0; }
.md-rich code.cmd { cursor: pointer; color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.4); user-select: none; }
.md-rich code.cmd:hover { background: var(--gilt); color: var(--on-gilt); }
.md-rich a { color: var(--gilt-hi); text-decoration: underline; text-decoration-color: rgba(var(--gilt-rgb),0.4); text-underline-offset: 3px; }
.md-rich hr { border: none; border-top: 1px solid var(--line-strong); margin: 14px 0; }
.md-rich table { border-collapse: collapse; margin: 10px 0; font-size: 13px; width: 100%; }
.md-rich th, .md-rich td { border: 1px solid var(--line-strong); padding: 6px 10px; text-align: left; vertical-align: top; }
.md-rich th { background: var(--surface-2); font-weight: 600; }
.md p { margin: 0 0 8px; }
.md p:last-child { margin-bottom: 0; }

/* ─── Lightbox ─── */
.lightbox {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(6,5,4,0.94);
  display: flex; align-items: center; justify-content: center;
  padding: 24px; cursor: zoom-out;
}
.lightbox img {
  max-width: 100%; max-height: 100%; object-fit: contain;
  box-shadow: 0 30px 80px rgba(0,0,0,0.7); background: #0A0908;
  will-change: transform;
}
.lightbox .lb-close {
  position: absolute; top: calc(16px + env(safe-area-inset-top)); right: 18px;
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid rgba(var(--fg-rgb),0.2); background: rgba(var(--surface-rgb),0.8);
  color: var(--text); font-size: 22px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
}
.lightbox .lb-close:hover { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.5); }
.lightbox .lb-caption {
  position: absolute; bottom: calc(18px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
  font-family: var(--mono); font-size: 11px; color: rgba(var(--fg-rgb),0.75);
  background: rgba(var(--bg-rgb),0.75); padding: 7px 14px; border-radius: 999px;
  max-width: 90%; text-align: center; overflow-wrap: anywhere;
}

/* ─── AI 讲解员 (chat) ─── */
.chat-overlay {
  position: fixed; inset: 0; background: rgba(5,5,4,0.62);
  opacity: 0; pointer-events: none; transition: opacity 0.3s ease; z-index: 1900;
}
.chat-overlay.open { opacity: 1; pointer-events: auto; }
.chat-panel {
  --panel-h: min(74vh, 700px);
  position: fixed; left: 0; right: 0; margin: 0 auto; max-width: 780px;
  height: min(var(--panel-h), var(--vv-h, 100dvh));
  top: calc(var(--vv-top, 0px) + var(--vv-h, 100dvh) - min(var(--panel-h), var(--vv-h, 100dvh)));
  background: var(--surface);
  border: 1px solid var(--line-strong); border-bottom: none;
  border-radius: 24px 24px 0 0;
  box-shadow: 0 -40px 100px -30px var(--sh-95);
  transform: translateY(106%);
  transition: transform 0.45s var(--ease);
  z-index: 2000; display: flex; flex-direction: column; overflow: hidden;
}
.chat-panel.open { transform: translateY(0); }
.chat-panel.fullscreen { --panel-h: 100dvh; border-radius: 0; max-width: none; border: none; }
body.chat-locked { overflow: hidden; position: relative; touch-action: none; }
body.chat-locked .chat-panel, body.chat-locked .chat-panel * { touch-action: auto; }
body.chat-locked .chat-body { touch-action: pan-y; }
.chat-grabber { flex: none; position: relative; width: 88px; height: 20px; padding: 0; border: 0; background: transparent; margin: 0 auto -8px; cursor: pointer; }
.chat-grabber::before { content: ''; position: absolute; left: 50%; top: 8px; transform: translateX(-50%); width: 38px; height: 4px; border-radius: 2px; background: rgba(var(--fg-rgb),0.28); }
/* Tucked away: the header alone stays, the map is free to use. */
.chat-panel.mini { --panel-h: calc(84px + env(safe-area-inset-bottom)); }
.chat-panel.mini .chat-body, .chat-panel.mini .chat-chips, .chat-panel.mini .chat-input-row, .chat-panel.mini .chat-sub, .chat-panel.mini .ai-pick, .chat-panel.mini .chat-tools > .icon-btn:not(:last-child) { display: none; }
.chat-panel.mini .chat-id { cursor: pointer; }
.sheet-mini { display: none; }
.sheet-mini-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--serif); font-size: 17px; font-weight: 600; color: var(--text); }
.sheet-mini-up { flex: none; width: 8px; height: 8px; margin-top: 4px; border-left: 1.5px solid var(--text-3); border-top: 1.5px solid var(--text-3); transform: rotate(45deg); }
.chat-panel.fullscreen .chat-grabber { visibility: hidden; }
.chat-head { flex: none; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px 12px 18px; border-bottom: 1px solid var(--line); }
.chat-id { display: flex; align-items: center; gap: 12px; min-width: 0; }
.chat-avatar {
  width: 38px; height: 38px; flex: none; border-radius: 13px;
  display: grid; place-items: center; color: var(--on-gilt);
  background: linear-gradient(135deg, var(--gilt-hi), var(--gilt-lo));
  box-shadow: 0 0 22px -6px rgba(var(--gilt-rgb),0.85);
}
.chat-title { font-family: var(--serif); font-weight: 700; font-size: 17px; color: var(--text); letter-spacing: 0.06em; }
.chat-sub { font-size: 11.5px; color: var(--text-3); margin-top: 1px; }
.chat-tools { display: flex; gap: 2px; align-items: center; }
/* model + effort picker: quiet icon, popover kept inside the panel */
.chat-head { position: relative; }
.ai-tune { color: var(--text-4); }
.ai-tune:hover, .ai-tune.on { color: var(--text-2); }
.ai-pop {
  position: absolute; z-index: 6; top: calc(100% + 4px); right: 10px;
  width: min(280px, calc(100% - 20px)); max-height: min(60vh, calc(var(--panel-h, 70vh) - 80px)); overflow-y: auto; overscroll-behavior: contain;
  padding: 8px; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--line-strong);
  box-shadow: 0 18px 40px -16px var(--sh-90);
}
.ai-fam { font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em; color: var(--text-4); text-transform: uppercase; padding: 8px 8px 3px; }
.ai-group + .ai-group { margin-top: 2px; }
.ai-row {
  display: flex; align-items: center; justify-content: space-between; width: 100%;
  padding: 7px 8px; border: none; border-radius: 8px; background: transparent;
  color: var(--text-2); font-size: 13px; text-align: left; cursor: pointer;
}
.ai-row:hover { background: rgba(var(--fg-rgb),0.06); }
.ai-row.on { color: var(--gilt-hi); }
.ai-ck { display: inline-grid; color: var(--gilt); }
.ai-efforts { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 8px 6px; }
.ai-eff {
  padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--text-3); font-family: var(--mono); font-size: 11.5px; cursor: pointer;
}
.ai-eff.on { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.55); background: rgba(var(--gilt-rgb),0.1); }
/* museums the guide mentions */
.mus-link { color: var(--gilt-hi); text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; cursor: pointer; }
.mus-link:hover { text-decoration-style: solid; }
.mention-btn {
  align-self: flex-start; margin-top: 8px; display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--text-3); font-size: 12px; cursor: pointer;
}
.mention-btn:hover { color: var(--seal-ink); border-color: rgba(var(--seal-rgb),0.5); }
.mention-pin {
  width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  background: rgba(var(--bg-rgb),0.92); color: var(--seal-ink); border: 2px solid var(--seal);
  font-family: var(--mono); font-size: 11.5px; font-weight: 600;
  box-shadow: 0 0 0 3px rgba(var(--seal-rgb),0.22), 0 0 18px rgba(var(--seal-rgb),0.7);
}
.mention-pin.visited { background: var(--seal); color: #fff; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.55), 0 0 16px rgba(var(--seal-rgb),0.85); }
.map-legend .dot.m { background: transparent; border: 2px solid var(--seal); box-shadow: 0 0 8px rgba(var(--seal-rgb),0.7); }
.map-legend .mention-chip .sep { color: var(--text-4); }
.map-legend .mention-chip button { border: none; background: transparent; padding: 0; color: var(--seal-ink); font-size: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.chat-body { flex: 1; overflow-y: auto; padding: 18px 18px 8px; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
.chat-empty { text-align: center; padding: 44px 20px; color: var(--text-3); font-size: 13.5px; line-height: 1.8; }
.chat-empty .ic { color: var(--gilt); margin-bottom: 12px; }
.chat-msg { display: flex; flex-direction: column; margin-bottom: 16px; min-width: 0; }
.chat-msg .who { font-size: 11px; letter-spacing: 0.1em; color: var(--text-4); margin-bottom: 6px; }
.chat-msg .text { min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
.chat-msg.assistant .text {
  padding: 14px 16px; border-radius: 4px 18px 18px 18px;
  background: var(--surface-2); border: 1px solid var(--line);
  box-shadow: inset 2px 0 0 rgba(var(--gilt-rgb),0.6);
}
.chat-msg.assistant .text.md-rich { font-size: 14.5px; }
.chat-msg.user { align-items: flex-end; }
.chat-msg.user .who { text-align: right; }
.chat-msg.user .text {
  max-width: 86%; padding: 11px 15px; border-radius: 18px 4px 18px 18px;
  background: rgba(var(--seal-rgb),0.16); border: 1px solid rgba(var(--seal-rgb),0.35);
  color: var(--text); font-size: 14.5px; line-height: 1.65; white-space: pre-wrap;
}
.chat-loading {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 999px;
  background: var(--surface-2); color: var(--text-3); font-size: 12.5px;
}
.dots { display: inline-flex; gap: 4px; }
.dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--gilt); animation: blink 1.2s infinite both; }
.dots i:nth-child(2) { animation-delay: 0.2s; }
.dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
.chat-chips { flex: none; display: flex; gap: 8px; padding: 10px 16px; overflow-x: auto; scrollbar-width: none; border-top: 1px solid var(--line); }
.chat-chips::-webkit-scrollbar { display: none; }
.chip {
  flex: none; white-space: nowrap; padding: 7px 13px; border-radius: 999px;
  border: 1px solid var(--line-strong); background: transparent;
  color: var(--text-2); font-size: 12.5px; cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.chip:hover { border-color: rgba(var(--gilt-rgb),0.5); color: var(--gilt-hi); }
.chat-input-row { flex: none; position: relative; display: flex; gap: 10px; align-items: center; padding: 10px 14px 14px; }
.chat-input {
  flex: 1; min-width: 0; height: 46px; padding: 0 18px;
  border-radius: 999px; border: 1px solid var(--line-strong);
  background: var(--bg-2); color: var(--text); font-size: 16px; outline: none;
  transition: border-color 0.2s;
}
.chat-input:focus { border-color: rgba(var(--gilt-rgb),0.6); }
.chat-input::placeholder { color: var(--text-4); }
.chat-send {
  width: 46px; height: 46px; flex: none; border-radius: 50%; border: none;
  display: grid; place-items: center;
  background: linear-gradient(135deg, var(--gilt-hi), var(--gilt-lo)); color: var(--on-gilt);
  transition: filter 0.2s, transform 0.15s;
}
.chat-send:hover:not(:disabled) { filter: brightness(1.08); }
.chat-send:active { transform: scale(0.95); }
.chat-send:disabled { background: var(--surface-3); color: var(--text-4); cursor: not-allowed; }
.cmd-palette {
  position: absolute; left: 14px; right: 14px; bottom: calc(100% + 6px); z-index: 10;
  background: var(--surface-2); border: 1px solid var(--line-strong); border-radius: 14px;
  box-shadow: 0 18px 40px -12px var(--sh-90);
  max-height: 260px; overflow-y: auto;
}
.cmd-item { padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--line); }
.cmd-item:last-child { border-bottom: none; }
.cmd-item:hover { background: var(--surface-3); }
.cmd-label { font-family: var(--mono); font-size: 13px; color: var(--gilt-hi); }
.cmd-desc { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.cmd-empty { padding: 12px 14px; font-size: 13px; color: var(--text-3); }

/* ─── Dock (replaces the three floating buttons) ─── */
.dock {
  position: fixed; z-index: 1400;
  left: calc(var(--toc-w, 380px) + 6px + (100vw - var(--toc-w, 380px) - 6px) / 2);
  bottom: calc(22px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 4px; padding: 6px;
  border-radius: 999px;
  background: rgba(var(--surface-rgb),0.94);
  border: 1px solid var(--line-strong);
  box-shadow: 0 24px 60px -18px var(--sh-95), inset 0 1px 0 rgba(255,255,255,0.05);
}
.dock-btn {
  height: 46px; padding: 0 16px; border-radius: 999px; border: none;
  display: inline-flex; align-items: center; gap: 8px;
  background: transparent; color: var(--text-2);
  font-size: 13.5px; font-weight: 500; white-space: nowrap;
  transition: background 0.2s, color 0.2s, filter 0.2s;
}
.dock-btn:hover { background: var(--surface-2); color: var(--text); }
.dock-btn:disabled { opacity: 0.6; cursor: default; }
.dock-btn .ic.spinning { animation: shakeSpin 0.6s linear infinite; }
.dock-ai {
  padding: 0 18px; color: var(--on-gilt);
  background: linear-gradient(135deg, var(--gilt-hi), var(--gilt-lo));
  box-shadow: 0 0 26px -8px rgba(var(--gilt-rgb),0.95);
}
.dock-ai:hover { background: linear-gradient(135deg, var(--gilt-hi), var(--gilt-lo)); color: var(--on-gilt); filter: brightness(1.07); }
.dock-index { display: none; }
.dock-sep { width: 1px; height: 22px; background: var(--line-strong); margin: 0 2px; }
@keyframes shakeSpin {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-20deg); }
  75% { transform: rotate(20deg); }
}

/* ─── Toast ─── */
.toast {
  position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  background: var(--text); color: var(--bg);
  padding: 10px 18px; border-radius: 999px;
  font-size: 13px; font-weight: 500; white-space: nowrap;
  box-shadow: 0 14px 34px -10px var(--sh-90);
  z-index: 5000; pointer-events: none;
}

/* ─── Confetti ─── */
.confetti-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 10000; overflow: hidden; }
.confetti-piece { position: absolute; display: block; border-radius: 1px; will-change: transform, opacity; }
@keyframes confettiFall {
  0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translate(var(--sway), 110vh) rotate(var(--spin)); opacity: 0; }
}
.confetti-banner {
  position: absolute; left: 50%; top: 38%;
  transform: translate(-50%, -50%);
  background: var(--surface); color: var(--text);
  border: 1px solid rgba(var(--gilt-rgb),0.5); border-radius: 20px;
  box-shadow: 0 0 70px -10px rgba(var(--gilt-rgb),0.55), 0 30px 60px -20px var(--sh-90);
  padding: 20px 26px;
  font-family: var(--serif); font-size: 17px; font-weight: 600;
  letter-spacing: 0.04em; text-align: center;
  max-width: min(86vw, 480px); line-height: 1.6;
  animation: confettiBannerIn 360ms cubic-bezier(.2,.8,.3,1.2) both,
             confettiBannerOut 400ms ease-in 2800ms both;
}
@keyframes confettiBannerIn {
  0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}
@keyframes confettiBannerOut {
  0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -70%) scale(0.92); opacity: 0; }
}

/* ─── 时空 (3D strata) ─── */
.canvas .strata-wrap, .canvas .map-wrap { position: absolute; inset: 0; }
.canvas.is-map .strata-wrap, .canvas.is-strata .map-wrap { visibility: hidden; pointer-events: none; }
.strata-wrap {
  overflow: hidden;
  background:
    radial-gradient(70% 55% at 50% 42%, var(--strata-glow-a), transparent 70%),
    radial-gradient(120% 80% at 50% 115%, var(--strata-glow-b), transparent 60%),
    var(--bg);
}
.strata-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.strata-canvas:active { cursor: grabbing; }
.strata-overlay { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.strata-label {
  position: absolute; left: 0; top: 0; pointer-events: auto;
  display: inline-flex; align-items: baseline; gap: 6px;
  padding: 3px 9px; border: none; border-radius: 999px; background: transparent;
  color: var(--text-3); font-family: var(--serif); font-size: 12px; font-weight: 600;
  white-space: nowrap; cursor: pointer;
  transition: color 0.2s, background 0.2s, opacity 0.3s;
}
.strata-label .sl-period { font-family: var(--mono); font-weight: 400; font-size: 9.5px; color: var(--text-4); }
.strata-label:hover, .strata-label.is-pick { color: var(--text); background: rgba(var(--bg2-rgb),0.75); }
/* The era a click on the model would open (hover over the model). */
.strata-label.is-pick { box-shadow: inset 0 0 0 1px rgba(var(--gilt-rgb),0.45); opacity: 1; }
.strata-label.is-active { color: var(--gilt-hi); background: rgba(var(--gilt-rgb),0.13); box-shadow: inset 0 0 0 1px rgba(var(--gilt-rgb),0.5); font-size: 14px; }
.strata-label.is-active .sl-period { color: var(--gilt); font-size: 10.5px; }
.strata-label.is-dim { opacity: 0.4; }
.strata-label.is-hl { color: var(--seal-ink-strong); background: rgba(var(--seal-rgb),0.1); }
/* How many of your seals sit on this stratum. */
.strata-label .sl-count {
  align-self: center; display: inline-grid; place-items: center; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 999px; background: var(--seal); color: #FFF2E8;
  font-family: var(--mono); font-size: 9.5px; font-weight: 600; box-shadow: 0 0 8px rgba(var(--seal-rgb),0.6);
}
.strata-label .sl-count:empty { display: none; }
.strata-label.is-empty { opacity: 0.45; }
.strata-label.is-today { color: var(--text); font-size: 13px; }
.strata-label.is-today .sl-period { color: var(--text-3); }
/* Regime names on a divided era's stratum (曹魏 / 蜀汉 / 孙吴 …) — map lettering, not chips */
.strata-part {
  position: absolute; left: 0; top: 0; white-space: nowrap; pointer-events: none;
  font-family: var(--serif); font-weight: 900; font-size: 22px; letter-spacing: 0.32em;
  color: rgba(var(--fg-rgb),0.34); text-shadow: 0 0 18px rgba(var(--bg-rgb),0.9);
}
/* Reading view (one era, from above): the ruler and hint give way to a title block —
   era, which year the territory shows, and where it comes from — and a way back. */
.strata-overlay.is-focus .strata-label { opacity: 0; pointer-events: none; }
.strata-overlay.is-focus .strata-hint { opacity: 0; }
.strata-credit {
  position: absolute; left: 16px; bottom: calc(94px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
  white-space: nowrap; pointer-events: none;
  font-size: 10.5px; line-height: 1.35; color: var(--text-3);
  text-shadow: 0 0 12px rgba(var(--bg-rgb),0.95), 0 0 3px rgba(var(--bg-rgb),0.9);
  opacity: 0; transform: translateY(6px); transition: opacity 0.45s ease, transform 0.45s ease;
}
.strata-credit .sc-name {
  display: inline-flex; align-items: baseline; gap: 9px; margin-bottom: 4px;
  font-family: var(--serif); font-weight: 900; font-size: 24px; letter-spacing: 0.08em; color: var(--text);
}
.strata-credit .sc-name small { font-family: var(--mono); font-weight: 400; font-size: 11px; letter-spacing: 0.02em; color: var(--gilt); }
.strata-credit > b { font-family: var(--serif); font-weight: 700; font-size: 12.5px; color: var(--gilt-hi); letter-spacing: 0.04em; }
.strata-credit > span { font-family: var(--mono); font-size: 9.5px; color: var(--text-4); }
.strata-credit.is-on { opacity: 1; transform: none; }
/* Over a bottom sheet the sheet names the era; the block keeps year + source, just above it. */
.strata-credit.is-sheet .sc-name { display: none; }
.strata-back {
  position: absolute; top: 14px; left: 14px;
  display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 14px 0 12px;
  border-radius: 999px; border: 1px solid var(--line-strong);
  background: rgba(var(--bg2-rgb),0.92); color: var(--text-2);
  box-shadow: 0 12px 30px -12px var(--sh-90);
  font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer;
  opacity: 0; pointer-events: none; transform: translateY(-4px);
  transition: opacity 0.35s ease, transform 0.35s ease, color 0.2s, border-color 0.2s;
}
.strata-back:hover { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.5); }
.strata-overlay.is-focus .strata-back { opacity: 1; pointer-events: auto; transform: none; }
.strata-site {
  position: absolute; left: 0; top: 0; white-space: nowrap;
  padding: 3px 8px; border-radius: 7px;
  font-family: var(--serif); font-size: 12px; font-weight: 600; color: var(--gilt-hi);
  background: rgba(var(--bg-rgb),0.78); border: 1px solid rgba(var(--gilt-rgb),0.38);
}
/* Reading a stratum: your seals (cinnabar) and nearby candidates (dashed gilt), tap to open. */
.strata-mtag {
  position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: auto; cursor: pointer;
  padding: 2px 7px; border: none; border-radius: 5px; white-space: nowrap;
  font-family: var(--serif); font-size: 12px; font-weight: 800; letter-spacing: 0.04em;
}
.strata-mtag.is-mine { background: var(--seal); color: #FFF2E8; box-shadow: 0 0 14px -2px rgba(var(--seal-rgb),0.8); }
.strata-mtag.is-mine.is-onsite { box-shadow: 0 0 0 1.5px rgba(var(--bg-rgb),0.95), 0 0 0 2.5px var(--seal), 0 0 16px -2px rgba(var(--seal-rgb),0.9); }
.strata-mtag.is-cand { background: rgba(var(--bg-rgb),0.85); color: var(--gilt-hi); border: 1px dashed rgba(var(--gilt-rgb),0.8); font-size: 11.5px; font-weight: 700; }
.strata-site.is-culture { color: var(--patina); border-color: rgba(var(--patina-rgb),0.38); }
.strata-tag {
  position: absolute; left: 0; top: 0; visibility: hidden; white-space: nowrap;
  padding: 5px 11px; border-radius: 999px;
  font-family: var(--serif); font-size: 13px; font-weight: 600; color: var(--text);
  background: rgba(var(--bg2-rgb),0.9); border: 1px solid var(--line-strong);
}
.strata-tag.is-selected { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.6); box-shadow: 0 0 22px -6px rgba(var(--gilt-rgb),0.7); }
.strata-hint {
  position: absolute; left: 50%; bottom: calc(90px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  padding: 6px 13px; border-radius: 999px; white-space: nowrap;
  font-size: 11.5px; letter-spacing: 0.04em; color: var(--text-3);
  background: rgba(var(--bg-rgb),0.66); border: 1px solid var(--line);
  transition: opacity 0.8s ease;
}
.strata-hint.is-gone { opacity: 0; }
/* 用脚步，给历史谱曲 — the first screen's line; leaves with the hint (it follows it in the DOM). */
.strata-motto {
  position: absolute; bottom: calc(132px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  pointer-events: none; text-align: center; white-space: nowrap;
  text-shadow: 0 0 14px rgba(var(--bg-rgb),0.95), 0 0 4px rgba(var(--bg-rgb),0.9);
  transition: opacity 0.8s ease;
}
.strata-motto small { font-size: 10.5px; letter-spacing: 0.32em; color: var(--text-3); }
.strata-motto b { font-family: var(--serif); font-weight: 700; font-size: 22px; letter-spacing: 0.14em; color: var(--text); }
.strata-hint.is-gone + .strata-motto,
.strata-overlay.is-focus .strata-motto,
.canvas.has-drawer .strata-motto { opacity: 0; }
.canvas .strata-motto { left: calc((100% - var(--drawer-w)) / 2); }
@media (max-width: 640px) {
  .strata-motto { bottom: calc(92px + env(safe-area-inset-bottom)); left: 50% !important; }
  .strata-motto small { font-size: 9.5px; letter-spacing: 0.24em; }
  .strata-motto b { font-size: 17px; letter-spacing: 0.1em; }
}
/* Phones: the time ruler runs down the left edge to the dock — keep the hint up top, under 溯洄 / 奏一曲. */
@media (max-width: 640px) { .strata-hint { bottom: auto; top: 106px; left: auto; right: 14px; transform: none; font-size: 11px; white-space: normal; max-width: min(220px, 56vw); text-align: right; text-wrap: balance; border-radius: 12px; line-height: 1.6; } }
/* 琴弦 sound on/off — only once you have strings to pluck */
.strata-sound {
  position: absolute; right: 14px; top: 14px;
  display: none; place-items: center; width: 38px; height: 38px; padding: 0;
  border-radius: 50%; border: 1px solid var(--line-strong); background: rgba(var(--bg2-rgb),0.88);
  color: var(--seal-ink-strong); cursor: pointer; pointer-events: auto;
  transition: color 0.2s, border-color 0.2s, opacity 0.3s;
}
.strata-overlay.has-strings .strata-sound { display: grid; }
.strata-sound.is-off { color: var(--text-4); }
.strata-sound:hover { border-color: rgba(var(--seal-rgb),0.5); }
.canvas.has-drawer .strata-sound { right: calc(var(--drawer-w) + 14px); }
/* 奏一曲 and 溯洄 — under the sound switch, so they never meet the view switch on a phone */
.strata-actions { position: absolute; right: 14px; top: 60px; display: flex; gap: 8px; pointer-events: none; }
.canvas.has-drawer .strata-actions { right: calc(var(--drawer-w) + 14px); }
.strata-play, .strata-voy-btn {
  display: none; align-items: center; gap: 6px; height: 34px; padding: 0 13px 0 11px;
  border-radius: 999px; border: 1px solid rgba(var(--seal-rgb),0.45); background: rgba(var(--bg2-rgb),0.9);
  color: var(--seal-ink-strong); font-family: var(--serif); font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
  white-space: nowrap; cursor: pointer; pointer-events: auto; box-shadow: 0 10px 26px -14px var(--sh-90);
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.strata-overlay.can-play .strata-play, .strata-overlay.can-play .strata-voy-btn { display: inline-flex; }
.strata-play:hover, .strata-voy-btn:hover { border-color: var(--seal); }
.strata-ji {
  display: none; align-items: center; height: 34px; padding: 0 13px; border-radius: 999px;
  border: 1px solid rgba(var(--seal-rgb),0.45); background: transparent; color: var(--seal);
  font-family: var(--serif); font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
  white-space: nowrap; cursor: pointer; pointer-events: auto; transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.strata-ji:hover { border-color: var(--seal); background: rgba(var(--seal-rgb),0.1); }
.strata-overlay.is-voyage .strata-ji { display: none !important; }
.strata-play.is-playing { background: var(--seal); border-color: var(--seal); color: #FFF2E8; }
/* 溯洄 — sink from today to the Neolithic, a layer at a time */
.strata-overlay.is-focus .strata-voy-btn { display: none; }
.strata-overlay.is-voyage .strata-play, .strata-overlay.is-voyage .strata-voy-btn { display: none; }
/* Phones: with a museum's sheet open, 溯洄 / 听一曲 step aside for the museum's name on its beam
   (an era's 听 stays; a tune already playing keeps its stop button). */
@media (max-width: 640px) {
  .canvas.has-drawer .strata-overlay:not(.is-focus) .strata-voy-btn,
  .canvas.has-drawer .strata-overlay:not(.is-focus) .strata-play:not(.is-playing) { display: none; }
}
.strata-overlay.is-voyage .strata-sound { display: grid; }
.strata-voy-ctl { display: none; gap: 6px; pointer-events: auto; }
.strata-overlay.is-voyage .strata-voy-ctl { display: inline-flex; }
.strata-voy-ctl .sv-btn {
  display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 11px;
  border-radius: 999px; border: 1px solid var(--line-strong); background: rgba(var(--bg2-rgb),0.9);
  color: var(--text-2); font-family: var(--serif); font-size: 12.5px; font-weight: 600; letter-spacing: 0.04em;
  white-space: nowrap; cursor: pointer; box-shadow: 0 10px 26px -14px var(--sh-90);
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}
.strata-voy-ctl .sv-btn:hover { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.5); }
.strata-voy-ctl .sv-btn.is-paused { background: var(--seal); border-color: var(--seal); color: #FFF2E8; }
.strata-voy-ctl .sv-close { padding: 0; width: 32px; justify-content: center; }
.strata-overlay.is-voy-end .strata-voy-ctl .sv-btn:not(.sv-close) { display: none; }
.strata-label.is-voy { color: var(--gilt-hi); background: rgba(var(--gilt-rgb),0.13); box-shadow: inset 0 0 0 1px rgba(var(--gilt-rgb),0.5); }
.strata-label.is-voy .sl-period { color: var(--gilt); }
.strata-voy-cap {
  position: absolute; left: 50%; bottom: calc(94px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  width: min(460px, calc(100% - 28px)); box-sizing: border-box; z-index: 6;
  display: none; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: 11px 16px 12px; border-radius: 14px; pointer-events: none; text-align: left;
  background: rgba(var(--bg-rgb),0.82); border: 1px solid var(--line); color: var(--text-2);
  box-shadow: 0 14px 34px -18px var(--sh-90); overflow-wrap: anywhere; word-break: break-word;
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.canvas.has-drawer .strata-voy-cap { left: calc((100% - var(--drawer-w)) / 2); width: min(460px, calc(100% - var(--drawer-w) - 28px)); }
.strata-voy-cap.is-on { display: flex; animation: voy-in 0.5s ease-out; }
.strata-voy-cap .vc-head { display: flex; align-items: baseline; gap: 9px; min-width: 0; flex-wrap: wrap; }
.strata-voy-cap .vc-name { font-family: var(--serif); font-weight: 900; font-size: 24px; letter-spacing: 0.08em; color: var(--text); }
.strata-voy-cap .vc-head small { font-family: var(--mono); font-size: 11px; color: var(--gilt); }
.strata-voy-cap .vc-line { font-family: var(--serif); font-size: 13px; line-height: 1.5; color: var(--text-2); }
.strata-voy-cap .vc-line.is-quote { font-size: 19px; font-weight: 700; letter-spacing: 0.1em; color: var(--text); margin-top: 2px; }
.strata-voy-cap .vc-sub { font-family: var(--mono); font-size: 11px; color: var(--text-4); }
.strata-voy-cap .vc-mine { font-size: 12px; line-height: 1.45; color: var(--seal-ink-strong); }
.strata-voy-cap .vc-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; pointer-events: auto; }
.strata-voy-cap .vc-btn {
  height: 34px; padding: 0 15px; border-radius: 999px; border: 1px solid var(--line-strong); background: rgba(var(--bg2-rgb),0.92);
  color: var(--text-2); font-family: var(--serif); font-size: 13px; font-weight: 700; letter-spacing: 0.06em; cursor: pointer;
}
.strata-voy-cap .vc-btn:hover { border-color: var(--seal); }
.strata-voy-cap .vc-btn.is-main { background: var(--seal); border-color: var(--seal); color: #FFF2E8; }
@keyframes voy-in { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%); } }
@media (max-width: 640px) {
  .strata-voy-cap { padding: 9px 13px 10px; }
  .strata-voy-cap .vc-name { font-size: 20px; }
  .strata-voy-cap .vc-line.is-quote { font-size: 17px; }
  .strata-voy-ctl .sv-btn { padding: 0 9px; font-size: 12px; }
  .strata-voy-ctl .sv-close { padding: 0; }
}
@media (prefers-reduced-motion: reduce) { .strata-voy-cap.is-on { animation: none; } }
/* 此声取自: the object behind the era now sounding */
.strata-now {
  position: absolute; top: 108px; right: 14px; max-width: min(300px, 62vw);
  display: none; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right;
  padding: 7px 12px; border-radius: 12px; pointer-events: none; cursor: default;
  background: rgba(var(--bg-rgb),0.95); border: 1px solid var(--line); color: var(--text-2);
  font: inherit; overflow-wrap: anywhere; box-shadow: 0 10px 26px -16px var(--sh-90);
  z-index: 6; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.strata-now em { font-style: normal; }
.strata-now .nc-tune { margin-top: 3px; color: var(--seal-ink-strong); opacity: 0.85; font-family: var(--serif); font-size: 12px; }
/* Phones: one compact line under the play button, so the sounding seals stay visible */
@media (max-width: 640px) {
  .strata-now { flex-direction: row; align-items: baseline; gap: 6px; max-width: 64vw; padding: 5px 22px 5px 10px; border-radius: 999px; }
  .strata-now b { font-size: 13px; flex: none; }
  .strata-now span { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 0; }
  .strata-now .nc-from, .strata-now .nc-museum { display: none; }
  /* With a 名曲, the phone line names the tune instead of the object */
  .strata-now.has-tune .nc-src { display: none; }
  .strata-now .nc-tune { margin-top: 0; font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .strata-now i { bottom: auto; top: 50%; transform: translateY(-50%); }
}
.strata-now.is-on { display: flex; animation: now-in 0.35s ease-out; }
.strata-now.has-link { pointer-events: auto; cursor: pointer; }
.strata-now.has-link:hover { border-color: rgba(var(--seal-rgb),0.5); }
.strata-now b { font-family: var(--serif); font-size: 15px; font-weight: 600; color: var(--seal-ink-strong); letter-spacing: 0.06em; }
.strata-now span { font-size: 11.5px; line-height: 1.45; color: var(--text-3); }
.strata-now i { font-style: normal; font-size: 13px; color: var(--seal-ink-strong); position: absolute; right: 8px; bottom: 6px; }
.strata-now.has-link span { padding-right: 12px; }
.canvas.has-drawer .strata-now { right: calc(var(--drawer-w) + 14px); }
.canvas.has-drawer .strata-listen { right: calc(var(--drawer-w) + 14px); }
@keyframes now-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .strata-now.is-on { animation: none; } }
/* 听原曲: a real guqin performance of the era's piece, credited while it plays */
.strata-now.has-listen { pointer-events: auto; }
.strata-now .nc-listen { margin-top: 4px; color: var(--gilt); font-size: 12px; cursor: pointer; border-bottom: 1px solid rgba(var(--gilt-rgb),0.4); }
.strata-now .nc-listen:hover { color: var(--gilt-hi); }
.strata-listen {
  position: absolute; top: 108px; right: 14px; max-width: min(320px, 70vw); z-index: 6;
  display: none; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px 8px; text-align: right;
  padding: 8px 12px; border-radius: 12px; overflow-wrap: anywhere;
  background: rgba(var(--bg-rgb),0.95); border: 1px solid rgba(var(--gilt-rgb),0.35); color: var(--text-2);
  box-shadow: 0 10px 26px -16px var(--sh-90); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}
.strata-listen.is-on { display: flex; animation: now-in 0.35s ease-out; }
.strata-listen b { color: var(--gilt); font-weight: 500; }
.strata-listen .sl-about { font-size: 12px; flex: 1 1 100%; }
.strata-listen .sl-credit { font-family: var(--mono); font-size: 10.5px; color: var(--text-3); }
.strata-listen .sl-credit a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.strata-listen .sl-stop { all: unset; cursor: pointer; width: 26px; height: 26px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 10px; color: var(--seal-ink-strong); border: 1px solid rgba(var(--seal-rgb),0.45); }
.strata-listen .sl-lead { font-size: 11.5px; color: var(--text-3); flex: 1 1 100%; }
.strata-listen .sl-chip { all: unset; cursor: pointer; font-size: 12px; padding: 4px 10px; border-radius: 999px; color: var(--gilt); border: 1px solid rgba(var(--gilt-rgb),0.4); }
.strata-listen .sl-chip:hover, .strata-listen .sl-stop:hover { border-color: var(--gilt-hi); color: var(--gilt-hi); }
@media (max-width: 640px) {
  .strata-now .nc-listen { flex: none; margin-top: 0; font-size: 11.5px; white-space: nowrap; }
  .strata-listen { max-width: calc(100vw - 28px); }
}
@media (prefers-reduced-motion: reduce) { .strata-listen.is-on { animation: none; } }
/* The era being played */
.strata-label.is-playing { color: var(--seal-ink-strong); background: rgba(var(--seal-rgb),0.14); box-shadow: inset 0 0 0 1px rgba(var(--seal-rgb),0.45); transform-origin: left center; }
/* Eras playing along with the lead */
.strata-label.is-joined { color: var(--seal-ink-strong); box-shadow: inset 0 0 0 1px rgba(var(--seal-rgb),0.22); background: rgba(var(--seal-rgb),0.05); }
/* The instrument of the era being played */
.strata-label .sl-inst { display: none; font-family: var(--mono); font-size: 10px; letter-spacing: 0.08em; color: var(--seal-ink-strong); padding: 1px 6px; border-radius: 999px; border: 1px solid rgba(var(--seal-rgb),0.4); white-space: nowrap; }
.strata-label.is-playing .sl-inst { display: inline-block; }
.strata-label.is-playing .sl-period { display: none; }
/* 留白: an era without your strings still sounds, quieter */
.strata-label.is-playing.is-rest { color: var(--text-3); background: rgba(var(--seal-rgb),0.05); box-shadow: inset 0 0 0 1px rgba(var(--seal-rgb),0.2); }
.strata-label.is-rest .sl-inst { color: var(--text-3); border-style: dashed; border-color: var(--line-2, rgba(var(--seal-rgb),0.25)); }
/* A seal label rings with its note in the reading view */
.strata-mtag.is-sounding { animation: mtag-ring 0.55s ease-out; }
@keyframes mtag-ring {
  0% { box-shadow: 0 0 0 0 rgba(var(--seal-rgb),0.75), 0 0 18px -2px rgba(var(--seal-rgb),0.9); filter: brightness(1.25); }
  100% { box-shadow: 0 0 0 10px rgba(var(--seal-rgb),0), 0 0 14px -2px rgba(var(--seal-rgb),0.6); filter: none; }
}
@media (prefers-reduced-motion: reduce) { .strata-mtag.is-sounding { animation: none; } }
/* Desktop: with the side drawer open, floating controls re-centre on what stays visible. */
.canvas { --drawer-w: 0px; }
.canvas.has-drawer { --drawer-w: min(580px, 94%); }
.canvas .strata-hint { left: calc((100% - var(--drawer-w)) / 2); }
/* Once a detail is open the visitor has found their way in — and on desktop the strip left
   between index and drawer is too narrow for the pill to clear the ruler labels. */
.canvas.has-drawer .strata-hint { opacity: 0; }
.canvas.has-drawer .locate-btn { right: calc(var(--drawer-w) + 14px); }
.view-switch {
  position: absolute; top: 14px; left: calc((100% - var(--drawer-w)) / 2); transform: translateX(-50%); z-index: 600;
  transition: left 0.45s var(--ease);
  display: flex; gap: 2px; padding: 3px; border-radius: 999px; width: max-content;   /* left:50% would otherwise cap it at half the canvas */
  background: rgba(var(--bg2-rgb),0.92); border: 1px solid var(--line-strong);
  box-shadow: 0 12px 30px -12px var(--sh-90);
}
.view-switch button {
  height: 32px; padding: 0 15px; border: none; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; flex: none;
  background: transparent; color: var(--text-3); font-size: 13px; font-weight: 500;
  transition: background 0.2s, color 0.2s;
}
.view-switch button:hover { color: var(--text); }
.view-switch button.active { background: var(--surface-3); color: var(--gilt-hi); box-shadow: inset 0 0 0 1px rgba(var(--gilt-rgb),0.38); }
.locate-btn {
  position: absolute; top: 14px; right: 14px; z-index: 600;
  height: 38px; padding: 0 14px; border-radius: 999px;
  display: inline-flex; align-items: center; gap: 6px;
  background: rgba(var(--bg2-rgb),0.92); border: 1px solid var(--line-strong); color: var(--text-2);
  font-size: 12.5px; box-shadow: 0 12px 30px -12px var(--sh-90);
}
.locate-btn:hover, .locate-btn.on { color: #A9CCFF; border-color: rgba(127,181,255,0.45); }
path.range-ring { fill: var(--gilt); fill-opacity: 0.05; stroke: var(--gilt); stroke-opacity: 0.8; }
path.territory { fill: var(--gilt); fill-opacity: 0.15; stroke: var(--gilt); stroke-opacity: 0.85; stroke-dasharray: 6 4; }
path.era-trail { stroke: var(--gilt); stroke-opacity: 0.95; fill: none; }
path.era-chain { stroke: var(--gilt); stroke-opacity: 0.7; stroke-dasharray: 3 4; fill: none; }
.era-label, .era-site-wrap, .era-arrow-wrap { pointer-events: none; background: none; border: 0; }
.era-label span {
  display: block; transform: translate(-50%, -50%); white-space: nowrap;
  font-family: var(--serif); font-size: 13px; letter-spacing: 0.18em; color: var(--text-2); opacity: 0.8;
  text-shadow: 0 0 6px rgba(var(--bg-rgb),0.95), 0 0 2px rgba(var(--bg-rgb),0.95), 0 0 12px rgba(var(--bg-rgb),0.8);
}
.era-zoom-lo .era-region-label { display: none; }
.era-site { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 5px; white-space: nowrap; transform: translate(-5px, -50%); }
.era-site i { width: 10px; height: 10px; flex: none; transform: rotate(45deg); background: var(--seal); border: 1.5px solid var(--seal); box-shadow: 0 0 0 2px rgba(var(--bg-rgb),0.85); }
.era-site.is-secondary i { background: rgba(var(--bg-rgb),0.9); }
.era-site span {
  font-family: var(--serif); font-size: 12px; font-weight: 600; color: var(--text);
  text-shadow: 0 0 5px rgba(var(--bg-rgb),0.95), 0 0 2px rgba(var(--bg-rgb),0.95);
}
.era-site em { font-style: normal; font-weight: 400; font-size: 10.5px; color: var(--text-3); }
.era-site.is-secondary span { font-weight: 400; color: var(--text-2); }
.era-zoom-far .era-site em, .era-zoom-far .era-site.is-secondary span { display: none; }
.era-arrow { display: block; width: 0; height: 0; margin: -5px 0 0 -4px; border-left: 9px solid var(--gilt-hi); border-top: 5px solid transparent; border-bottom: 5px solid transparent; filter: drop-shadow(0 0 2px rgba(var(--bg-rgb),0.9)); }
.map-legend .era-chip { flex-wrap: nowrap; align-items: baseline; white-space: normal; max-width: 320px; }
.map-legend .era-chip .era-chip-txt { white-space: normal; }
.map-legend .era-chip .sep { color: var(--text-4); }
.map-legend .era-chip .era-short { display: none; }
/* Phones: tile labels (亚洲…) slide under the view switch; a paper band keeps the controls legible. */
@media (max-width: 640px) { .canvas.is-map::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 66px; z-index: 550; pointer-events: none; background: linear-gradient(rgba(var(--bg-rgb),0.97) 62%, rgba(var(--bg-rgb),0)); } }
@media (max-width: 640px) { .map-legend .era-chip .era-long { display: none; } .map-legend .era-chip .era-short { display: inline; white-space: nowrap; } }
.map-legend .era-chip button { border: none; background: transparent; padding: 0; color: var(--gilt-hi); font-size: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.strata-credit .sc-map { pointer-events: auto; margin-top: 6px; padding: 5px 12px; border-radius: 999px; border: 1px solid rgba(var(--gilt-rgb),0.55); background: rgba(var(--bg2-rgb),0.7); color: var(--gilt-hi); font-family: var(--serif); font-size: 12.5px; letter-spacing: 0.04em; cursor: pointer; }
.strata-credit .sc-map:hover { background: rgba(var(--gilt-rgb),0.18); }
path.route-glow { stroke: var(--gilt); }
path.route-line { stroke: var(--gilt-hi); }
.route-stop {
  width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
  background: var(--gilt); color: var(--on-gilt); font-family: var(--mono); font-size: 11px; font-weight: 500;
  box-shadow: 0 0 0 2px rgba(var(--bg-rgb),0.92), 0 0 16px rgba(var(--gilt-rgb),0.85);
}
.user-dot {
  width: 16px; height: 16px; border-radius: 50%;
  background: #7FB5FF; border: 3px solid #EFE8DA;
  box-shadow: 0 0 0 6px rgba(127,181,255,0.22), 0 0 20px rgba(127,181,255,0.7);
}

/* ─── 集章册 / 行程 / 朝代 heads ─── */
.rank-line { position: relative; display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.rank-badge {
  padding: 4px 11px; border-radius: 999px;
  font-family: var(--serif); font-weight: 700; font-size: 13px; color: var(--seal-ink-hi);
  background: linear-gradient(135deg, rgba(var(--seal-rgb),0.42), rgba(var(--seal-rgb),0.14));
  border: 1px solid rgba(var(--seal-rgb),0.55);
}
.rank-next { font-size: 12px; color: var(--text-3); }
.seal-wall {
  position: relative; display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr));
  gap: 16px 6px; margin-top: 20px; padding: 18px 10px 14px; border-radius: 18px;
  background: radial-gradient(80% 60% at 50% 0%, rgba(var(--seal-rgb),0.07), transparent 70%), rgba(var(--fg-rgb),0.02);
  border: 1px solid var(--line);
}
.seal-cell {
  display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 0;
  padding: 4px 2px 2px; border: none; border-radius: 12px; background: none;
}
.seal-cell:hover { background: rgba(var(--fg-rgb),0.04); }
.seal-cell-art { height: 54px; display: grid; place-items: center; }
.seal-cell-name {
  max-width: 100%; font-size: 11.5px; line-height: 1.35; color: var(--text-2); text-align: center;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.seal-cell-date { font-family: var(--mono); font-size: 9.5px; color: var(--text-4); }
.review-block { position: relative; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
.block-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-family: var(--serif); font-weight: 700; font-size: 15px; color: var(--text); }
.block-head .ic { color: var(--gilt); }
.block-head .block-en { margin-left: auto; font-family: var(--mono); font-weight: 400; font-size: 10px; letter-spacing: 0.2em; color: var(--text-4); }
.review-block .guide-card { margin-top: 12px; }

/* 地层账本 — your seals per stratum (今 → 远古), and what's nearby to fill the gaps */
.ledger { position: relative; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
.ledger-lede { margin: 2px 0 10px; font-size: 12px; line-height: 1.65; color: var(--text-3); }
.ledger-tabs { display: flex; gap: 3px; padding: 3px; margin: 10px 0 12px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
.ledger-near { margin-bottom: 14px; }
.ledger-anchor { display: flex; flex-wrap: wrap; gap: 6px; }
.ledger-anchor .chip { position: relative; display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; font-size: 12px; }
.ledger-anchor .chip.on { border-color: rgba(var(--gilt-rgb),0.7); color: var(--gilt-hi); background: rgba(var(--gilt-rgb),0.1); }
/* The real select sits invisibly on top at 16px (no iOS zoom); the chip shows the choice. */
.chip-select select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; font-size: 16px; cursor: pointer; }
.ledger-radius { display: flex; gap: 3px; padding: 3px; margin-top: 8px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
.ledger-radius .seg-btn { height: 26px; font-family: var(--mono); font-size: 11.5px; }
.ledger-summary { margin: 10px 0 0; font-size: 12.5px; line-height: 1.7; color: var(--text-2); overflow-wrap: anywhere; }
.ledger-summary b { color: var(--text); font-weight: 600; }
.ledger-summary b.seal-ink { color: var(--seal-ink-strong); }
.ledger-recs { display: grid; gap: 6px; margin-top: 12px; }
.ledger-recs-head { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; color: var(--gilt); }
.lg-rec { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; border: 1px dashed rgba(var(--gilt-rgb),0.45); background: rgba(var(--gilt-rgb),0.05); }
.lg-rec-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 0; border: none; background: none; color: inherit; text-align: left; cursor: pointer; }
.lg-rec-seal { flex: none; display: grid; place-items: center; width: 34px; }
.lg-rec-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.lg-rec-text b { font-family: var(--serif); font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lg-rec-text small { font-size: 11.5px; color: var(--text-3); overflow-wrap: anywhere; }
.lg-rec-trip { flex: none; height: 28px; padding: 0 10px; border-radius: 999px; border: 1px solid rgba(var(--gilt-rgb),0.55); background: transparent; color: var(--gilt-hi); font-size: 12px; white-space: nowrap; cursor: pointer; }
.lg-rec-trip.is-in { border-color: var(--line); color: var(--text-3); }
.ledger-rows { display: flex; flex-direction: column; }
.lg-row { display: grid; grid-template-columns: 76px minmax(0, 1fr) 20px; gap: 8px; align-items: center; min-height: 42px; padding: 5px 0; border-bottom: 1px solid rgba(var(--fg-rgb),0.05); }
.lg-era { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; margin-left: -6px; padding: 4px 6px; border: none; border-radius: 8px; background: none; color: var(--text); text-align: left; cursor: pointer; }
.lg-era:hover { background: rgba(var(--fg-rgb),0.05); }
.lg-era b { font-family: var(--serif); font-size: 13px; font-weight: 700; white-space: nowrap; }
.lg-era small { font-family: var(--mono); font-size: 9px; color: var(--text-4); white-space: nowrap; }
.lg-row.is-empty .lg-era b { color: var(--text-4); font-weight: 600; }
.lg-seals { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0; }
.lg-seal, .lg-cand { display: inline-flex; align-items: center; gap: 4px; padding: 2px; border: none; border-radius: 6px; background: none; cursor: pointer; }
.lg-seal .seal, .lg-cand .seal { transition: transform 0.2s var(--ease); }
.lg-seal:hover .seal, .lg-cand:hover .seal { transform: rotate(0deg) scale(1.12); }
.lg-km { font-family: var(--mono); font-size: 10px; color: var(--gilt); white-space: nowrap; }
.lg-bridge { font-size: 11px; color: var(--gilt); }
.lg-count { font-family: var(--mono); font-size: 11px; text-align: right; color: var(--seal-ink-strong); }
.seal-xs { font-size: 8px; }
/* In the ledger the carving gives way to the meaning: solid = on-site (原址), outline = related. */
.lg-seal.is-onsite .seal {
  background-color: var(--seal); color: #FFF2E8; text-shadow: none;
  box-shadow: inset 0 0 0 0.12em var(--seal), inset 0 0 0 0.19em rgba(255,242,232,0.55), 0 0 1em -0.3em rgba(var(--seal-rgb),0.85);
}
.lg-seal.is-related .seal {
  color: var(--seal-ink-strong); background: rgba(var(--seal-rgb),0.06); background-image: none; text-shadow: none;
  box-shadow: inset 0 0 0 0.14em var(--seal-ink-strong);
}
/* A seal still to collect nearby: dashed gilt. */
.seal.seal-cand { box-sizing: border-box; color: var(--gilt-hi); box-shadow: none; border: 0.1em dashed rgba(var(--gilt-rgb),0.85); }

.trip-no {
  width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
  background: var(--gilt); color: var(--on-gilt); font-family: var(--mono); font-size: 12px; font-weight: 500;
  box-shadow: 0 0 14px -2px rgba(var(--gilt-rgb),0.75);
}
.trip-main { min-width: 0; border: none; background: none; padding: 0; text-align: left; }
.trip-name { display: block; font-family: var(--serif); font-weight: 700; font-size: 15px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trip-ops { display: flex; }
.trip-ops .icon-btn { width: 28px; height: 28px; }
.trip-ops .icon-btn:disabled { opacity: 0.22; cursor: default; }
/* 行程 · 沿途找馆 */
.trip-title { font-size: clamp(22px, 2.4vw, 30px); line-height: 1.25; overflow-wrap: anywhere; }
.trip-mode { margin: 4px 0 14px; }
.trip-cities { list-style: none; margin: 0 0 10px; padding: 0; }
.trip-city-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.trip-city-name { flex: 1; font-family: var(--serif); font-size: 17px; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.trip-days { display: inline-flex; align-items: center; gap: 4px; font-family: var(--mono); font-size: 12px; color: var(--text-2); }
.trip-hop { margin: 0 0 2px 13px; padding: 4px 0 6px 18px; border-left: 1px dashed var(--line-strong); font-family: var(--mono); font-size: 11.5px; color: var(--text-3); }
.trip-add { position: relative; margin-bottom: 12px; }
.trip-search { width: 100%; font-size: 16px; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--line-strong); background: var(--bg-2); color: var(--text); }
.trip-suggest { margin-top: 6px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg-2); }
.trip-suggest button { display: flex; width: 100%; justify-content: space-between; gap: 10px; padding: 9px 14px; border: 0; background: none; color: var(--text); text-align: left; cursor: pointer; }
.trip-suggest button + button { border-top: 1px solid var(--line); }
.trip-suggest small { color: var(--text-3); }
.trip-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.trip-chips .chip small { margin-left: 4px; color: var(--text-3); font-family: var(--mono); }
.trip-radius { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-2); margin-bottom: 10px; }
.trip-busy { font-family: var(--mono); font-size: 11.5px; color: var(--text-3); }
.trip-theme { margin: 4px 0 14px; padding: 10px 12px; border-radius: 12px; background: rgba(var(--seal-rgb), 0.07); color: var(--text-2); font-size: 13.5px; overflow-wrap: anywhere; }
.trip-theme b { color: var(--seal-ink-strong); font-weight: 600; }
.trip-group { margin-bottom: 14px; }
.trip-group-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); font-family: var(--serif); font-weight: 600; }
.trip-group-head small { font-family: var(--mono); font-weight: 400; font-size: 11.5px; color: var(--text-3); }
.trip-pick { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-bottom: 1px solid var(--line); }
.trip-check { flex: none; width: 24px; height: 24px; border-radius: 7px; border: 1.5px solid var(--line-strong); background: none; color: transparent; display: grid; place-items: center; cursor: pointer; margin-top: 2px; }
.trip-pick.on .trip-check { background: var(--seal); border-color: var(--seal); color: #FFF2E8; }
.trip-pick .trip-main { flex: 1; min-width: 0; text-align: left; background: none; border: 0; padding: 0; color: inherit; cursor: pointer; }
.trip-pick .trip-name { display: block; font-size: 15px; overflow: visible; text-overflow: clip; white-space: normal; overflow-wrap: anywhere; }
.trip-why { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
.trip-why .why { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--text-2); }
.trip-why .why-must { color: var(--seal-ink-strong); border-color: rgba(var(--seal-rgb), 0.45); }
.trip-why .why-fill, .trip-why .why-link { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb), 0.5); }
.trip-why .why-km { font-family: var(--mono); font-size: 11px; color: var(--text-3); padding: 1px 0; }
.trip-plan { margin: 6px 0 14px; }
.trip-day { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
.trip-day b { font-family: var(--mono); font-weight: 500; color: var(--text-2); }
.trip-day .trip-day-stops { grid-column: 2; color: var(--text-2); overflow-wrap: anywhere; }
.trip-day small { grid-column: 2; color: var(--seal-ink-strong); font-size: 11.5px; }
.route-city { display: inline-flex; align-items: center; gap: 5px; transform: translate(-11px, -11px); white-space: nowrap; }
.route-city b { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--gilt); color: var(--bg); font: 600 12px/1 var(--mono); box-shadow: 0 0 0 3px rgba(var(--bg-rgb), 0.7); }
.route-city span { font-family: var(--serif); font-weight: 600; font-size: 13px; color: var(--text); text-shadow: 0 0 4px var(--bg), 0 0 8px var(--bg); }
path.route-corridor { stroke: var(--gilt); }
.ask-city-pop .leaflet-popup-content-wrapper { border-radius: 999px; padding: 0; background: var(--bg-2); }
.ask-city-pop .leaflet-popup-content { margin: 0; }
.ask-city { border: 0; background: none; color: var(--seal-ink-strong); font: 600 13px var(--sans); padding: 8px 14px; cursor: pointer; white-space: nowrap; }
/* Phones: in 行程 the panel is a bottom sheet, the map stays in view above it. */
@media (max-width: 920px) {
  .stage.is-trip .toc-wrap { top: auto; bottom: 0; left: 0; right: 0; width: auto; height: 62dvh; transform: translateY(104%); }
  .stage.is-trip .toc-wrap.open { transform: translateY(0); }
  .stage.is-trip .toc-wrap .toc { border-right: 0; border-top: 1px solid var(--line-strong); border-radius: 22px 22px 0 0; padding-top: 6px; box-shadow: 0 -24px 60px -30px var(--sh-95); }
  .stage.is-trip .toc-overlay { display: none; }
  .stage.is-trip .toc-account, .stage.is-trip .hall-row { display: none; }
  .stage.is-trip .toc-wrap.open.mini { transform: translateY(calc(100% - 68px - env(safe-area-inset-bottom))); }
  .stage.is-trip .trip-grabber {
    display: flex; align-items: center; position: absolute; z-index: 5; left: 0; right: 0; top: 0; height: 30px;
    padding: 0 22px; border: 0; background: transparent; cursor: pointer;
  }
  .stage.is-trip .trip-grabber::before {
    content: ''; position: absolute; left: 50%; top: 8px; transform: translateX(-50%);
    width: 38px; height: 4px; border-radius: 2px; background: rgba(var(--fg-rgb),0.42);
  }
  .stage.is-trip .toc-wrap.mini .trip-grabber { height: 68px; padding-top: 6px; background: var(--surface); border-radius: 22px 22px 0 0; }
  .stage.is-trip .toc-wrap.mini .toc { overflow: hidden; }
}
.trip-grabber { display: none; }
/* Sheet handles take every touch themselves: no double-tap-zoom guess or native pan on them,
   so a drag right after a tap isn't taken over (and cancelled) by iOS. */
.drawer-grabber, .drawer .sheet-mini, .chat-grabber, .chat-panel .chat-id, .trip-grabber { touch-action: none !important; }

.trip-chips .chip { font: inherit; font-size: 13px; padding: 5px 11px; }
.tb-btn.active { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb),0.6); background: rgba(var(--gilt-rgb),0.12); }
.tb-count { font-family: var(--mono); font-weight: 500; color: var(--gilt-hi); }

.capital-line { position: relative; display: flex; align-items: flex-start; gap: 6px; margin-top: 12px; font-size: 13px; line-height: 1.65; color: var(--text-2); }
.capital-line .ic { color: var(--gilt); margin-top: 3px; }
.dyn-nav { position: relative; display: flex; gap: 8px; margin-top: 16px; }
.dyn-nav-gap { flex: 1; }
.dyn-nav .btn { height: 34px; padding: 0 12px; font-family: var(--serif); }

/* ─── Drawer extras ─── */
.spin-wrap { display: inline-flex; }
.spin-wrap.spinning { animation: shakeSpin 0.6s linear infinite; }
.sec-intro { border-top: none; padding-top: 6px; }
.intro-overview { margin-top: 12px; font-size: 14.5px; color: var(--text-2); }
.move-line {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin-bottom: 12px; padding: 12px 14px; border-radius: 14px;
  background: rgba(var(--gilt-rgb),0.06); border: 1px solid rgba(var(--gilt-rgb),0.22);
  font-size: 13.5px;
}
.move-from { color: var(--text-3); }
.move-arrow { display: inline-flex; color: var(--gilt); }
.move-to { font-family: var(--serif); font-weight: 700; color: var(--gilt-hi); }
.move-km { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--text-3); }
.move-note { margin: 0 0 12px; font-size: 13.5px; line-height: 1.8; color: var(--text-2); }
.site-list { list-style: none; margin: 0; padding: 0; }
.site-list li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 14px; }
.site-list li:first-child { border-top: none; }
.site-name { font-family: var(--serif); font-weight: 600; color: var(--text); }
.site-list li.on-trail .site-name { color: var(--gilt-hi); }
.site-role { font-size: 12px; color: var(--text-3); text-align: right; }
.cross-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.cross-list li {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center;
  padding: 10px 12px; border-radius: 12px; background: rgba(var(--fg-rgb),0.03); border: 1px solid var(--line);
}
.cross-dyn {
  padding: 3px 9px; border-radius: 8px; white-space: nowrap;
  border: 1px solid rgba(var(--gilt-rgb),0.3); background: rgba(var(--gilt-rgb),0.1);
  color: var(--gilt-hi); font-family: var(--serif); font-weight: 700; font-size: 13px;
}
.cross-place { min-width: 0; font-size: 13px; line-height: 1.55; color: var(--text); }
.cross-tag { font-family: var(--mono); font-size: 10.5px; color: var(--text-3); white-space: nowrap; }
.cross-tag.on { color: var(--gilt-hi); padding: 2px 7px; border-radius: 6px; background: rgba(var(--gilt-rgb),0.13); }
.layer-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.layer-chip {
  display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px;
  border: 1px solid rgba(var(--gilt-rgb),0.32); background: rgba(var(--gilt-rgb),0.07);
  color: var(--gilt-hi); font-family: var(--serif); font-weight: 600; font-size: 13px;
}
.layer-chip .ic { width: 14px; height: 14px; }
.layer-chip:hover { background: rgba(var(--gilt-rgb),0.16); }
.trip-line {
  display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 12px;
  padding: 11px 14px; border-radius: 14px; text-align: left;
  border: 1px solid var(--line-strong); background: rgba(var(--fg-rgb),0.03);
  color: var(--text-2); font-size: 13px;
}
.trip-line .ic { color: var(--gilt); }
.trip-line:hover { border-color: rgba(var(--gilt-rgb),0.45); color: var(--text); }
.trip-line.on { border-color: rgba(var(--gilt-rgb),0.5); color: var(--gilt-hi); background: rgba(var(--gilt-rgb),0.08); }
.rec-card.is-onsite, .rec-card.is-near { grid-template-columns: 40px minmax(0, 1fr) 18px; align-items: center; }
.rec-seal { display: grid; place-items: center; }
.rec-main { min-width: 0; }
.rec-card.is-related { opacity: 0.92; }
.sec-journey { padding-top: 26px; padding-bottom: 32px; }
.journey-btn {
  display: flex; align-items: center; gap: 14px; width: 100%;
  padding: 14px 16px; border-radius: 18px; text-align: left; color: var(--text);
  border: 1px solid rgba(var(--gilt-rgb),0.42);
  background: linear-gradient(135deg, rgba(var(--gilt-rgb),0.15), rgba(var(--gilt-rgb),0.04));
}
.journey-btn:hover { border-color: var(--gilt); }
.journey-btn b { display: block; font-family: var(--serif); font-size: 15.5px; }
.journey-btn small { display: block; margin-top: 3px; font-size: 12px; color: var(--text-3); }
.journey-ic {
  width: 40px; height: 40px; flex: none; border-radius: 12px; display: grid; place-items: center;
  background: linear-gradient(135deg, var(--gilt-hi), var(--gilt-lo)); color: var(--on-gilt);
}
.dyn-step-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.dyn-step {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px;
  border: 1px solid var(--line-strong); background: transparent; color: var(--text); text-align: left;
}
.dyn-step:hover { border-color: rgba(var(--gilt-rgb),0.5); }
.dyn-step.is-next { justify-content: flex-end; text-align: right; }
.dyn-step span { font-family: var(--serif); font-weight: 700; font-size: 15px; }
.dyn-step small { display: block; font-family: var(--sans); font-weight: 400; font-size: 11px; color: var(--text-3); }
.dyn-step .ic { color: var(--gilt); }
.sec-review .guide-card { margin-top: 4px; }

/* ─── Standalone pages: 广场 (plaza) / public 集章册 (profile) ─── */
.page { min-height: 100vh; min-height: 100dvh; }
.page-inner {
  max-width: 880px; margin: 0 auto;
  padding: calc(18px + env(safe-area-inset-top)) var(--pad) calc(72px + env(safe-area-inset-bottom));
}
.page-top {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding-bottom: 16px; border-bottom: 1px solid var(--line);
}
.page-brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
.page-brand .brand-seal { width: 28px; height: 28px; font-size: 16px; border-radius: 6px; }
.page-brand .brand-name { font-size: 15.5px; }
.page-top-links { display: flex; gap: 8px; flex: none; }
.page-top-links .btn { height: 32px; padding: 0 12px; font-size: 12.5px; }
.page-head { position: relative; padding: 46px 0 8px; }
.page-head .hero-title { font-size: 46px; }
.page-head .hero-lede { max-width: 560px; }
.page-head .hero-stats { max-width: 560px; margin-top: 24px; }
.page-sec { margin-top: 48px; }
.page-sec-head {
  display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px;
  padding-bottom: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--line);
}
.page-sec-head .no { font-family: var(--mono); font-size: 11px; color: var(--gilt); letter-spacing: 0.06em; }
.page-sec-head h2 { margin: 0; font-family: var(--serif); font-weight: 700; font-size: 19px; letter-spacing: 0.06em; }
.page-sec-head .en { font-family: var(--mono); font-size: 10px; letter-spacing: 0.3em; color: var(--text-4); }
.page-sec-head .meta { margin-left: auto; font-family: var(--mono); font-size: 11px; color: var(--text-3); }
.page-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 52px; padding-top: 26px; border-top: 1px solid var(--line); }
.page-foot { margin-top: 44px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.3em; color: var(--text-4); text-align: center; }
.page-empty {
  display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center;
  padding: 56px 20px; border: 1px dashed var(--line-strong); border-radius: 22px;
  color: var(--text-2); font-family: var(--serif); font-size: 15px; line-height: 1.85;
}
.page-empty .seal { font-size: 22px; }

/* 广场 */
.plaza-seg { margin-top: 30px; display: inline-flex; }
.plaza-seg .seg-btn { text-decoration: none; }
.plaza-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 18px; }
.plaza-card {
  position: relative; display: flex; flex-direction: column; gap: 14px; min-width: 0;
  padding: 18px 18px 16px; border-radius: 20px;
  background: linear-gradient(180deg, rgba(var(--fg-rgb),0.035), rgba(var(--fg-rgb),0.01)), var(--bg-2);
  border: 1px solid var(--line);
  transition: border-color 0.2s, transform 0.2s var(--ease), box-shadow 0.2s;
}
.plaza-card:hover { border-color: rgba(var(--gilt-rgb),0.45); transform: translateY(-2px); box-shadow: 0 18px 40px -24px var(--sh-90); }
.plaza-card.self { border-color: rgba(var(--seal-rgb),0.55); }
.plaza-who { display: flex; align-items: center; gap: 12px; min-width: 0; }
.plaza-rank { font-family: var(--mono); font-size: 12px; color: var(--text-4); min-width: 22px; }
.plaza-card.top .plaza-rank { color: var(--gilt-hi); }
.who-avatar {
  width: 42px; height: 42px; flex: none; border-radius: 10px;
  display: grid; place-items: center;
  font-family: var(--serif); font-weight: 900; font-size: 20px; color: #FFF2E8;
  background: var(--seal);
  box-shadow: inset 0 0 0 2px rgba(255,242,232,0.5), inset 0 0 0 4px var(--seal);
}
.plaza-info { min-width: 0; flex: 1; }
.plaza-name { font-family: var(--serif); font-weight: 700; font-size: 16px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plaza-name .you { margin-left: 6px; font-family: var(--sans); font-weight: 500; font-size: 11px; color: var(--seal-ink); }
.plaza-handle { font-family: var(--mono); font-size: 11px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.plaza-title { flex: none; padding: 3px 9px; font-size: 11.5px; }
.plaza-seals { display: flex; align-items: center; gap: 4px; min-height: 40px; overflow: hidden; }
.plaza-seals .seal { font-size: 11.5px; }
.plaza-seals .more { margin-left: 6px; font-family: var(--mono); font-size: 11px; color: var(--text-3); white-space: nowrap; }
.plaza-stats { display: flex; gap: 14px; font-size: 12px; color: var(--text-3); }
.plaza-stats b { font-family: var(--mono); font-weight: 500; color: var(--text); margin-right: 3px; }
.plaza-pager { display: flex; gap: 12px; justify-content: center; align-items: center; margin-top: 30px; font-family: var(--mono); font-size: 12px; color: var(--text-3); }

/* 公开集章册 */
.profile-id { display: flex; align-items: center; gap: 18px; margin-top: 18px; }
.profile-id .who-avatar { width: 64px; height: 64px; font-size: 30px; border-radius: 14px; }
.profile-id .hero-title { margin: 0; }
.profile-handle { font-family: var(--mono); font-size: 12px; color: var(--text-3); margin-top: 6px; }
.profile-wall { margin-top: 0; }
.profile-review.guide-card { margin-top: 0; }
.profile-review > p:first-child::first-letter {
  float: left; font-family: var(--serif); font-weight: 900; font-size: 44px; line-height: 1;
  padding: 4px 10px 0 0; color: var(--gilt-hi);
}
.dyn-notes { display: grid; gap: 14px; }
.dyn-note { padding: 18px 20px; border-radius: 18px; border: 1px solid var(--line); background: var(--bg-2); }
.dyn-note-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 12px; margin-bottom: 10px; }
.dyn-note-name { font-family: var(--serif); font-weight: 900; font-size: 21px; letter-spacing: 0.04em; }
.dyn-note-period { font-family: var(--mono); font-size: 11px; color: var(--gilt); }
.dyn-note-count { margin-left: auto; font-size: 12px; color: var(--text-3); }
.dyn-note-count b { font-family: var(--mono); font-weight: 500; color: var(--seal-ink); }
.dyn-note details > summary { list-style: none; cursor: pointer; display: block; }
.dyn-note details > summary::-webkit-details-marker { display: none; }
.dyn-note .clip { max-height: 13em; overflow: hidden; position: relative; }
.dyn-note .clip::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4em; pointer-events: none;
  background: linear-gradient(180deg, rgba(var(--bg2-rgb),0), var(--bg-2) 85%);
}
.dyn-note details[open] .clip { max-height: none; overflow: visible; }
.dyn-note details[open] .clip::after { display: none; }
.dyn-note .toggle { display: inline-flex; margin-top: 8px; font-size: 12px; color: var(--gilt); }
.dyn-note details[open] .toggle .more-text, .dyn-note details:not([open]) .toggle .less-text { display: none; }
.dyn-note-go { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 12.5px; color: var(--gilt); }
.dyn-note-go:hover { color: var(--gilt-hi); }
.note-list { list-style: none; margin: 0; padding: 0; }
.note-item { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); align-items: start; }
.note-item:last-child { border-bottom: none; }
.note-name { font-family: var(--serif); font-weight: 700; font-size: 15.5px; }
.note-date { font-family: var(--mono); font-size: 10.5px; color: var(--text-4); margin-left: 8px; }
.note-text { margin-top: 6px; font-family: var(--serif); font-size: 14px; line-height: 1.8; color: var(--text-2); overflow-wrap: anywhere; }
@media (max-width: 700px) {
  .plaza-grid { grid-template-columns: 1fr; }
  .page-head { padding-top: 32px; }
  .page-head .hero-title { font-size: 34px; }
  .profile-id .who-avatar { width: 54px; height: 54px; font-size: 25px; }
}

/* ─── Narrow (phones / small tablets) ─── */
@media (max-width: 920px) {
  :root { --pad: 16px; --pad-toc: 18px; --pad-d: 20px; }

  .topbar { padding: 10px 14px 9px; gap: 10px; }
  .brand { gap: 10px; }
  .brand-seal { width: 30px; height: 30px; font-size: 17px; border-radius: 6px; }
  .brand-name { font-size: 17px; letter-spacing: 0.06em; }
  .brand-sub { font-size: 8.5px; letter-spacing: 0.26em; }
  .brand-sub.brand-motto { font-size: 10px; letter-spacing: 0.12em; }
  .topbar-stats { display: none; }
  .topbar-actions { margin-left: auto; gap: 6px; }
  .tb-btn { height: 32px; padding: 0 11px; font-size: 12.5px; }

  .timeline { padding: 0 2px; }
  .timeline-item { padding: 9px 13px 10px; }
  .timeline-item .name { font-size: 14px; }
  .timeline-item .period { font-size: 9.5px; margin-top: 4px; }
  .timeline-item.all .name { font-size: 12px; }

  .stage { grid-template-columns: 1fr; }
  .toc-resize { display: none; }
  .toc-wrap {
    display: block; position: fixed; left: 0; top: 0; bottom: 0;
    width: min(384px, 90vw); z-index: 1700;
    transform: translateX(-104%);
    transition: transform 0.42s var(--ease);
  }
  .toc-wrap.open { transform: translateX(0); }
  .toc-wrap .toc {
    display: block; height: 100%;
    border-right: 1px solid var(--line-strong);
    border-radius: 0 22px 22px 0;
    box-shadow: 30px 0 80px -30px var(--sh-95);
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .toc-overlay {
    display: block; position: fixed; inset: 0; z-index: 1650;
    background: rgba(5,5,4,0.6);
    opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
  }
  .toc-overlay.open { opacity: 1; pointer-events: auto; }
  .toc-hero { padding: 22px var(--pad-toc) 18px; }
  .hero-title { font-size: 32px; }
  .hero-glyph { font-size: 140px; }
  .toc-list { padding-bottom: 40px; }

  .map-legend { top: 58px; bottom: auto; left: 10px; flex-direction: row; flex-wrap: wrap; gap: 10px; padding: 6px 10px; font-size: 11px; max-width: calc(100% - 20px); }
  .canvas.has-drawer { --drawer-w: 0px; }
  .view-switch { top: 10px; }
  .view-switch button { height: 30px; padding: 0 11px; gap: 5px; font-size: 12.5px; }
  .strata-back { top: 10px; left: 10px; height: 36px; padding: 0 12px 0 10px; font-size: 12.5px; }
  .strata-credit { left: 12px; bottom: calc(84px + env(safe-area-inset-bottom)); }
  .strata-credit .sc-name { font-size: 21px; }
  .locate-btn { top: 10px; right: 10px; height: 36px; padding: 0 12px; }
  .map-caption { left: 20px; bottom: calc(96px + env(safe-area-inset-bottom)); max-width: calc(100% - 40px); }
  .cap-name { font-size: 42px; }

  .drawer {
    position: fixed; top: auto; left: 0; right: 0; bottom: 0;
    /* Tops out right under the dynasty timeline (--sheet-top is measured in app.ts) so
       the timeline stays whole and tappable above an expanded sheet. */
    width: 100vw; height: calc(100dvh - var(--sheet-top, 10dvh));
    border-left: none; border-top: 1px solid var(--line-strong);
    border-radius: 22px 22px 0 0;
    transform: translateY(104%);
    box-shadow: 0 -40px 100px -30px var(--sh-95);
    padding-bottom: env(safe-area-inset-bottom);
    /* No rubber-band at the top: iOS would drag the whole sheet body (handle included) down
       and open a blank gap. Past the top, the stroke moves the sheet instead (drawerTouch*). */
    overscroll-behavior-y: none;
  }
  .drawer.open { transform: translateY(0); }
  /* Opens half-height so the 3D layer / map stays in view above it; reading on expands it. */
  .drawer.open.peek { transform: translateY(34dvh); }
  /* An era's sheet peeks lower: its map is what the reader came for. */
  .drawer.open.peek.is-dynasty { transform: translateY(42dvh); }
  /* Tucked away: only a title bar stays, the map / layers get the screen back. */
  .drawer.open.mini, .drawer.open.mini.peek { transform: translateY(calc(100% - 60px - env(safe-area-inset-bottom))); overflow: hidden; }
  .drawer.mini .sheet-mini {
    display: flex; align-items: center; gap: 8px; position: absolute; z-index: 1; left: 0; right: 0; top: 0; height: 60px;
    padding: 10px 104px 0 22px; box-sizing: border-box; border: 0; border-radius: 22px 22px 0 0;
    background: var(--surface); color: var(--text); text-align: left; cursor: pointer;
  }
  .drawer.mini .drawer-bar-inner { z-index: 2; padding-top: 12px; }
  .drawer.mini .drawer-grabber { display: none; }
  .drawer.mini .drawer-bar-inner .round-btn.gilt, .drawer.mini .drawer-bar-inner [title='静音'], .drawer.mini .drawer-bar-inner [title='开启音效'] { display: none; }
  .drawer-grabber {
    display: block; position: absolute; left: 50%; top: 0; transform: translateX(-50%);
    width: 88px; height: 22px; padding: 0; border: none; background: transparent;
    pointer-events: auto; cursor: pointer;
  }
  .drawer-grabber::before {
    content: ''; position: absolute; left: 50%; top: 8px; transform: translateX(-50%);
    width: 38px; height: 4px; border-radius: 2px; background: rgba(var(--fg-rgb),0.42);
  }
  .drawer-bar-inner { padding: 16px 12px 0; }
  .drawer-hero { padding: 72px var(--pad-d) 20px; min-height: 210px; }
  .drawer-hero.has-image { min-height: min(46vh, 400px); }
  /* Without a picture the hero is just the title — don't spend the peek on blank paper. */
  .drawer-hero:not(.has-image) { min-height: 0; padding-top: 58px; }
  .drawer-hero .hero-title { font-size: 30px; }
  .drawer-hero .hero-glyph { font-size: 180px; }
  .drawer-section { padding: 20px var(--pad-d); }
  .vitrine-stage img { max-height: 340px; }
  .chronicle::before { left: 73px; }
  .chronicle li { grid-template-columns: 62px minmax(0, 1fr); gap: 22px; }
  .chronicle li::before { left: 70px; }

  .chat-panel { --panel-h: min(86dvh, 740px); border-radius: 22px 22px 0 0; padding-bottom: env(safe-area-inset-bottom); }
  .chat-panel.fullscreen { --panel-h: 100dvh; padding-bottom: 0; border-radius: 0; }
  .chat-body { padding: 16px 16px 8px; }

  .dock { left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); }
  .dock-index { display: inline-flex; }
  .dock-btn { height: 44px; padding: 0 14px; font-size: 13px; }
  .dock-ai { padding: 0 16px; }

  .toc-search input, .search input { font-size: 16px; }
}
@media (max-width: 480px) {
  .culture-grid { grid-template-columns: 1fr; }
}
/* Phones (all current iPhones are 375–440 wide): brand + three labelled buttons don't fit. */
@media (max-width: 480px) {
  .brand-sub { display: none; }
  .tb-btn:not(.tb-stamp) .tb-label { display: none; }
  .tb-btn:not(.tb-stamp) { padding: 0; width: 32px; justify-content: center; }
  .brand-text { overflow: hidden; }
}
@media (max-width: 400px) {
  .strata-back .sb-more { display: none; }
  .tb-btn .tb-label { display: none; }
  .tb-btn.tb-stamp { padding: 0 9px; }
  .dock-btn { padding: 0 12px; gap: 6px; }
  .dock-ai { padding: 0 14px; }
}
@media (max-width: 360px) {
  .brand-name { font-size: 15.5px; }
  .hero-title { font-size: 28px; }
  .drawer-hero .hero-title { font-size: 26px; }
}

/* Touch — no hover-only effects, no zoom buttons (pinch instead) */
@media (hover: none) {
  .toc-item:not(.selected):hover { background: transparent; }
  .rec-card.dynasty-rec:hover { border-color: var(--line); background: rgba(var(--fg-rgb),0.03); }
  .chip:hover { border-color: var(--line-strong); color: var(--text-2); }
  .dock-btn:not(.dock-ai):hover { background: transparent; color: var(--text-2); }
}
@media (hover: none) and (pointer: coarse) {
  .leaflet-control-zoom { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* 打卡成就 */
.ach-wrap { margin-top: 22px; min-width: 0; }
.ach-head { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--serif); font-weight: 600; font-size: 17px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
.ach-head small, .ach-group-title small { font-family: var(--mono); font-weight: 400; font-size: 11.5px; color: var(--text-3); }
.ach-group { margin-top: 14px; }
.ach-group-title { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2); margin-bottom: 8px; }
.ach-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ach-card { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-rows: auto auto auto; gap: 3px 9px; align-items: center; text-align: left; padding: 9px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--text); cursor: pointer; min-width: 0; }
.ach-card .ach-seal { grid-row: 1 / 4; }
.ach-card .ach-name { font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
.ach-card .ach-status { font-size: 11px; color: var(--text-3); overflow-wrap: anywhere; }
.ach-card.lv0 { opacity: 0.82; }
.ach-seal { flex: none; width: 38px; height: 38px; display: grid; place-items: center; font-family: var(--serif); font-weight: 700; font-size: 12px; line-height: 1.05; letter-spacing: 0.02em; color: var(--text-4); border: 1.5px dashed var(--line-strong); border-radius: 6px; writing-mode: vertical-rl; }
.ach-seal.line-region { border-radius: 50%; }
.ach-seal.line-era { width: 30px; height: 46px; border-radius: 5px; }
.ach-seal.lv1, .ach-seal.lv2 { color: #FFF2E8; background: var(--seal); border: 1.5px solid var(--seal); }
.ach-seal.lv2 { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--gilt); }
.ach-seal.big { width: 58px; height: 58px; font-size: 16px; }
.ach-seal.big.line-era { width: 44px; height: 68px; }
.ach-bar { position: relative; display: block; height: 4px; border-radius: 4px; background: var(--line); overflow: visible; }
.ach-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; background: var(--seal); }
.ach-bar b { position: absolute; top: -3px; width: 1.5px; height: 10px; background: var(--text-3); }
.ach-bar.big { height: 6px; margin: 14px 0 6px; }
.ach-overlay { position: fixed; inset: 0; z-index: 2100; background: rgba(0,0,0,0.28); }
.ach-sheet { position: fixed; z-index: 2110; left: 50%; bottom: 0; transform: translateX(-50%); width: min(560px, 100vw); max-height: 86dvh; overflow-y: auto; box-sizing: border-box; padding: 18px 22px calc(22px + env(safe-area-inset-bottom)); background: var(--bg); color: var(--text); border-radius: 22px 22px 0 0; border: 1px solid var(--line-strong); box-shadow: 0 -24px 60px -30px var(--sh-95); overflow-wrap: anywhere; }
.ach-sheet-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; }
.ach-sheet h2 { margin: 2px 0; font-family: var(--serif); font-size: 22px; }
.ach-sheet h3 { margin: 18px 0 6px; font-size: 13px; color: var(--text-2); font-weight: 600; }
.ach-sheet .ach-status { font-size: 12px; color: var(--text-3); }
.ach-kicker { font-family: var(--mono); font-size: 11px; color: var(--text-3); letter-spacing: 0.08em; }
.ach-hook { margin: 12px 0 0; font-family: var(--serif); font-size: 16px; }
.ach-count { font-family: var(--mono); font-size: 11.5px; color: var(--text-3); }
.ach-list { list-style: none; margin: 0; padding: 0; }
.ach-list li button { display: flex; width: 100%; gap: 8px; align-items: center; justify-content: space-between; padding: 8px 0; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--text); text-align: left; cursor: pointer; font-size: 14px; overflow-wrap: anywhere; }
.ach-list li.done button { justify-content: flex-start; color: var(--text-2); }
.ach-list small { color: var(--text-3); font-size: 11.5px; text-align: right; flex: none; max-width: 45%; }
.ach-label { font-family: var(--serif); line-height: 1.85; }
.ach-label.locked { color: var(--text-3); }
.ach-locked-note { font-size: 11.5px; color: var(--text-4); margin-top: -4px; }
.ach-ceremony { position: fixed; inset: 0; z-index: 2200; display: grid; place-items: center; background: rgba(0,0,0,0.42); padding: 24px; box-sizing: border-box; }
.ach-ceremony-card { box-sizing: border-box; width: min(360px, 100%); max-height: 100%; overflow-y: auto; text-align: center; padding: 28px 24px 22px; background: var(--bg); color: var(--text); border-radius: 22px; border: 1px solid var(--line-strong); overflow-wrap: anywhere; }
.ach-ceremony-kicker { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.18em; color: var(--seal-ink-strong); }
.ach-ceremony-card h2 { font-family: var(--serif); margin: 14px 0 6px; }
.ach-ceremony-card p { color: var(--text-2); margin: 0 0 18px; }
.ach-ceremony-card .ach-seal { margin: 18px auto 0; width: 84px; height: 84px; font-size: 22px; }
.ach-ceremony-card .ach-seal.line-era { width: 62px; height: 96px; }
.ach-seal.stamp { animation: ach-stamp 0.7s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes ach-stamp { 0% { transform: scale(2.4) rotate(-14deg); opacity: 0; } 55% { transform: scale(0.92) rotate(3deg); opacity: 1; } 100% { transform: scale(1) rotate(-4deg); } }
.ach-ceremony-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.ji-sheet { position: fixed; inset: 0; z-index: 2300; display: grid; place-items: center; background: rgba(0,0,0,0.42); padding: 24px; box-sizing: border-box; }
.ji-card { box-sizing: border-box; width: min(420px, 100%); max-height: 100%; overflow-y: auto; padding: 28px; background: var(--bg); color: var(--text); border-radius: 22px; border: 1px solid var(--line-strong); overflow-wrap: anywhere; }
.ji-kicker { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.18em; color: var(--seal-ink-strong); }
.ji-card h3 { font-family: var(--serif); font-size: 24px; margin: 10px 0 18px; font-weight: 600; }
.ji-card label { display: block; font-size: 12px; color: var(--text-3); margin-bottom: 14px; letter-spacing: 0.04em; }
.ji-card input { display: block; box-sizing: border-box; width: 100%; margin-top: 4px; padding: 8px 0; font-size: 16px; font-family: var(--serif); color: var(--text); background: transparent; border: 0; border-bottom: 1px solid var(--line-strong); border-radius: 0; outline: none; }
.ji-card input:focus { border-bottom-color: var(--seal-ink-strong); }
.ji-note { font-size: 12px; color: var(--text-3); margin: 4px 0 18px; line-height: 1.7; }
.ji-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.gate-card h3 { text-wrap: balance; }
.gate-card h3 .gate-name { color: var(--seal-ink-strong); }
.gate-error { margin: -4px 0 14px; }
.gate-foot { margin: 16px 0 0; }
@media (max-width: 640px) {
  .ji-sheet { place-items: end center; padding: 0; }
  .ji-card { width: 100%; border-radius: 22px 22px 0 0; padding: 24px 22px calc(24px + env(safe-area-inset-bottom)); max-height: 92dvh; }
}
@media (max-width: 640px) {
  .ach-sheet { padding: 16px 16px calc(20px + env(safe-area-inset-bottom)); max-height: 88dvh; }
  .ach-ceremony { padding: 16px; }
  .ach-ceremony-card { padding: 24px 18px 18px; }
}
@media (prefers-reduced-motion: reduce) { .ach-seal.stamp { animation: none; } }

.lg-rec-why { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.lg-rec-why .why { font-size: 11px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--text-2); overflow-wrap: anywhere; }
.trip-why .why-ach-last, .why.why-ach-last { color: #FFF2E8; background: var(--seal); border-color: var(--seal); }
.trip-why .why-ach, .why.why-ach { color: var(--seal-ink-strong); border-color: rgba(var(--seal-rgb), 0.45); border-style: dashed; }

.ach-refs { display: flex; flex-direction: column; gap: 8px; }
.ach-ref { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; width: 100%; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); background: rgba(var(--fg-rgb),0.03); color: var(--text); text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.ach-ref:hover { border-color: rgba(var(--gilt-rgb),0.5); }
.ach-ref-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ach-ref-text b { font-family: var(--serif); font-size: 14px; }
.ach-ref-text small { font-size: 11.5px; color: var(--text-3); }
.here-panel { position: fixed; z-index: 2001; right: 16px; top: 76px; bottom: 16px; width: min(380px, calc(100vw - 32px)); display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.45); overflow: hidden; }
.here-grabber { display: none; }
.here-head { display: flex; gap: 10px; align-items: flex-start; padding: 14px 14px 10px 18px; border-bottom: 1px solid rgba(var(--fg-rgb), .08); }
.here-id { flex: 1; min-width: 0; }
.here-kick { font-family: var(--mono); font-size: 10px; letter-spacing: .16em; color: var(--gilt); }
.here-title { font-size: 20px; margin-top: 4px; overflow-wrap: anywhere; }
.here-title .gilt { color: var(--gilt); }
.here-title small { font-size: 12px; color: var(--text-3); }
.here-sub { font-size: 12px; color: var(--text-3); margin-top: 2px; }
.here-tools { display: flex; gap: 4px; }
.here-body { flex: 1; overflow-y: auto; padding: 6px 16px 18px; overscroll-behavior: contain; }
.here-empty { color: var(--text-3); font-size: 13px; padding: 18px 2px; }
.here-layers { list-style: none; margin: 0; padding: 0; }
.here-layer { position: relative; border-top: 1px solid rgba(var(--fg-rgb), .1); padding: 10px 0 10px 12px; min-width: 0; overflow-wrap: anywhere; }
.here-layer::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 2px; background: var(--c); }
.here-layer.dim { opacity: .55; }
.hl-head { all: unset; cursor: pointer; display: flex; align-items: baseline; gap: 8px; width: 100%; }
.hl-era { font-size: 14px; }
.hl-name { color: var(--gilt); font-size: 14px; }
.hl-years { margin-left: auto; font-family: var(--mono); font-size: 10px; color: var(--text-3); }
.hl-note, .hl-peek { font-size: 12px; color: var(--text-2); margin: 4px 0 0; line-height: 1.5; }
.hl-events { list-style: none; margin: 6px 0 0; padding: 0; }
.hl-events button { all: unset; cursor: pointer; display: flex; gap: 8px; font-size: 12.5px; line-height: 1.5; padding: 3px 0; color: var(--text); }
.hl-events button:hover { color: var(--gilt-hi); }
.hl-date { flex: 0 0 auto; font-family: var(--mono); font-size: 10.5px; color: var(--gilt); padding-top: 2px; }
.hl-museums { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
.hl-museums small { color: var(--text-3); font-family: var(--mono); font-size: 10px; }
@media (max-width: 920px) {
  .here-panel { left: 0; right: 0; bottom: 0; top: auto; width: auto; height: min(72dvh, 620px); border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom); transition: transform .3s var(--ease), height .3s var(--ease); }
  .here-panel.mini { height: calc(84px + env(safe-area-inset-bottom)); }
  .here-panel.mini .here-body, .here-panel.mini .here-sub, .here-panel.mini .here-tools > .icon-btn:not(:last-child) { display: none; }
  .here-grabber { display: block; touch-action: none; width: 100%; height: 18px; background: none; border: 0; position: relative; }
  .here-grabber::after { content: ""; position: absolute; left: 50%; top: 7px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: rgba(var(--fg-rgb), .3); }
  .here-head { touch-action: none; padding-top: 2px; }
}
.here-link { all: unset; cursor: pointer; display: inline-block; font-size: 13px; color: var(--gilt); border-bottom: 1px solid rgba(var(--gilt-rgb), .35); padding-bottom: 1px; }
.here-link:hover { color: var(--gilt-hi); }
.here-btn { top: 60px; }
.canvas.has-drawer .here-btn { right: calc(var(--drawer-w) + 14px); }
.here-btn:hover { color: var(--gilt-hi); border-color: rgba(var(--gilt-rgb), .45); }
@media (max-width: 920px) { .here-btn { top: 54px; right: 10px; } }

/* ─── 循迹 (threads on the map) ─── */
.canvas.is-xunji .strata-wrap { visibility: hidden; pointer-events: none; }
.xunji-panel { position: fixed; z-index: 1100; right: 16px; top: 76px; bottom: 16px; width: min(380px, calc(100vw - 32px)); display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,.45); overflow: hidden; }
.xj-pick, .xj-tour { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.xj-tour { position: relative; }
/* Off-screen copies of every stop + the end card, measured to fix the phone sheet's height */
.xj-measure { position: absolute; left: 0; right: 0; top: 0; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
.xj-board { all: unset; cursor: pointer; display: inline-block; margin-top: 10px; font-size: 12.5px; color: var(--gilt); border-bottom: 1px solid rgba(var(--gilt-rgb), .4); }
.xj-board:hover { color: var(--gilt-hi); }
/* 停站表 — the route as a train timetable: tap 上车, then 下车 */
.xj-timetable { margin: 4px 0 12px; }
.xj-tt-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; color: var(--text-3); margin-bottom: 6px; }
.xj-tt-head span:first-child { font-family: var(--mono); letter-spacing: .16em; color: var(--gilt); }
.xj-tt { list-style: none; margin: 0; padding: 0; position: relative; }
.xj-tt li { position: relative; }
.xj-tt li::before { content: ""; position: absolute; left: 6px; top: 0; bottom: 0; width: 2px; background: rgba(var(--fg-rgb), .14); }
.xj-tt li:first-child::before { top: 50%; } .xj-tt li:last-child::before { bottom: 50%; }
.xj-tt li.on::before { background: var(--gilt); }
.xj-tt li.on.end:first-child::before, .xj-tt li.on:not(.on ~ li)::before { top: 50%; }
.xj-tt button { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: grid; grid-template-columns: 14px 1fr auto 52px 40px; align-items: center; gap: 8px; padding: 7px 0; font-size: 13.5px; }
.tt-dot { width: 10px; height: 10px; border-radius: 50%; margin-left: 2px; background: var(--surface); border: 2px solid rgba(var(--fg-rgb), .3); position: relative; z-index: 1; }
.xj-tt li.on .tt-dot { border-color: var(--gilt); }
.xj-tt li.end .tt-dot { background: var(--gilt); border-color: var(--gilt); box-shadow: 0 0 0 4px rgba(var(--gilt-rgb), .2); }
.tt-name { overflow-wrap: anywhere; }
.xj-tt li:not(.on) .tt-name { color: var(--text-3); }
.tt-tag { font-size: 10.5px; padding: 1px 6px; border-radius: 4px; color: var(--seal-ink-hi); background: rgba(var(--seal-rgb), .18); }
.tt-tag:empty { display: none; }
.tt-when { font-family: var(--mono); font-size: 10.5px; color: var(--text-3); text-align: right; }
.tt-mus { font-family: var(--mono); font-size: 10.5px; color: var(--gilt); text-align: right; }
.xj-cta small { display: block; margin-top: 3px; font-size: 11px; opacity: .8; }
.xj-cta[disabled] { opacity: .55; cursor: default; }
.xj-cta-note { font-size: 11.5px; color: var(--text-3); margin: -4px 0 10px; text-align: center; }
.xj-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.xunji-grabber { display: none; }
.xj-head { position: relative; padding: 14px 16px 10px; border-bottom: 1px solid rgba(var(--fg-rgb), .08); }
.xj-kick { font-family: var(--mono); font-size: 10px; letter-spacing: .16em; color: var(--gilt); }
.xj-title { font-size: 19px; margin-top: 4px; overflow-wrap: anywhere; padding-right: 96px; }
.xunji-panel.has-thread .xj-tour .xj-title { padding-right: 150px; }   /* up to four header buttons */
.xj-tools { position: absolute; top: 10px; right: 10px; display: flex; gap: 2px; }
.xj-empty { padding: 16px; color: var(--text-3); font-size: 13px; }
.xj-group { padding: 6px 12px 10px; }
.xj-group h3 { font-size: 12px; letter-spacing: .12em; color: var(--text-3); margin: 8px 4px; font-weight: 400; }
.xj-card { all: unset; cursor: pointer; display: grid; gap: 4px; width: calc(100% - 26px); padding: 12px; margin: 0 0 8px; border-radius: 12px; border: 1px solid rgba(var(--gilt-rgb), .22); background: rgba(var(--bg-rgb), .4); }
.xj-card:hover { border-color: var(--gilt); }
.xj-card-title { font-size: 15px; color: var(--gilt); }
.xj-card-meta { font-family: var(--mono); font-size: 10.5px; color: var(--text-3); }
.xj-card-intro { font-size: 12.5px; line-height: 1.55; color: var(--text-2); overflow-wrap: anywhere; }
.xj-stop, .xj-end { padding: 12px 16px 18px; overflow-wrap: anywhere; }
.xj-when { font-family: var(--mono); font-size: 11px; color: var(--text-3); }
.xj-stop-title { font-size: 18px; margin-top: 4px; }
.xj-line { margin: 10px 0 0; padding-left: 10px; border-left: 2px solid rgba(var(--gilt-rgb), .5); color: var(--gilt); font-size: 15px; line-height: 1.6; }
.xj-story { font-size: 13.5px; line-height: 1.7; color: var(--text-2); margin: 10px 0 0; }
.xj-nav { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.xj-count { margin-left: auto; margin-right: auto; font-family: var(--mono); font-size: 11px; color: var(--text-3); }
.xj-prog { display: flex; gap: 3px; margin-top: 12px; }
.xj-prog i { flex: 1; height: 3px; border-radius: 2px; background: rgba(var(--fg-rgb), .15); }
.xj-prog i.on { background: var(--gilt); }
.xj-intro { font-size: 14px; line-height: 1.7; color: var(--text-2); margin: 0 0 10px; }
.xj-poem { white-space: pre-wrap; font: inherit; font-size: 14px; line-height: 1.8; color: var(--gilt); margin: 0 0 14px; }
.xj-cta { all: unset; cursor: pointer; display: block; text-align: center; padding: 10px 14px; margin-bottom: 10px; border-radius: 999px; color: var(--seal-ink-hi); border: 1px solid rgba(var(--seal-rgb), .55); background: rgba(var(--seal-rgb), .12); }
@media (max-width: 920px) {
  .xunji-panel { left: 0; right: 0; bottom: 0; top: auto; width: auto; height: min(62dvh, 560px); border-radius: 18px 18px 0 0; padding-bottom: env(safe-area-inset-bottom); transition: transform .3s var(--ease), height .3s var(--ease); }
  .xunji-panel.has-thread { height: auto; max-height: min(62dvh, 560px); }
  .xunji-panel.mini { height: calc(84px + env(safe-area-inset-bottom)); overflow: hidden; }
  .xunji-grabber { display: block; touch-action: none; width: 100%; height: 18px; flex: none; background: none; border: 0; position: relative; }
  .xunji-grabber::after { content: ""; position: absolute; left: 50%; top: 7px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: rgba(var(--fg-rgb), .3); }
  .xj-head { touch-action: none; padding-top: 2px; }
}
/* 循迹 杂志 — the reader (cover, 导语, acts) and the shelf of covers */
.xj-read { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; }
.xj-strip, .xj-readhead { display: none; }
.xj-rtools { z-index: 4; top: 12px; right: 12px; padding: 2px; border-radius: 999px; background: rgba(var(--bg-rgb), .62); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.xunji-panel.is-reading { left: 16px; right: auto; width: min(560px, 45vw); }
.xj-mag { position: relative; flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; background: var(--surface); --era: var(--gilt); }
.mag-cover { position: relative; min-height: 72dvh; display: flex; align-items: flex-end; background: #000; overflow: hidden; }
.mag-cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.25) 55%, transparent 75%); }
.mag-cover-text, .mag-credit { z-index: 1; }
.mag-credit a { color: inherit; text-decoration: none; }
.mag-fig figcaption a { color: inherit; text-decoration: none; }
.mag-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .78; }
.mag-cover-text { position: relative; padding: 0 22px 46px; }
.mag-kick { font-family: var(--mono); font-size: 10px; letter-spacing: .3em; color: var(--era); }
.mag-title { font-family: var(--serif); font-size: clamp(56px, 16vw, 88px); line-height: 1; margin: 10px 0 8px; letter-spacing: .04em; font-weight: 500; color: #fff; }
.mag-deck { font-size: 15px; line-height: 1.75; color: rgba(255,255,255,.9); margin: 0; max-width: 30em; }
.mag-credit { position: absolute; left: 22px; right: 22px; bottom: 12px; font-family: var(--mono); font-size: 9.5px; color: rgba(255,255,255,.55); overflow-wrap: anywhere; }
.mag-opening { padding: 28px 22px 8px; font-size: 16px; line-height: 2; color: var(--text); background: var(--surface); margin: 0; overflow-wrap: anywhere; }
.mag-opening::first-letter { float: left; font-size: 52px; line-height: 1; margin: 6px 8px 0 0; color: var(--era); font-family: var(--serif); }
.mag-act { padding: 34px 22px 10px; background: var(--surface); overflow-wrap: anywhere; }
.mag-act-head { display: flex; align-items: center; gap: 12px; }
.mag-num { font-family: var(--mono); font-size: 40px; line-height: 1; color: var(--era); }
.mag-seal { font-size: 12px; padding: 3px 6px; border: 1.5px solid var(--seal); color: var(--seal-ink-strong); border-radius: 3px; letter-spacing: .1em; }
.mag-act-title { font-family: var(--serif); font-size: 24px; margin: 10px 0 2px; font-weight: 500; }
.mag-act-span { font-family: var(--mono); font-size: 10.5px; color: var(--text-3); letter-spacing: .12em; }
.mag-p { font-size: 15px; line-height: 2; color: var(--text-2); margin: 14px 0 0; }
.mag-quote { margin: 22px 0 6px; padding: 14px 0; border-top: 1px solid var(--era); border-bottom: 1px solid var(--era); text-align: center; }
@supports (color: color-mix(in srgb, red, blue)) { .mag-quote { border-color: color-mix(in srgb, var(--era) 55%, transparent); } }
.mag-quote span { display: block; font-family: var(--serif); font-size: 21px; line-height: 1.6; color: var(--gilt-hi); letter-spacing: .06em; }
.mag-quote cite { display: block; margin-top: 6px; font-style: normal; font-size: 11px; color: var(--text-3); }
.mag-fig { margin: 22px -22px 0; background: rgba(var(--fg-rgb), .04); }
.mag-fig img { display: block; width: auto; max-width: 100%; height: auto; max-height: min(72dvh, 640px); margin: 0 auto; }
.mag-fig figcaption { padding: 6px 22px 0; font-family: var(--mono); font-size: 9.5px; color: var(--text-3); line-height: 1.5; }
.mag-end { padding: 30px 22px calc(30px + env(safe-area-inset-bottom)); background: var(--surface); }
.mag-end .xj-end { padding: 0; }
/* 循迹 翻页的「刊」 — the pager and its pages */
.xj-pages { position: relative; flex: 1; min-height: 0; --era: var(--gilt); }
.xj-pager { position: absolute; inset: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; overscroll-behavior: contain; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.xj-pager::-webkit-scrollbar { display: none; }
.xj-page { position: relative; flex: 0 0 100%; width: 100%; height: 100%; box-sizing: border-box; scroll-snap-align: start; scroll-snap-stop: always; overflow-x: hidden; overflow-y: auto; overscroll-behavior-y: contain; background: var(--surface); overflow-wrap: anywhere; }
.xj-page.pg-map { background: transparent; overflow: hidden; }
.pgi { box-sizing: border-box; min-height: 100%; padding: 58px 24px calc(46px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; }
.xj-folio { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; display: flex; justify-content: space-between; padding: 0 22px calc(14px + env(safe-area-inset-bottom)); font-family: var(--mono); font-size: 10px; letter-spacing: .14em; color: var(--text-3); pointer-events: none; text-shadow: 0 0 6px var(--surface); }
.xj-pages.pk-image .xj-folio, .xj-pages.pk-cover .xj-folio { color: rgba(255,255,255,.6); text-shadow: none; }
.xj-more { position: absolute; left: 0; right: 0; bottom: calc(26px + env(safe-area-inset-bottom)); height: 54px; z-index: 2; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; pointer-events: none; font-family: var(--mono); font-size: 13px; color: var(--era); background: linear-gradient(to top, var(--surface) 20%, transparent); }
.xj-pages.pk-map .xj-more, .xj-pages.pk-image .xj-more { display: none; }
.xj-edge { position: absolute; z-index: 2; top: 56px; bottom: 120px; width: 40px; padding: 0; border: 0; background: none; display: none; -webkit-tap-highlight-color: transparent; }
.xj-edge.l { left: 0; cursor: pointer; }
.xj-edge.r { right: 0; cursor: pointer; }
@media (min-width: 921px) and (hover: hover) { .xj-edge { display: block; } .xj-pages.no-edge .xj-edge { pointer-events: none; } }
/* cover */
.xj-page.pg-cover { background: #000; }
.pgi-cover { position: relative; padding: 0; justify-content: flex-end; color: #fff; overflow: hidden; }
.pgi-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .82; }
.pgi-cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.86), rgba(0,0,0,.25) 55%, transparent 78%); }
.pg-cover-text { position: relative; z-index: 1; padding: 0 24px 56px; }
.pg-hint { margin-top: 18px; font-family: var(--mono); font-size: 10px; letter-spacing: .3em; color: var(--era); }
.pgi-cover .mag-credit { z-index: 1; left: 24px; right: 24px; bottom: calc(12px + env(safe-area-inset-bottom)); }
/* 目录 */
.pg-lede { font-size: 14px; line-height: 1.9; color: var(--text-2); margin: 12px 0 18px; }
.pg-toc { list-style: none; margin: 0; padding: 0; border-top: 1px solid rgba(var(--fg-rgb), .12); }
.pg-toc li { border-bottom: 1px solid rgba(var(--fg-rgb), .12); }
.pg-toc button { all: unset; cursor: pointer; box-sizing: border-box; width: 100%; display: flex; align-items: baseline; gap: 14px; padding: 11px 2px; }
.pg-toc button:hover .tc-t { color: var(--era); }
.pg-toc button:focus-visible { outline: 2px solid var(--era); outline-offset: 2px; }
.tc-num { flex: none; width: 1.4em; font-family: var(--serif); font-size: 22px; font-weight: 300; color: var(--era); text-align: center; }
.tc-body { display: grid; gap: 2px; min-width: 0; }
.tc-t { font-family: var(--serif); font-size: 16px; color: var(--text); }
.tc-m { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; color: var(--text-3); }
/* opener */
.pgi-opener { justify-content: center; gap: 4px; }
.op-num { font-family: var(--serif); font-size: 110px; line-height: 1; font-weight: 300; color: var(--era); }
.op-seal { margin: 10px 0 14px; }
.op-seal span { display: inline-block; font-size: 12px; padding: 3px 7px; border: 1.5px solid var(--seal); color: var(--seal-ink-strong); border-radius: 3px; letter-spacing: .12em; }
.op-title { font-family: var(--serif); font-size: 32px; font-weight: 500; margin: 0; letter-spacing: .04em; }
.op-span { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; color: var(--text-3); margin-top: 4px; }
.op-line { font-size: 15px; line-height: 1.9; color: var(--text-2); margin: 18px 0 0; max-width: 24em; }
/* text */
.pgi-text { display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; column-gap: 14px; }
.pgi-text.has-note { grid-template-columns: minmax(0, 1fr) 82px; }
.tx-main p { font-size: 15px; line-height: 2; color: var(--text-2); margin: 0 0 14px; }
.tx-main p.drop::first-letter { float: left; font-family: var(--serif); font-size: 54px; line-height: 1; margin: 6px 8px 0 0; color: var(--era); }
.tx-note { align-self: start; margin-top: 6px; padding-left: 10px; border-left: 1.5px solid var(--era); display: grid; gap: 4px; font-size: 11.5px; line-height: 1.7; color: var(--text-3); }
.tx-note b { font-weight: 500; color: var(--gilt-hi); font-size: 12px; }
@media (max-width: 480px) {
  .pgi-text.has-note { grid-template-columns: minmax(0, 1fr); }
  .tx-note { margin-top: 4px; padding: 8px 10px; border: 1px solid rgba(var(--fg-rgb), .18); border-left: 3px solid var(--era); border-radius: 6px; }
}
@media (max-width: 359px) { .op-num { font-size: 88px; } }
@media (max-height: 700px) {
  .pgi { padding: 46px 20px calc(40px + env(safe-area-inset-bottom)); }
  .tx-main p { font-size: 14px; line-height: 1.85; margin-bottom: 10px; }
  .ob-p { font-size: 13.5px; line-height: 1.85; margin-bottom: 8px; }
  .op-num { font-size: 84px; }
  .tx-main p.drop::first-letter { font-size: 46px; }
}
/* image */
.xj-page.pg-image { background: #000; }
.pgi-image { position: relative; margin: 0; padding: 0; height: 100%; justify-content: flex-end; color: #fff; background: #0c0b09; }
.pgi-image img { position: absolute; inset: 0; width: 100%; height: 100%; }
.pgi-image.fit-cover img { object-fit: cover; }
.pgi-image.fit-contain { padding-top: 50px; }
.pgi-image.fit-contain img { position: static; flex: 1 1 0; min-height: 0; width: 100%; height: 0; object-fit: contain; }
.pgi-image.fit-contain figcaption { flex: none; padding: 12px 24px calc(40px + env(safe-area-inset-bottom)); background: #0c0b09; }
.pgi-image figcaption { position: relative; z-index: 1; padding: 70px 24px calc(40px + env(safe-area-inset-bottom)); background: linear-gradient(to top, rgba(0,0,0,.88), rgba(0,0,0,.55) 55%, transparent); }
.pgi-image figcaption p { margin: 0 0 6px; font-size: 14px; line-height: 1.8; color: rgba(255,255,255,.92); }
.pgi-image figcaption a { font-family: var(--mono); font-size: 9.5px; line-height: 1.5; color: rgba(255,255,255,.55); text-decoration: none; overflow-wrap: anywhere; }
/* quote */
.pgi-quote { margin: 0; height: 100%; justify-content: center; align-items: center; text-align: center; gap: 18px; }
.pgi-quote blockquote { margin: 0; white-space: pre-line; max-width: 100%; font-family: var(--serif); font-size: 24px; line-height: 1.7; letter-spacing: .06em; color: var(--gilt-hi); }
.pgi-quote figcaption { font-size: 12px; color: var(--text-3); }
.pgi-quote.vert blockquote { writing-mode: vertical-rl; font-size: 28px; line-height: 1.5; letter-spacing: .3em; max-height: 62%; text-align: start; }
/* object */
.ob-kick { font-family: var(--mono); font-size: 10.5px; letter-spacing: .22em; color: var(--era); }
.ob-title { font-family: var(--serif); font-size: 26px; font-weight: 500; margin: 6px 0 12px; }
.ob-p { font-size: 14.5px; line-height: 1.95; color: var(--text-2); margin: 0 0 12px; }
.ob-fig { margin: auto 0 0; padding-top: 10px; }
.ob-fig img { display: block; width: auto; max-width: 100%; height: auto; max-height: 40dvh; margin: 0 auto; object-fit: contain; background: #0c0b09; }
.ob-fig figcaption { margin-top: 5px; font-family: var(--mono); font-size: 9.5px; line-height: 1.5; color: var(--text-3); }
.ob-fig figcaption a { color: inherit; text-decoration: none; }
/* people */
.pp-title { font-family: var(--serif); font-size: 24px; font-weight: 500; margin: 0 0 14px; }
.pp-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; }
.pp-list li { display: flex; gap: 12px; align-items: flex-start; }
.pp-av { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-family: var(--serif); font-size: 18px; color: var(--era); border: 1.5px solid var(--era); }
.pp-body { display: grid; gap: 3px; min-width: 0; }
.pp-name b { font-weight: 500; font-size: 15px; color: var(--text); margin-right: 8px; }
.pp-name i { font-style: normal; font-size: 11.5px; color: var(--text-3); }
.pp-line { font-size: 13.5px; line-height: 1.8; color: var(--text-2); }
/* map: the page is the live map; only the caption box sits on it */
.pgi-map { position: relative; height: 100%; padding: 0; justify-content: flex-end; pointer-events: none; }
.xj-mapcap { pointer-events: auto; margin: 0 14px calc(40px + env(safe-area-inset-bottom)); padding: 12px 16px 6px; border-radius: 12px; background: rgba(var(--bg-rgb), .9); border: 1px solid rgba(var(--gilt-rgb), .28); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.mc-place { font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em; color: var(--era); }
.pgi-map::before { content: ""; position: absolute; inset: 8px 8px calc(30px + env(safe-area-inset-bottom)); border: 1px solid rgba(var(--gilt-rgb), .55); border-radius: 14px; box-shadow: inset 0 0 60px 10px rgba(var(--bg-rgb), .55); pointer-events: none; }
.xj-maphead { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); padding: 5px 14px; border-radius: 999px; background: rgba(var(--bg-rgb), .9); border: 1px solid rgba(var(--gilt-rgb), .4); font-size: 12.5px; letter-spacing: .12em; color: var(--text); white-space: nowrap; }
.xj-maphead span { color: var(--era); margin-right: 8px; font-family: var(--serif); }
.xj-mapcap p { margin: 6px 0 8px; font-size: 14px; line-height: 1.85; color: var(--text); }
/* end */
.pgi-end .xj-end { padding: 0; }
@media (min-width: 921px) {
  .xunji-panel.is-paged { width: min(460px, 45vw); background: transparent; }
  .xunji-panel.is-paged.on-map { border-color: transparent; box-shadow: none; }
}
/* Desktop: the open magazine — a two-page spread over the dimmed map */
.xj-turn, .xj-deskfoot, .xj-blank { display: none; }
@media (min-width: 921px) {
  .xunji-panel.is-desk { background: transparent; border: 0; box-shadow: none; border-radius: 0; pointer-events: none; overflow: hidden; }
  /* The tools sit outside the spread, top right, stacked — never over a page */
  .xunji-panel.is-desk .xj-rtools { pointer-events: auto; top: var(--sp-top); right: calc(50% - var(--sp-w) / 2 - 52px); flex-direction: column; border-radius: 22px; }
  /* Paper behind the spread, so a turning page never shows the desk; a map half stays clear */
  .xj-pages.desk .xj-pager { background: var(--surface); }
  .xj-pages.desk .xj-pager.map-l { background: linear-gradient(to right, transparent 50%, var(--surface) 50%); }
  .xj-pages.desk .xj-pager.map-r { background: linear-gradient(to right, var(--surface) 50%, transparent 50%); }
  .xj-pages.desk { position: relative; flex: 1; }
  .xj-pages.desk .xj-pager { left: calc(50% - var(--sp-w) / 2); top: var(--sp-top); right: auto; bottom: auto; width: var(--sp-w); height: var(--sp-h); display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 100%; overflow: hidden; scroll-snap-type: none; border-radius: 3px; box-shadow: 0 0 0 100vmax rgba(8,7,6,.6), 0 24px 70px rgba(0,0,0,.6); pointer-events: none; }
  .xj-pages.desk .xj-page { display: none; flex: none; width: auto; height: 100%; min-height: 0; scroll-snap-align: none; }
  .xj-pages.desk .xj-page.sp-l, .xj-pages.desk .xj-page.sp-r, .xj-pages.desk .xj-page.sp-f { display: block; grid-row: 1; pointer-events: auto; }
  .xj-pages.desk .xj-page.sp-l { grid-column: 1; box-shadow: inset -22px 0 24px -22px rgba(0,0,0,.45); }
  .xj-pages.desk .xj-page.sp-r { grid-column: 2; box-shadow: inset 22px 0 24px -22px rgba(0,0,0,.45); }
  .xj-pages.desk .xj-page.sp-f { grid-column: 1 / span 2; }
  .xj-pages.desk .xj-page.pg-map { pointer-events: none; box-shadow: none; }
  /* A lone page faces a designed sheet — a page of paper, not a hole onto the desk */
  .xj-pages.desk .xj-blank { display: flex; grid-row: 1; pointer-events: auto; background: var(--surface); position: relative; overflow: hidden; --era-c: var(--era, var(--gilt)); }
  .xj-pages.desk .xj-blank.l { box-shadow: inset -18px 0 28px -22px rgba(0,0,0,.6); }
  .xj-pages.desk .xj-blank.r { box-shadow: inset 18px 0 28px -22px rgba(0,0,0,.6); }
  .xb-sheet { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; }
  .xb-sheet::before { content: ""; position: absolute; inset: 22px; border: 1px solid rgba(var(--gilt-rgb), .28); border-radius: 4px; pointer-events: none; }
  .xb-inner { position: relative; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
  .xb-ghost { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -58%); font-family: var(--serif); font-size: clamp(160px, 26vh, 280px); line-height: 1; color: var(--era-c); opacity: .09; pointer-events: none; }
  .xb-kick { font-family: var(--mono); font-size: 10.5px; letter-spacing: .32em; color: var(--era-c); }
  .xb-vert { writing-mode: vertical-rl; font-family: var(--serif); font-size: clamp(30px, 5vh, 46px); letter-spacing: .32em; line-height: 1.2; color: var(--text); max-height: 46vh; }
  .xb-vert.sm { font-size: clamp(20px, 3.2vh, 28px); letter-spacing: .24em; color: var(--gilt-hi); }
  .xb-seal { display: inline-block; padding: 4px 7px; border: 1.5px solid var(--seal); color: var(--seal-ink-strong); border-radius: 3px; font-size: 13px; letter-spacing: .16em; }
  .xb-seal.big { font-family: var(--serif); font-size: 30px; padding: 8px 12px; background: rgba(var(--seal-rgb), .9); color: #fff; border-color: transparent; }
  .xb-meta { font-family: var(--mono); font-size: 10.5px; letter-spacing: .16em; color: var(--text-3); }
  .xb-turn { margin-top: 10px; font-size: 12.5px; letter-spacing: .2em; color: var(--gilt); }
  .xj-pages.desk .xj-blank.l { grid-column: 1; }
  .xj-pages.desk .xj-blank.r { grid-column: 2; }
  .xj-pages.desk .xj-page.sp-l, .xj-pages.desk .xj-page.sp-r { cursor: default; }
  .xj-pages.desk .xj-edge, .xj-pages.desk .xj-folio, .xj-pages.desk .xj-more { display: none; }
  .xj-pages.desk .pgi { padding: 44px 34px 34px; }
  .xj-pages.desk .pgi-cover, .xj-pages.desk .pgi-image, .xj-pages.desk .pgi-map { padding: 0; }
  .xj-pages.desk .pgi-image.fit-contain { padding-top: 40px; }
  .xj-pages.desk .pg-cover-text { padding: 0 40px 64px; }
  .xj-pages.desk .tx-main p { font-size: var(--fs, clamp(14.5px, calc(var(--sp-h) * .0245), 17px)); line-height: var(--lh, 2); margin-bottom: .75em; }
  .xj-pages.desk .ob-p, .xj-pages.desk .pp-line { font-size: var(--fs, clamp(14px, calc(var(--sp-h) * .023), 16px)); line-height: var(--lh, 1.95); }
  .xj-pages.desk .pg-lede { font-size: clamp(14px, calc(var(--sp-h) * .023), 16px); line-height: 1.95; }
  .xj-pages.desk .pgi-text.has-note { grid-template-columns: minmax(0, 1fr) 104px; column-gap: 22px; }
  .xj-pages.desk .sp-l .pgi-text.has-note { grid-template-columns: 104px minmax(0, 1fr); }
  .xj-pages.desk .sp-l .tx-note { order: -1; border-left: 0; padding-left: 0; border-right: 1.5px solid var(--era); padding-right: 11px; text-align: right; }
  .xj-pages.desk .tx-note { font-size: 12px; }
  .xj-pages.desk .op-num { font-size: 130px; }
  .xj-pages.desk .op-title { font-size: 36px; }
  .xj-pages.desk .op-line { font-size: 16px; }
  .xj-pages.desk .pgi-quote blockquote { font-size: 30px; }
  .xj-pages.desk .pgi-quote.vert blockquote { font-size: 34px; }
  .xj-pages.desk .pgi-image figcaption { padding: 80px 40px 44px; }
  .xj-pages.desk .pgi-image.fit-contain figcaption { padding: 14px 40px 36px; }
  .xj-pages.desk .xj-mapcap { margin: 0 20px 24px; }
  .xj-pages.desk.note-below .pgi-text.has-note, .xj-pages.desk.note-below .sp-l .pgi-text.has-note { grid-template-columns: minmax(0, 1fr); }
  .xj-pages.desk.note-below .tx-note, .xj-pages.desk.note-below .sp-l .tx-note { order: 0; margin-top: 4px; padding: 8px 10px; text-align: left; border: 1px solid rgba(var(--fg-rgb), .18); border-left: 3px solid var(--era); border-radius: 6px; }
  .xj-catch { display: none; }
  .xj-pages.desk .xj-catch { display: block; position: absolute; inset: 0; z-index: 0; pointer-events: auto; }
  .xj-pages.desk .xj-page.has-more::after { content: "↓"; position: sticky; bottom: 0; display: block; height: 46px; margin-top: -46px; padding-top: 24px; box-sizing: border-box; text-align: center; font-family: var(--mono); font-size: 13px; color: var(--era); background: linear-gradient(to top, var(--surface) 30%, transparent); pointer-events: none; }
  html.xj-desk-on, html.xj-desk-on body { overscroll-behavior-x: none; }
  .xj-pages.desk .xj-turn { display: grid; place-items: center; position: absolute; z-index: 4; width: 48px; height: 48px; border-radius: 50%; border: 1px solid rgba(var(--gilt-rgb), .4); background: rgba(8,7,6,.72); color: #f1e9d6; font-size: 26px; line-height: 1; cursor: pointer; pointer-events: auto; top: calc(var(--sp-top) + var(--sp-h) / 2 - 24px); }
  .xj-pages.desk .xj-turn.l { left: calc(50% - var(--sp-w) / 2 - 68px); }
  .xj-pages.desk .xj-turn.r { right: calc(50% - var(--sp-w) / 2 - 68px); }
  .xj-pages.desk .xj-turn:hover:not(:disabled) { border-color: var(--era); color: var(--era); }
  .xj-pages.desk .xj-turn:disabled { opacity: .28; cursor: default; }
  .xj-pages.desk .xj-turn:focus-visible { outline: 2px solid var(--era); outline-offset: 2px; }
  .xj-pages.desk .xj-deskfoot { display: flex; align-items: center; gap: 18px; position: absolute; z-index: 4; left: calc(50% - var(--sp-w) / 2); width: var(--sp-w); top: calc(var(--sp-top) + var(--sp-h)); height: 40px; pointer-events: auto; }
  .dk-folio { flex: none; font-family: var(--mono); font-size: 10.5px; letter-spacing: .12em; color: #e9e2d2; text-shadow: 0 1px 6px rgba(0,0,0,.8); white-space: pre; }
  .dk-segs { flex: 1; display: flex; gap: 4px; align-items: center; }
  .dk-seg { all: unset; cursor: pointer; box-sizing: border-box; height: 20px; position: relative; min-width: 6px; }
  .dk-seg::before { content: ""; position: absolute; left: 0; right: 0; top: 8px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.28); }
  .dk-seg.past::before { background: rgba(255,255,255,.55); }
  .dk-seg.on::before { background: var(--era); top: 7px; height: 6px; }
  .dk-seg:hover::before { background: #fff; }
  .dk-seg:focus-visible { outline: 2px solid var(--era); outline-offset: 1px; }
  .xj-pager.turn-f > .xj-page, .xj-pager.turn-f > .xj-blank { animation: xjTurnF .22s ease-out; }
  .xj-pager.turn-b > .xj-page, .xj-pager.turn-b > .xj-blank { animation: xjTurnB .22s ease-out; }
}
@keyframes xjTurnF { from { transform: translateX(10px); } to { transform: none; } }   /* slide only — no fade, nothing behind ever shows through */
@keyframes xjTurnB { from { transform: translateX(-10px); } to { transform: none; } }
@media (prefers-reduced-motion: reduce) { .xj-pager.turn-f > *, .xj-pager.turn-b > * { animation: none !important; } }
.xj-shelf-item { display: contents; }
.xj-cover-card { all: unset; cursor: pointer; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; width: 100%; height: 180px; padding: 14px 16px; margin: 0 0 10px; border-radius: 12px; overflow: hidden; background: #000; border: 1px solid rgba(var(--gilt-rgb), .22); }
.xj-cover-card:hover { border-color: var(--era); }
.xj-cover-card:focus-visible { outline: 2px solid var(--era); outline-offset: 2px; }
.xj-cover-card img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .8; }
.xj-cover-card::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,0) 70%); }
.xj-cover-card > span { position: relative; z-index: 1; }
.cc-mag { font-family: var(--serif); font-size: 34px; line-height: 1.1; color: #fff; letter-spacing: .04em; }
.cc-meta { font-family: var(--mono); font-size: 10px; letter-spacing: .12em; color: var(--era); }
.cc-deck { font-size: 12.5px; line-height: 1.55; color: rgba(255,255,255,.85); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
@media (max-width: 920px) {
  .xunji-panel.is-reading { width: auto; left: 0; right: 0; }
  .xunji-panel.is-reading.has-thread:not(.mini) { top: calc(var(--xj-top, 0px) + 50px); height: calc(100dvh - var(--xj-top, 0px) - 50px);   /* below the 时空 · 地图 · 循迹 switch */ max-height: none; border-radius: 0; background: transparent; border: 0; box-shadow: none; padding-bottom: 0; }
  .xunji-panel.is-reading .xj-strip { display: block; flex: none; height: 140px; background: transparent; cursor: pointer; touch-action: none; }
  .xunji-panel.is-reading.mini .xj-strip, .xunji-panel.is-reading.mini .xj-mag, .xunji-panel.is-reading.mini .xj-pages { display: none; }
  .xunji-panel.is-reading.mini .xj-readhead { display: block; }
  .xunji-panel.is-reading.mini .xj-rtools { top: 22px; background: none; }
  .xj-mag { border-radius: 18px 18px 0 0; }
  .xj-pages { border-radius: 18px 18px 0 0; overflow: hidden; }
  .xunji-panel.is-paged .xj-strip { height: 24px; background: var(--surface); border-radius: 18px 18px 0 0; position: relative; }
  .xunji-panel.is-paged .xj-strip::after { content: ""; position: absolute; left: 50%; top: 10px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: rgba(var(--fg-rgb), .3); }
  .xunji-panel.is-paged.on-map .xj-strip { background: transparent; }
  .xunji-panel.is-paged .xj-pages { border-radius: 0; }
  .xunji-panel.is-paged.on-map { background: transparent; }
}
.xj-links { display: grid; gap: 8px; }
.xj-link { all: unset; cursor: pointer; display: grid; gap: 3px; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(var(--gilt-rgb), .3); font-size: 13px; overflow-wrap: anywhere; }
.xj-link b { color: var(--gilt); font-weight: 500; }
.xj-link span { font-size: 12px; color: var(--text-3); }
.xj-link:hover { border-color: var(--gilt); }
.hl-threads { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
`
