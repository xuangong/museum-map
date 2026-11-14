import { CHINA_GEO_JSON } from "./geo-data"
import { ERA_VOICES } from "../../data/era-voices"

// 时空地层 — the 3D time-space view. Served as an ES module at /assets/strata.js.
//
// Space is the map plane (x = longitude, z = latitude); time is height. Each
// dynasty is a stratum, oldest at the bottom; today's map is the surface on top.
// A gilt thread runs through the capitals (the centre of civilisation moving
// through time). Each museum drops a beam of light from today's surface into the
// strata it holds; where a museum stands on a dynasty's own site the beam lands on
// it (「此地即彼时」).
//
// API (window.MuseumStrata):
//   init(container, data, callbacks) → boolean   // false if WebGL is unavailable
//   update({ mode, dynastyId, visitedIds, selectedId })
//   setActive(on) / resize()
export const STRATA_MODULE = `
import * as THREE from '/cdn/three.module.js';

const GEO = ${CHINA_GEO_JSON};
const DEG = Math.PI / 180;
const LAT0 = 35.6, LNG0 = 104.2, KX = Math.cos(36 * DEG), SCALE = 0.1;
const GAP = 0.2, TOP_GAP = 0.46;
const px = (lng) => (lng - LNG0) * KX * SCALE;
const pz = (lat) => -(lat - LAT0) * SCALE;

// One palette per hall (theme). Dark halls draw with light (additive glow); the paper
// hall draws with ink (normal blending, intensity carried by alpha instead of brightness).
// lineK / fillK scale layer outline / fill opacity for that hall.
const PALETTES = {
  night:  { ink: false, line: 0xEFE8DA, bone: 0xEFE8DA, fill: 0xD4B072, gilt: 0xD4B072, giltHi: 0xF2D79E, seal: 0xEC5A3D, river: 0x6FA3B8, patina: 0x8DB8A9, lineK: 1, fillK: 1 },
  qinglu: { ink: false, line: 0xCFE8DE, bone: 0xE4F0EA, fill: 0x4FBF9F, gilt: 0xE6C276, giltHi: 0xF8E2AA, seal: 0xF2694A, river: 0x7FC8E2, patina: 0x8AD8BC, lineK: 1.05, fillK: 1.6 },
  paper:  { ink: true,  line: 0x3A2F22, bone: 0x2B231A, fill: 0x9A7A48, gilt: 0x9C6F25, giltHi: 0x6E4510, seal: 0xC8371E, river: 0x3C7592, patina: 0x2F7461, lineK: 1.25, fillK: 2.2 },
};
const COL = {};
['line', 'bone', 'fill', 'gilt', 'giltHi', 'seal', 'river', 'patina'].forEach((k) => { COL[k] = new THREE.Color(); });
let PAL = PALETTES.night;
function loadPalette(name) {
  PAL = PALETTES[name] || PALETTES.night;
  Object.keys(COL).forEach((k) => COL[k].setHex(PAL[k]));
}
loadPalette('night');

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.16, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A seal ring around a dot — marks your museums that stand on the era's own ground (原址).
function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 11;
  g.beginPath(); g.arc(32, 32, 23, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 4.5;
  g.beginPath(); g.arc(32, 32, 23, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── 琴弦 sound: a warm plucked string (Karplus–Strong), tuned to 宫商角徵羽 ──
// Pitches are degrees of a pentatonic ladder (5 per octave) above G2. Longer strings reach
// deeper into history and sound lower; stopping a string at an era (its 徽) shortens it.
const PENTA = [0, 2, 4, 7, 9];
const MAX_DEG = 17;
const degFreq = (d) => { d = Math.max(0, Math.min(MAX_DEG, d)); return 98 * Math.pow(2, (12 * Math.floor(d / 5) + PENTA[d % 5]) / 12); };
let actx = null, master = null, audioUnlocked = false;
const ksCache = {};
// iOS: let page audio play with the ring/silent switch on (Safari 17+: Audio Session API;
// older: a looping silent <audio> moves the session to playback), and start the context
// inside a real gesture (touchend / click — touchstart does not count).
function silentWavUrl() {
  const n = 800, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) b[o + i] = str.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b[44 + i] = 128;
  let bin = ''; for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}
function unlockAudio() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const ac = audioCtx();
  if (!ac || audioUnlocked) return;
  audioUnlocked = true;
  try { const b = ac.createBuffer(1, 1, 22050), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start(0); } catch (e) {}
  if (!navigator.audioSession && /iP(hone|ad|od)/.test(navigator.userAgent)) {
    try { const a = new Audio(silentWavUrl()); a.loop = true; a.setAttribute('playsinline', ''); a.play().catch(() => {}); } catch (e) {}
  }
}
function audioCtx() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      actx = new AC();
      master = actx.createGain(); master.gain.value = 0.55;
      const comp = actx.createDynamicsCompressor();
      master.connect(comp); comp.connect(actx.destination);
      // A quiet hall: generated impulse, about two seconds of tail.
      try {
        const sr = actx.sampleRate, n = Math.floor(sr * 2.2), ir = actx.createBuffer(2, n, sr);
        for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
        const conv = actx.createConvolver(); conv.buffer = ir;
        const wet = actx.createGain(); wet.gain.value = 0.2;
        master.connect(conv); conv.connect(wet); wet.connect(comp);
      } catch (e) {}
    } catch (e) { actx = null; return null; }
  }
  if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
  return actx;
}
function ksBuffer(ac, freq, lpk, decay) {
  lpk = lpk == null ? 0.4 : lpk; decay = decay || 2.4;
  const key = Math.round(freq * 10) + ':' + lpk + ':' + decay;
  if (ksCache[key]) return ksCache[key];
  const sr = ac.sampleRate, n = Math.floor(sr * 3), buf = ac.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const P = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(P);
  // A finger, not a pick: the excitation is softened before it rings.
  let lp = 0;
  for (let i = 0; i < P; i++) { lp = lp * lpk + (Math.random() * 2 - 1) * (1 - lpk); ring[i] = lp; }
  const rho = Math.pow(0.001, 1 / (freq * decay));   // 'decay' seconds to fade, whatever the pitch
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[idx], b = ring[(idx + 1) % P];
    const env = Math.min(1, i / (sr * 0.003)) * Math.min(1, (n - i) / (sr * 0.25));
    d[i] = a * env * 0.7;
    ring[idx] = (a + b) * 0.5 * rho;
    idx = (idx + 1) % P;
  }
  ksCache[key] = buf;
  return buf;
}
// ── Era voices: every stratum has its own instrument, whether or not you have strings there;
// 今 is your own strings. All synthesized: plucks are Karplus–Strong buffers, struck stone,
// bronze and the qin are decaying partials, winds and the huqin are shaped oscillators.
// Era → instrument and the museum object it is drawn from (src/data/era-voices.ts).
const ERA = ${JSON.stringify(ERA_VOICES)};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VOICES = {
  ks: { name: '你的琴弦', oct: 1, g: 1.2, pluck: [0.4, 2.4] },
  // Plucked strings
  zhu: { oct: 1, g: 1.45, pluck: [0.12, 0.7], click: 0.45 },
  se: { oct: 1, g: 1.2, pluck: [0.28, 2.0] },
  pipa: { oct: 2, g: 1.25, pluck: [0.06, 0.9] },
  // Struck stone, bronze, drum; the qin rings like a struck string with a slow 吟
  qing: { oct: 2, g: 0.6, bell: [[1, 1, 1.4], [2.32, 0.45, 0.6], [3.86, 0.28, 0.4], [5.33, 0.14, 0.25]], click: 0.35 },
  tongqing: { oct: 2, g: 0.55, bell: [[1, 1, 2.2], [2.4, 0.42, 1], [3.9, 0.25, 0.6], [5.4, 0.12, 0.35]], click: 0.22 },
  nao: { oct: 2, g: 0.55, bell: [[1, 1, 0.9], [1.53, 0.6, 0.6], [2.3, 0.4, 0.4], [3.2, 0.25, 0.25], [4.4, 0.12, 0.15]], click: 0.4 },
  zhong: { oct: 2, g: 0.5, bell: [[0.5, 0.3, 2.6], [1, 1, 2], [1.19, 0.5, 1.3], [1.5, 0.2, 0.9], [2, 0.38, 0.8], [2.74, 0.14, 0.4]], click: 0.25 },
  tonggu: { oct: 1, g: 0.85, bell: [[1, 1, 0.6], [1.59, 0.5, 0.35], [2.14, 0.35, 0.25], [2.65, 0.2, 0.2]], click: 0.6 },
  qin: { oct: 1, g: 0.46, bell: [[1, 1, 3.2], [2, 0.5, 2.2], [3, 0.28, 1.6], [4, 0.14, 1.1], [5, 0.08, 0.8]], click: 0.08, vib: [5, 0.006, 0.5] },
  // Blown and bowed
  gudi: { oct: 2, g: 0.42, h: [1, 0.08, 0.05], env: [0.05, 0.34, 0.35], breath: 0.3, vib: [5, 0.003, 0.3] },
  paixiao: { oct: 2, g: 0.44, h: [1, 0.05, 0.1, 0.02], env: [0.06, 0.34, 0.4], breath: 0.34 },
  di: { oct: 2, g: 0.44, h: [1, 0.4, 0.18, 0.07, 0.04, 0.03, 0.025, 0.02], env: [0.035, 0.3, 0.3], breath: 0.14, vib: [5.8, 0.006, 0.22] },
  guan: { oct: 2, g: 0.28, h: [1, 0.8, 0.65, 0.5, 0.4, 0.3, 0.22, 0.15, 0.1, 0.07], env: [0.05, 0.38, 0.3], breath: 0.05, vib: [5.2, 0.01, 0.2] },
  huqin: { oct: 2, g: 0.44, h: [1, 0.55, 0.36, 0.24, 0.16, 0.11, 0.07, 0.05, 0.03], env: [0.12, 0.42, 0.35], breath: 0.03, vib: [5.5, 0.009, 0.15] },
};
const waveCache = {};
let noiseBuf = null;
function noise(ac) {
  if (noiseBuf) return noiseBuf;
  const n = ac.sampleRate, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = b);
}
// Slow vibrato that fades in after 'delay' (a qin's 吟, a flute's breath).
function vibrato(ac, param, f, vib, when, end, srcs) {
  if (!vib) return;
  const lfo = ac.createOscillator(), dg = ac.createGain();
  lfo.frequency.value = vib[0];
  dg.gain.setValueAtTime(0, when); dg.gain.linearRampToValueAtTime(f * vib[1], when + vib[2] + 0.3);
  lfo.connect(dg); dg.connect(param); lfo.start(when); lfo.stop(end); srcs.push(lfo);
}
function burst(ac, out, amp, freq, when, len, srcs, envFn) {
  const n = ac.createBufferSource(); n.buffer = noise(ac); n.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(9000, freq); bp.Q.value = 1.2;
  const g = ac.createGain();
  envFn ? envFn(g.gain) : (g.gain.setValueAtTime(amp, when), g.gain.exponentialRampToValueAtTime(0.0001, when + len));
  n.connect(bp); bp.connect(g); g.connect(out);
  n.start(when, Math.random() * 0.5); n.stop(when + len + 0.05); srcs.push(n);
}
// One note at pentatonic degree 'deg' on voice 'vk'; 'when' is an AudioContext time (0 = now).
// Returns the sources it started, so a performance can be cut short.
function stringSound(deg, vel, pan, when, vk) {
  const ac = audioCtx();
  if (!ac || !master) return [];
  const V = VOICES[vk] || VOICES.ks, srcs = [];
  try {
    const t = Math.max(when || 0, ac.currentTime), f = degFreq(deg) * V.oct;
    const out = ac.createGain(); out.gain.value = 0.34 * V.g * Math.max(0.3, Math.min(1.3, vel));
    if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = Math.max(-0.8, Math.min(0.8, pan || 0)); out.connect(pn); pn.connect(master); }
    else out.connect(master);
    if (V.pluck) {
      const src = ac.createBufferSource();
      src.buffer = ksBuffer(ac, f, V.pluck[0], V.pluck[1]);
      src.connect(out); src.start(t); srcs.push(src);
    } else if (V.bell) {
      // Struck: each partial rings and dies on its own.
      V.bell.forEach(([r, a, dec]) => {
        const fr = f * r; if (fr > 9000) return;
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = fr;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, dec / 4);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + dec * 1.4 + 0.1); srcs.push(o);
        vibrato(ac, o.frequency, fr, V.vib, t, t + dec * 1.4 + 0.1, srcs);
      });
    } else {
      // Blown or bowed: a shaped tone with breath around it.
      const [a, hold, rel] = V.env, end = t + a + hold + rel * 2.2;
      const key = vk;
      if (!waveCache[key]) { const im = new Float32Array([0].concat(V.h)), re = new Float32Array(im.length); waveCache[key] = ac.createPeriodicWave(re, im); }
      const o = ac.createOscillator(), g = ac.createGain();
      o.setPeriodicWave(waveCache[key]); o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + a); g.gain.setValueAtTime(1, t + a + hold * 0.4);
      g.gain.linearRampToValueAtTime(0.82, t + a + hold); g.gain.setTargetAtTime(0, t + a + hold, rel / 3);
      o.connect(g); g.connect(out); o.start(t); o.stop(end); srcs.push(o);
      vibrato(ac, o.frequency, f, V.vib, t, end, srcs);
      if (V.breath) burst(ac, out, V.breath, f * 2, t, a + hold + rel, srcs, (gp) => {
        gp.setValueAtTime(0, t); gp.linearRampToValueAtTime(V.breath, t + a * 0.6); gp.setTargetAtTime(V.breath * 0.35, t + a, 0.08); gp.setTargetAtTime(0, t + a + hold, rel / 3);
      });
    }
    if (V.click) burst(ac, out, V.click, f * 6, t, 0.035, srcs);
  } catch (e) {}
  return srcs;
}

// tint = colour, kk = intensity. Light halls: colour × intensity, added. Ink hall: a
// crisper dot whose opacity is the intensity.
function pointsMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, pr: { value: Math.min(window.devicePixelRatio || 1, 2) }, k: { value: 9.0 }, ink: { value: 0 } },
    vertexShader:
      'attribute float size; attribute vec3 tint; attribute float kk; varying vec3 vTint; varying float vK; uniform float pr; uniform float k;' +
      'void main(){ vTint = tint; vK = kk; vec4 mv = modelViewMatrix * vec4(position, 1.0);' +
      ' gl_PointSize = size * pr * (k / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader:
      'uniform sampler2D map; uniform float ink; varying vec3 vTint; varying float vK;' +
      'void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a < 0.01) discard;' +
      ' if (ink > 0.5) { gl_FragColor = vec4(vTint, smoothstep(0.12, 0.55, t.a) * clamp(vK, 0.0, 1.0)); }' +
      ' else { gl_FragColor = vec4(vTint * vK, t.a); } }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

function segmentsFromLines(lines, closed) {
  const arr = [];
  for (const r of lines) {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i], b = r[i + 1];
      arr.push(px(a[0]), 0, pz(a[1]), px(b[0]), 0, pz(b[1]));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3));
  return g;
}

function ringArea(r) {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return Math.abs(a) / 2;
}

// Flat filled area (y = 0) from lng/lat rings, merged into one non-indexed geometry.
function mergedFill(rings, minArea) {
  const pos = [];
  for (const r of rings) {
    if (ringArea(r) < minArea) continue;
    const shape = new THREE.Shape(r.map((p) => new THREE.Vector2(px(p[0]), -pz(p[1]))));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position.array;
    if (g.index) { const idx = g.index.array; for (let i = 0; i < idx.length; i++) pos.push(p[idx[i] * 3], p[idx[i] * 3 + 1], p[idx[i] * 3 + 2]); }
    else for (let i = 0; i < p.length; i++) pos.push(p[i]);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  return out;
}
function bboxOf(rings) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  rings.forEach((r) => r.forEach((p) => {
    const x = px(p[0]), z = pz(p[1]);
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }));
  return { x0, x1, z0, z1 };
}
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return r[0];
  return [cx / (3 * a), cy / (3 * a)];
}
// A small ring (lng/lat) — 文化圈 around a Neolithic culture site.
function circleRing(lng, lat, rDeg) {
  const out = [], k = 1 / Math.cos(lat * DEG);
  for (let i = 0; i <= 28; i++) { const t = (i / 28) * Math.PI * 2; out.push([lng + Math.cos(t) * rDeg * k, lat + Math.sin(t) * rDeg]); }
  return out;
}

function shortName(name) {
  const n = name || '';
  const i = n.search(/[（(]/);
  return (i >= 0 ? n.slice(0, i) : n).replace(/^东周：.*/, '东周').trim();
}
function shortPeriod(p) {
  return (p || '').replace(/约公元/g, '').replace(/公元/g, '').replace(/年/g, '').replace(/—/g, '–');
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

const S = { ready: false };

function init(container, data, cb) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return false; }
  if (!renderer.getContext()) return false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.className = 'strata-canvas';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const world = new THREE.Group(); scene.add(world);
  const tex = glowTexture();

  const layersData = data.dynasties.map((d) => ({ id: d.id, name: shortName(d.name), period: shortPeriod(d.period) }));
  const N = layersData.length;
  const yOf = (i) => i * GAP;
  const yTop = (N - 1) * GAP + TOP_GAP;
  const H = yTop;

  const outlineGeom = segmentsFromLines(GEO.main);
  // The South China Sea inset belongs to today's map; ancient strata carry only a ghost outline.
  const insetGeom = segmentsFromLines(GEO.scs.concat([GEO.scsFrame]));
  const riverLines = [];
  Object.keys(GEO.rivers).forEach((k) => GEO.rivers[k].forEach((l) => riverLines.push(l)));
  const riverGeom = segmentsFromLines(riverLines);
  const fillGeom = mergedFill(GEO.main, 1);
  const chinaBox = bboxOf(GEO.main);

  // Each stratum: today's outline (fill/outline — the ghost reference once the dynasty's own
  // territory arrives), rivers, and tFill/tLine — that dynasty's territory.
  function makeLayer(y, isTop) {
    const g = new THREE.Group(); g.position.y = y;
    const fill = new THREE.Mesh(fillGeom, new THREE.MeshBasicMaterial({ color: isTop ? COL.bone : COL.gilt, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    const outline = new THREE.LineSegments(outlineGeom, new THREE.LineBasicMaterial({ color: COL.bone, transparent: true, opacity: 0, depthWrite: false }));
    const river = new THREE.LineSegments(riverGeom, new THREE.LineBasicMaterial({ color: COL.river, transparent: true, opacity: 0, depthWrite: false }));
    fill.renderOrder = 1; outline.renderOrder = 2; river.renderOrder = 3;
    g.add(fill, outline, river);
    if (isTop) {
      const inset = new THREE.LineSegments(insetGeom, outline.material);
      inset.renderOrder = 2; g.add(inset);
    }
    world.add(g);
    return { group: g, fill, outline, river, tFill: null, tLine: null, terr: null, to: { fill: 0, outline: 0, river: 0, tFill: 0, tLine: 0 } };
  }
  const layers = layersData.map((L, i) => Object.assign(L, { i, y: yOf(i) }, makeLayer(yOf(i), false)));
  const top = makeLayer(yTop, true);

  // ── Sites (capitals / culture centres) ──
  const sites = [];
  layers.forEach((L) => {
    const g = data.geo[L.id]; if (!g) return;
    g.sites.forEach((s, k) => sites.push({ layer: L.i, k, s, x: px(s.lng), z: pz(s.lat), trail: g.trail.indexOf(k) >= 0 }));
  });
  const sitePos = new Float32Array(sites.length * 3), siteTint = new Float32Array(sites.length * 3), siteK = new Float32Array(sites.length), siteSize = new Float32Array(sites.length);
  sites.forEach((s, i) => { sitePos[i * 3] = s.x; sitePos[i * 3 + 1] = yOf(s.layer); sitePos[i * 3 + 2] = s.z; });
  const siteGeom = new THREE.BufferGeometry();
  siteGeom.setAttribute('position', new THREE.BufferAttribute(sitePos, 3));
  siteGeom.setAttribute('tint', new THREE.BufferAttribute(siteTint, 3));
  siteGeom.setAttribute('kk', new THREE.BufferAttribute(siteK, 1));
  siteGeom.setAttribute('size', new THREE.BufferAttribute(siteSize, 1));
  const sitePoints = new THREE.Points(siteGeom, pointsMaterial(tex)); sitePoints.renderOrder = 6; world.add(sitePoints);

  // ── The thread: capitals, oldest → today ──
  const trailPts = [];
  layers.forEach((L) => {
    const g = data.geo[L.id]; if (!g) return;
    g.trail.forEach((k) => { const s = g.sites[k]; trailPts.push(new THREE.Vector3(px(s.lng), L.y, pz(s.lat))); });
  });
  if (trailPts.length) { const last = trailPts[trailPts.length - 1]; trailPts.push(new THREE.Vector3(last.x, yTop, last.z)); }
  // Each hop rises out of one capital and settles onto the next: a cubic whose
  // control points sit straight above / below the two ends. Moves within a stratum
  // (迁都 inside one dynasty) stay flat on that layer.
  const curve = new THREE.CurvePath();
  for (let i = 0; i < trailPts.length - 1; i++) {
    const a = trailPts[i], b = trailPts[i + 1];
    if (Math.abs(a.y - b.y) < 1e-6) { curve.add(new THREE.LineCurve3(a, b)); continue; }
    const lift = (b.y - a.y) * 0.62;
    curve.add(new THREE.CubicBezierCurve3(a, new THREE.Vector3(a.x, a.y + lift, a.z), new THREE.Vector3(b.x, b.y - lift, b.z), b));
  }
  const tubeSegs = trailPts.length * 24;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, tubeSegs, 0.011, 6, false),
    new THREE.MeshBasicMaterial({ color: COL.gilt, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const tubeGlow = new THREE.Mesh(new THREE.TubeGeometry(curve, tubeSegs, 0.034, 8, false),
    new THREE.MeshBasicMaterial({ color: COL.gilt, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
  tube.renderOrder = 7; tubeGlow.renderOrder = 7; world.add(tube, tubeGlow);
  const tubeIndexCount = tube.geometry.index.count, glowIndexCount = tubeGlow.geometry.index.count;
  const pulses = [0, 1, 2, 3].map(() => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: COL.giltHi, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(0.16, 0.16, 0.16); sp.renderOrder = 8; world.add(sp); return sp;
  });

  // Side threads: parallel capitals (三国, 南北朝 …) and the Neolithic convergence (满天星斗 → 二里头).
  const chainArr = [];
  layers.forEach((L, li) => {
    const g = data.geo[L.id]; if (!g) return;
    (g.chains || []).forEach((ch) => {
      for (let j = 0; j < ch.length - 1; j++) {
        const a = g.sites[ch[j]], b = g.sites[ch[j + 1]];
        chainArr.push(px(a.lng), L.y, pz(a.lat), px(b.lng), L.y, pz(b.lat));
      }
    });
    if (g.converge && layers[li + 1]) {
      const ng = data.geo[layers[li + 1].id];
      const entry = ng && ng.sites[ng.trail[0]];
      if (entry) g.sites.forEach((s) => chainArr.push(px(s.lng), L.y, pz(s.lat), px(entry.lng), layers[li + 1].y, pz(entry.lat)));
    }
  });
  const chainGeom = new THREE.BufferGeometry();
  chainGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(chainArr), 3));
  const chains = new THREE.LineSegments(chainGeom, new THREE.LineBasicMaterial({ color: COL.gilt, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  chains.renderOrder = 6; world.add(chains);

  // ── Museums on today's surface, and their beams into the past ──
  const layerIndexById = {}; layers.forEach((L) => { layerIndexById[L.id] = L.i; });
  const links = {};
  data.dynasties.forEach((d) => {
    const li = layerIndexById[d.id];
    (d.recommendedMuseums || []).concat(d.relatedMuseums || []).forEach((r) => {
      if (!r.museumId) return;
      (links[r.museumId] = links[r.museumId] || {})[li] = true;
    });
  });
  const crossings = data.crossings || {};
  const museums = data.museums.filter((m) => m.lat && m.lng).map((m) => {
    const ls = Object.keys(links[m.id] || {}).map(Number).sort((a, b) => b - a);
    const onSite = {};
    (crossings[m.id] || []).forEach((c) => { if (c.onSite && layerIndexById[c.dynastyId] != null) onSite[layerIndexById[c.dynastyId]] = true; });
    const tiers = m.tiers || [];
    return { id: m.id, name: m.name, seal: (m.seal && m.seal.t) || String(m.name || '').slice(0, 3), x: px(m.lng), z: pz(m.lat), links: ls, onSite, major: tiers.indexOf('tier1') >= 0 || tiers.indexOf('heritage-site') >= 0 };
  });
  const museumIdx = {}; museums.forEach((m, i) => { museumIdx[m.id] = i; });

  const mPos = new Float32Array(museums.length * 3), mTint = new Float32Array(museums.length * 3), mK = new Float32Array(museums.length), mSize = new Float32Array(museums.length);
  museums.forEach((m, i) => { mPos[i * 3] = m.x; mPos[i * 3 + 1] = yTop; mPos[i * 3 + 2] = m.z; });
  const mGeom = new THREE.BufferGeometry();
  mGeom.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeom.setAttribute('tint', new THREE.BufferAttribute(mTint, 3));
  mGeom.setAttribute('kk', new THREE.BufferAttribute(mK, 1));
  mGeom.setAttribute('size', new THREE.BufferAttribute(mSize, 1));
  const mPoints = new THREE.Points(mGeom, pointsMaterial(tex)); mPoints.renderOrder = 9; world.add(mPoints);

  const segs = [];   // { m, lo, hi }  (layer indices; hi = N means today)
  const dots = [];   // { m, layer, onSite }
  museums.forEach((m, mi) => {
    let upper = N;
    m.links.forEach((li) => { segs.push({ m: mi, lo: li, hi: upper }); dots.push({ m: mi, layer: li, onSite: !!m.onSite[li] }); upper = li; });
  });
  // RGBA per vertex: light halls fold intensity into RGB, the ink hall into alpha.
  const bPos = new Float32Array(segs.length * 6), bCol = new Float32Array(segs.length * 8);
  const yAt = (li) => (li >= N ? yTop : yOf(li));
  segs.forEach((s, i) => {
    const m = museums[s.m];
    bPos.set([m.x, yAt(s.hi), m.z, m.x, yAt(s.lo), m.z], i * 6);
  });
  const bGeom = new THREE.BufferGeometry();
  bGeom.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeom.setAttribute('color', new THREE.BufferAttribute(bCol, 4));
  const beams = new THREE.LineSegments(bGeom, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  beams.renderOrder = 5; world.add(beams);

  const dPos = new Float32Array(dots.length * 3), dTint = new Float32Array(dots.length * 3), dK = new Float32Array(dots.length), dSize = new Float32Array(dots.length);
  dots.forEach((d, i) => { const m = museums[d.m]; dPos.set([m.x, yOf(d.layer), m.z], i * 3); });
  const dPosBase = dPos.slice();
  const dotsOf = museums.map(() => []); dots.forEach((d, i) => { dotsOf[d.m].push(i); });
  const dGeom = new THREE.BufferGeometry();
  dGeom.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeom.setAttribute('tint', new THREE.BufferAttribute(dTint, 3));
  dGeom.setAttribute('kk', new THREE.BufferAttribute(dK, 1));
  dGeom.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
  const dPoints = new THREE.Points(dGeom, pointsMaterial(tex)); dPoints.renderOrder = 8; world.add(dPoints);
  // Seal rings share the dots' positions; only your on-site (原址) dots light one.
  const rTint = new Float32Array(dots.length * 3), rK = new Float32Array(dots.length), rSize = new Float32Array(dots.length);
  const rGeom = new THREE.BufferGeometry();
  rGeom.setAttribute('position', dGeom.getAttribute('position'));
  rGeom.setAttribute('tint', new THREE.BufferAttribute(rTint, 3));
  rGeom.setAttribute('kk', new THREE.BufferAttribute(rK, 1));
  rGeom.setAttribute('size', new THREE.BufferAttribute(rSize, 1));
  const rPoints = new THREE.Points(rGeom, pointsMaterial(ringTexture())); rPoints.renderOrder = 8; world.add(rPoints);

  // ── 琴弦: your beams are strings — strum across them, hear the eras they hold ──
  const SP = 36;   // points along a string
  const sPos = new Float32Array(Math.max(1, museums.length) * (SP - 1) * 6);
  const sCol = new Float32Array(Math.max(1, museums.length) * (SP - 1) * 8);
  const sGeom = new THREE.BufferGeometry();
  sGeom.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeom.setAttribute('color', new THREE.BufferAttribute(sCol, 4));
  sGeom.setDrawRange(0, 0);
  const stringMesh = new THREE.LineSegments(sGeom, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  stringMesh.renderOrder = 6; stringMesh.frustumCulled = false; world.add(stringMesh);
  const dKBase = new Float32Array(dots.length), dSizeBase = new Float32Array(dots.length);
  let strings = [], stringByM = {}, stringKey = '', tagHoldUntil = 0;
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let soundOn = true;
  try { soundOn = localStorage.getItem('mmStringSound') !== '0'; } catch (e) {}
  function setRGBA(arr, v, c, k) {
    const o = v * 4;
    if (PAL.ink) { arr[o] = c.r; arr[o + 1] = c.g; arr[o + 2] = c.b; arr[o + 3] = Math.min(1, k * 1.5); }
    else { arr[o] = c.r * k; arr[o + 1] = c.g * k; arr[o + 2] = c.b * k; arr[o + 3] = 1; }
  }
  function buildStrings() {
    const list = [];
    museums.forEach((m, i) => { if (state.visited[m.id] && m.links.length) list.push(i); });
    const key = list.join(',');
    if (key === stringKey) return;
    stringKey = key;
    const lens = list.map((i) => yTop - yOf(museums[i].links[museums[i].links.length - 1]));
    const maxLen = Math.max(1e-6, Math.max.apply(null, lens.concat([0])));
    const prev = stringByM;
    stringByM = {};
    strings = list.map((i, slot) => {
      const len = lens[slot], p = prev[i];
      const note = Math.round((1 - len / maxLen) * 7);   // open string: the longest sounds lowest
      const st = { m: i, slot, y0: yTop, len, note, f: 2.4 + note * 0.3, amp: p ? p.amp : 0, t: p ? p.t : 0, col: COL.seal, k: 0, dirty: true, live: false, last: 0, stop: 1, stopLi: -1 };
      stringByM[i] = st;
      return st;
    });
    sGeom.setDrawRange(0, strings.length * (SP - 1) * 2);
    overlay.classList.toggle('has-strings', strings.length > 0);
    if (play) stopPlay();
    paintPlay();
    hint.textContent = strings.length ? '拨动红色琴弦，听你走过的朝代' : '拖动旋转 · 双指缩放 · 点地层看朝代 · 点光点看博物馆';
  }
  // The note a string gives when stopped at era 'li' (its 徽): the shorter the sounding part,
  // the higher. Open (li < 0) is the whole string.
  function noteAt(st, li) {
    if (li == null || li < 0) return st.note;
    const eff = Math.max(st.len * 0.06, st.y0 - yOf(li));
    return Math.min(MAX_DEG, st.note + Math.round(5 * Math.log2(st.len / eff) * 0.55));
  }
  // One string at time 'now': a damped standing wave between today and where it is stopped
  // (its oldest era when open). Below the stop the string is still.
  function writeString(st, now) {
    const m = museums[st.m], base = st.slot * (SP - 1);
    const age = Math.max(0, (now - st.t) / 1000);
    const a = reduceMotion || state.focus >= 0 ? 0 : st.amp * Math.exp(-age / 1.5);
    const glow = st.amp > 0 ? Math.exp(-age / 0.55) : 0;
    st.live = a > 0.0006 || glow > 0.02;
    const stop = Math.max(0.05, st.stop || 1);
    const rx = Math.cos(cam.az), rz = -Math.sin(cam.az), w = 2 * Math.PI * Math.min(9, st.f / Math.sqrt(stop));
    const disp = (u) => {
      if (a <= 0.0006 || u > stop) return 0;
      const v = u / stop;
      return a * Math.sqrt(stop) * (Math.sin(Math.PI * v) * Math.cos(w * age) + 0.3 * Math.sin(2 * Math.PI * v) * Math.cos(2 * w * age + 1.1));
    };
    let x0 = 0, y0 = 0, z0 = 0;
    const kk = st.k * (1 + 1.3 * glow);
    for (let j = 0; j < SP; j++) {
      const u = j / (SP - 1), y = st.y0 - st.len * u, dd = disp(u);
      const x = m.x + rx * dd, z = m.z + rz * dd;
      if (j > 0) {
        const o = (base + j - 1) * 6;
        sPos[o] = x0; sPos[o + 1] = y0; sPos[o + 2] = z0; sPos[o + 3] = x; sPos[o + 4] = y; sPos[o + 5] = z;
        setRGBA(sCol, (base + j - 1) * 2, st.col, kk * (1 - 0.45 * (j - 1) / (SP - 1)));
        setRGBA(sCol, (base + j - 1) * 2 + 1, st.col, kk * (1 - 0.45 * u));
      }
      x0 = x; y0 = y; z0 = z;
    }
    // The era dots are the notes on the string: they ride with it and flare when it sounds.
    // Stopped at an era, that era's dot is the note that sounds; open, every dot answers.
    dotsOf[st.m].forEach((di) => {
      const u = (st.y0 - yOf(dots[di].layer)) / st.len, dd = disp(u);
      dPos[di * 3] = m.x + rx * dd; dPos[di * 3 + 2] = m.z + rz * dd;
      const g = st.stopLi < 0 ? glow : dots[di].layer === st.stopLi ? glow * 1.4 : 0;
      dK[di] = dKBase[di] + (dKBase[di] > 0 ? 1.1 * g : 0);
      dSize[di] = dSizeBase[di] + (dKBase[di] > 0 ? 10 * g : 0);
    });
  }
  // opts.li: stop at that era (melody); opts.scheduled: the sound is already on the audio clock.
  function pluck(st, strength, sx, opts) {
    opts = opts || {};
    const now = performance.now();
    if (!opts.scheduled && now - st.last < 110) return;
    st.last = now; st.t = now; st.amp = 0.11 * Math.max(0.35, Math.min(1.4, strength)); st.dirty = true;
    st.stopLi = opts.li != null ? opts.li : -1;
    st.stop = st.stopLi >= 0 ? Math.max(0.06, (st.y0 - yOf(st.stopLi)) / st.len) : 1;
    if (soundOn && !opts.scheduled) stringSound(state.focus >= 0 ? noteAt(st, state.focus) : st.note, strength, (sx / Math.max(1, canvas.clientWidth)) * 2 - 1, 0, voiceOf(state.focus));
    if (!opts.scheduled) {
      if (strength > 0.7 && navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
      hoverIdx = st.m; tagHoldUntil = now + 1500;
    }
    // Reading one era: its seal label rings with the note.
    const t = state.focus >= 0 ? mTags[st.m] : null;
    if (t) { t.el.classList.remove('is-sounding'); void t.el.offsetWidth; t.el.classList.add('is-sounding'); }
    lastInteract = now; S.needs = true;
  }

  // ── 奏一曲: the strings write their own tune ──
  // All strata: history plays upward, 远古 → 今. On each era, the strings through it sound,
  // stopped at that era; 今 closes with every string open. One era (reading view): a short
  // phrase on that era's notes. Sound is scheduled on the audio clock; each frame plucks the
  // strings whose notes have started on that same clock, so what you see is what you hear.
  let play = null, playLayer = -1, playRest = false;
  function stringsAt(li) { return strings.filter((st) => museums[st.m].links.indexOf(li) >= 0); }
  function eraOf(li) { return li >= 0 && li < N ? ERA[layers[li].id] || null : null; }
  function voiceOf(li) { const e = eraOf(li); return e && VOICES[e.voice] ? e.voice : 'ks'; }
  // An empty era's own note: a gentle rise through history, so the rests still make a line.
  function homeOf(li) { return 3 + Math.round(li * 4 / Math.max(1, N - 1)); }
  function panOf(st) { if (!st) return 0; const m = museums[st.m], p = screenOf(m.x, st.y0, m.z); return (p.x / Math.max(1, canvas.clientWidth)) * 2 - 1; }
  function compose(F) {
    const ev = [], lay = [];
    let t = 0;
    if (F < 0) {
      for (let li = 0; li < N; li++) {
        const vk = voiceOf(li);
        const here = stringsAt(li).map((st) => ({ st, deg: noteAt(st, li) })).sort((a, b) => a.deg - b.deg || museums[a.st.m].x - museums[b.st.m].x).slice(0, 6);
        if (!here.length) {
          // 留白: one soft note in the era's instrument, and the layer stays dim.
          lay.push({ t, li, rest: true });
          ev.push({ t, st: null, li, deg: homeOf(li), vel: VOICES[vk].pluck ? 0.62 : 0.42, voice: vk });
          t += 0.62;
          continue;
        }
        lay.push({ t, li });
        here.forEach((x, k) => {
          ev.push({ t, st: x.st, li, deg: x.deg, vel: k === 0 ? 1.05 : 0.8, voice: vk });
          t += k === here.length - 1 ? 0.4 : 0.21;
        });
        t += 0.08;
      }
      // 今: every string open, a slow strum on your own strings.
      lay.push({ t, li: N });
      strings.slice().sort((a, b) => a.note - b.note).forEach((st, k) => { ev.push({ t: t + k * 0.06, st, li: -1, deg: st.note, vel: 0.9, voice: 'ks' }); });
      return { ev, lay, dur: t + (strings.length ? strings.length * 0.06 + 2.6 : 1.6) };
    }
    const vk = voiceOf(F);
    const here = stringsAt(F).map((st) => ({ st, deg: noteAt(st, F) })).sort((a, b) => a.deg - b.deg);
    if (!here.length) {
      // No string here yet: the era's instrument plays a short motif alone.
      const h = homeOf(F), motif = [0, 1, 2, 1, 3, 2, 0], beats = [1, 1, 2, 1, 1, 1, 3];
      lay.push({ t: 0, li: F, rest: true });
      motif.forEach((d, k) => { ev.push({ t, st: null, li: F, deg: h + d, vel: 0.55, voice: vk }); t += beats[k] * 0.3; });
      return { ev, lay, dur: t + 2 };
    }
    // The era's notes and their octave, played to a fixed rhythm (beats of 0.26 s).
    const ladder = here.concat(here.map((x) => ({ st: x.st, deg: Math.min(MAX_DEG, x.deg + 5) })));
    const L = ladder.length;
    const shape = [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 4, 3, 2, 1, 0];
    const beats = [1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 3];
    lay.push({ t: 0, li: F });
    shape.forEach((idx, k) => {
      const x = ladder[Math.min(L - 1, Math.round(idx * (L - 1) / 4))];
      ev.push({ t, st: x.st, li: F, deg: x.deg, vel: beats[k] > 1 ? 1.05 : 0.8, voice: vk });
      t += beats[k] * 0.26;
    });
    // Close on the era's chord.
    here.forEach((x, k) => { ev.push({ t: t + k * 0.05, st: x.st, li: F, deg: x.deg, vel: 0.85, voice: vk }); });
    return { ev, lay, dur: t + 2.4 };
  }
  function markPlayLayer(li, rest) {
    playLayer = li; playRest = !!rest;
    paintNow(li);
    layerLabels.forEach((l) => { const on = l.layer === li; l.el.classList.toggle('is-playing', on); l.el.classList.toggle('is-rest', on && !!rest); });
    todayLabel.classList.toggle('is-playing', li === N);
  }
  function startPlay() {
    const F = state.focus;
    const c = compose(F);
    if (!c.ev.length) return;
    if (!soundOn) { soundOn = true; try { localStorage.setItem('mmStringSound', '1'); } catch (e) {} paintSound(); }
    unlockAudio();
    const ac = audioCtx(), audio = !!(ac && master);
    const t0 = (audio ? ac.currentTime : performance.now() / 1000) + 0.15;
    const srcs = [];
    c.ev.forEach((e) => { e.at = t0 + e.t; if (audio) srcs.push(...stringSound(e.deg, e.vel, panOf(e.st), e.at, e.voice)); });
    c.lay.forEach((l) => { l.at = t0 + l.t; });
    play = { audio, ev: c.ev, lay: c.lay, i: 0, j: 0, end: t0 + c.dur, srcs, focus: F };
    hint.classList.add('is-gone');
    paintPlay();
  }
  function stopPlay() {
    if (!play) return;
    play.srcs.forEach((s0) => { try { s0.stop(); } catch (e) {} });
    play = null;
    markPlayLayer(-1);
    paintPlay();
  }
  function tickPlay() {
    if (!play) return;
    const c = play.audio ? actx.currentTime : performance.now() / 1000;
    while (play.j < play.lay.length && play.lay[play.j].at <= c + 0.01) { const l = play.lay[play.j++]; markPlayLayer(l.li, l.rest); }
    while (play.i < play.ev.length && play.ev[play.i].at <= c + 0.01) {
      const e = play.ev[play.i++];
      if (e.st) pluck(e.st, e.vel, 0, { li: e.li, scheduled: true });
    }
    if (c > play.end) stopPlay();
  }
  function segCross(p, q, a, b) {
    const d = (q.x - p.x) * (b.y - a.y) - (q.y - p.y) * (b.x - a.x);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((a.x - p.x) * (b.y - a.y) - (a.y - p.y) * (b.x - a.x)) / d;
    const u = ((a.x - p.x) * (q.y - p.y) - (a.y - p.y) * (q.x - p.x)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
  function stringEnds(st) {
    const m = museums[st.m];
    return [screenOf(m.x, st.y0, m.z), screenOf(m.x, st.y0 - st.len, m.z)];
  }
  // A pointer moving from p0 to p1 plucks every string it crosses (a strum).
  function strum(p0, p1, strength) {
    if (state.focus >= 0 || !strings.length || !stringMesh.visible) return;
    strings.forEach((st) => {
      if (st.k <= 0.01) return;
      const e = stringEnds(st);
      if (e[0].z > 1 || e[1].z > 1) return;
      if (segCross(p0, p1, e[0], e[1])) pluck(st, strength, (p0.x + p1.x) / 2);
    });
  }
  // A tap near a string plucks it.
  function nearestString(p, r) {
    let best = null, bd = r * r;
    strings.forEach((st) => {
      if (st.k <= 0.01) return;
      const e = stringEnds(st), a = e[0], b = e[1];
      if (a.z > 1 || b.z > 1) return;
      const vx = b.x - a.x, vy = b.y - a.y, L = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L));
      const dx = a.x + vx * t - p.x, dy = a.y + vy * t - p.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = st; }
    });
    return best;
  }

  // ── HTML labels ──
  const overlay = el('div', 'strata-overlay'); container.appendChild(overlay);
  // Layer labels form a time ruler down the left edge; their height tracks the layer centre.
  const anchorX = 0, anchorZ = 0;
  const layerLabels = layers.map((L) => {
    const b = el('button', 'strata-label');
    b.type = 'button';
    b.appendChild(el('span', 'sl-name', L.name));
    b.appendChild(el('span', 'sl-period', L.period));
    // How many of your seals sit on this stratum (empty when you have none here).
    const count = el('span', 'sl-count'); b.appendChild(count);
    const era = ERA[L.id];
    b.appendChild(el('span', 'sl-inst', era ? era.inst : VOICES.ks.name));
    b.addEventListener('click', (e) => { e.stopPropagation(); cb.onDynasty && cb.onDynasty(L.id); });
    overlay.appendChild(b);
    return { el: b, count, v: new THREE.Vector3(anchorX, L.y, anchorZ), layer: L.i };
  });
  const todayLabel = el('button', 'strata-label is-today');
  todayLabel.type = 'button';
  todayLabel.appendChild(el('span', 'sl-name', '今'));
  todayLabel.appendChild(el('span', 'sl-period', museums.length + ' 座博物馆'));
  todayLabel.appendChild(el('span', 'sl-inst', VOICES.ks.name));
  todayLabel.addEventListener('click', (e) => { e.stopPropagation(); cb.onDynasty && cb.onDynasty(null); });
  overlay.appendChild(todayLabel);
  const todayAnchor = new THREE.Vector3(anchorX, yTop, anchorZ);
  const siteLabels = sites.map((s) => {
    const t = el('div', 'strata-site' + (s.s.role === 'culture' ? ' is-culture' : ''), s.s.name);
    overlay.appendChild(t);
    // Capitals claim space first when labels compete (平城/邺/洛阳 sit close together).
    const rank = s.s.role === 'capital' ? 0 : s.s.role === 'secondary' ? 1 : 2;
    return { el: t, v: new THREE.Vector3(s.x, yOf(s.layer), s.z), layer: s.layer, rank, w: 0, h: 0, slot: 0 };
  });
  const hoverTag = el('div', 'strata-tag'); overlay.appendChild(hoverTag);
  const selTag = el('div', 'strata-tag is-selected'); overlay.appendChild(selTag);
  // Reading a stratum: your seals (cinnabar) and nearby candidates (dashed gilt) are named
  // where their beams land on it. Created on first use, one per museum.
  const mTags = {};
  function mTag(i) {
    let t = mTags[i];
    if (!t) {
      const b = el('button', 'strata-mtag'); b.type = 'button';
      b.addEventListener('click', (e) => { e.stopPropagation(); cb.onMuseum && cb.onMuseum(museums[i].id); });
      overlay.appendChild(b);
      t = mTags[i] = { el: b, w: 0, h: 0, slot: 0, key: '' };
    }
    return t;
  }
  // Label boxes are measured once; re-measure after the web fonts swap in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      siteLabels.forEach((s) => { s.w = 0; });
      hoverTag._idx = selTag._idx = -1;
      S.needs = true;
    });
  }
  const hint = el('div', 'strata-hint', '拖动旋转 · 双指缩放 · 点地层看朝代 · 点光点看博物馆'); overlay.appendChild(hint);
  const soundBtn = el('button', 'strata-sound');
  soundBtn.type = 'button';
  const paintSound = () => {
    soundBtn.classList.toggle('is-off', !soundOn);
    soundBtn.setAttribute('aria-label', soundOn ? '琴弦声音：开' : '琴弦声音：关');
    soundBtn.title = soundOn ? '琴弦声音：开' : '琴弦声音：关';
    soundBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/>' +
      (soundOn ? '<path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="m16 9.5 5 5"/><path d="m21 9.5-5 5"/>') + '</svg>';
  };
  soundBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    soundOn = !soundOn;
    try { localStorage.setItem('mmStringSound', soundOn ? '1' : '0'); } catch (err) {}
    paintSound();
    if (soundOn) { unlockAudio(); const st = strings[Math.floor(strings.length / 2)]; if (st) pluck(st, 0.8, canvas.clientWidth / 2); }
    else stopPlay();
  });
  overlay.appendChild(soundBtn);
  const playBtn = el('button', 'strata-play');
  playBtn.type = 'button';
  function paintPlay() {
    const F = state.focus, n = F >= 0 ? stringsAt(F).length : strings.length;
    overlay.classList.add('can-play');
    playBtn.classList.toggle('is-playing', !!play);
    const icon = play
      ? '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
    const verb = n > 0 ? '奏' : '听';
    const label = play ? '停' : F >= 0 ? verb + ' · ' + layers[F].name : verb + '一曲';
    playBtn.innerHTML = icon + '<span>' + label + '</span>';
    playBtn.setAttribute('aria-label', play ? '停止演奏'
      : F >= 0 ? (n > 0 ? '用这一层的琴弦奏一段' : '听这一层的乐器；在这里集章，你的琴弦会加入')
      : (n > 0 ? '用你的琴弦，从远古奏到今天' : '听二十个朝代的乐器；集章之后，你的琴弦会加入'));
  }
  playBtn.addEventListener('click', (e) => { e.stopPropagation(); if (play) stopPlay(); else startPlay(); });
  overlay.appendChild(playBtn);
  // 此声取自: the object behind this era's sound, one tap from its museum.
  const nowCap = el('button', 'strata-now');
  nowCap.type = 'button';
  let nowMuseum = null;
  function paintNow(li) {
    nowMuseum = null;
    if (li < 0) { nowCap.classList.remove('is-on'); return; }
    let html;
    if (li === N) html = '<b>今</b><span>你的琴弦</span>';
    else {
      const e = eraOf(li), name = layers[li].name;
      if (!e) html = '<b>' + esc(name) + '</b>';
      else if (!e.src) html = '<b>' + esc(e.inst) + '</b><span>' + esc(name) + ' · 示意，馆藏里还没找到实物</span>';
      else {
        const m = museums.find((x) => x.id === e.src.museumId);
        nowMuseum = m ? m.id : null;
        html = '<b>' + esc(e.inst) + '</b><span><em class="nc-from">此声取自 · </em>' + esc(e.src.artifact) + (m ? '<em class="nc-museum"> · ' + esc(m.name) + '</em>' : '') + '</span>' + (m ? '<i aria-hidden="true">›</i>' : '');
        nowCap.setAttribute('aria-label', e.inst + '，此声取自' + e.src.artifact + (m ? '，' + m.name + '，点按查看这座馆' : ''));
      }
    }
    nowCap.innerHTML = html;
    nowCap.classList.toggle('has-link', !!nowMuseum);
    nowCap.classList.add('is-on');
  }
  nowCap.addEventListener('click', (e) => { e.stopPropagation(); if (nowMuseum && cb.onMuseum) cb.onMuseum(nowMuseum); });
  overlay.appendChild(nowCap);
  // A real gesture anywhere unlocks audio for later strums (iOS needs touchend/click).
  const onGesture = () => { if (strings.length) { unlockAudio(); document.removeEventListener('touchend', onGesture); document.removeEventListener('click', onGesture); } };
  document.addEventListener('touchend', onGesture, { passive: true });
  document.addEventListener('click', onGesture);

  // ── Territories: each stratum shows its own dynasty's extent ──
  // Fetched (shared with the 2D map, cached forever); until then strata show today's outline.
  const partLabels = [];   // { el, v, layer }
  // Reading view's title block (bottom-left, above the dock / sheet): era, year shown, source.
  const credit = el('div', 'strata-credit'); overlay.appendChild(credit);
  // The time ruler hides while reading one era; this leads back to the whole stack.
  const back = el('button', 'strata-back');
  back.type = 'button';
  back.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg><span>全部<span class="sb-more">地层</span></span>';
  back.addEventListener('click', (e) => { e.stopPropagation(); cb.onDynasty && cb.onDynasty(null); });
  overlay.appendChild(back);
  let themeName = data.theme || 'night';
  function addTerritory(L, parts, meta) {
    const rings = [];
    parts.forEach((p) => p.r.forEach((r) => rings.push(r)));
    if (!rings.length) return;
    const segs = [];
    rings.forEach((r) => { for (let i = 0; i < r.length - 1; i++) segs.push(px(r[i][0]), 0, pz(r[i][1]), px(r[i + 1][0]), 0, pz(r[i + 1][1])); });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
    L.tFill = new THREE.Mesh(mergedFill(rings, 0), new THREE.MeshBasicMaterial({ color: COL.fill, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    L.tLine = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: COL.line, transparent: true, opacity: 0, depthWrite: false }));
    L.tFill.renderOrder = 1; L.tLine.renderOrder = 2;
    L.group.add(L.tFill, L.tLine);
    L.terr = Object.assign({ box: bboxOf(rings) }, meta);
    // Divided eras name each regime (曹魏 / 蜀汉 / 孙吴 …) at its largest ring.
    if (parts.length > 1 && meta.label) {
      parts.forEach((p) => {
        let best = null, ba = 0;
        p.r.forEach((r) => { const a = ringArea(r); if (a > ba) { ba = a; best = r; } });
        if (!best) return;
        const c = ringCentroid(best);
        const t = el('div', 'strata-part', p.n); t.style.visibility = 'hidden';
        overlay.insertBefore(t, overlay.firstChild);
        partLabels.push({ el: t, v: new THREE.Vector3(px(c[0]), L.y, pz(c[1])), layer: L.i });
      });
    }
  }
  function buildTerritories(T) {
    layers.forEach((L) => {
      const t = T && T[L.id];
      if (t && t.p && t.p.length) { addTerritory(L, t.p, { year: t.y, sketch: !!t.sketch, label: true }); return; }
      // No polity (远古): culture circles around the Neolithic sites — 满天星斗.
      const g = data.geo[L.id];
      const cult = g ? g.sites.filter((s) => s.role === 'culture') : [];
      if (cult.length) addTerritory(L, cult.map((s) => ({ n: s.name, r: [circleRing(s.lng, s.lat, 1.15)] })), { culture: true, label: false });
    });
    applyTheme(themeName);
    if (state.focus >= 0) { showCredit(); applyFocus(false); }
  }
  if (data.territoryUrl && window.fetch) {
    fetch(data.territoryUrl).then((r) => r.ok ? r.json() : null).then((T) => { if (T) buildTerritories(T); }).catch(() => {});
  }
  function yearText(y) { return y < 0 ? '公元前' + (-y) + '年' : '公元' + y + '年'; }
  function showCredit() {
    const L = state.focus >= 0 ? layers[state.focus] : null;
    if (!L) { credit.classList.remove('is-on'); return; }
    const t = L.terr;
    credit.innerHTML = '';
    const name = el('div', 'sc-name');
    name.appendChild(el('span', null, L.name));
    name.appendChild(el('small', null, L.period));
    credit.appendChild(name);
    if (t) {
      credit.appendChild(el('b', null, t.culture ? '新石器文化分布 · 示意' : t.sketch ? '二里头文化核心区 · 示意' : '约' + yearText(t.year) + '的疆域 · 示意'));
      if (!t.culture && !t.sketch) credit.appendChild(el('span', null, '据 Cliopatria（Seshat）· CC BY 4.0'));
    }
    credit.classList.add('is-on');
  }
  // Top of the title block, in canvas pixels — the reading view frames the map above it.
  function titleTop() { return credit.classList.contains('is-on') ? credit.offsetTop : ch; }

  // The focused stratum's own capital moves (汴梁 → 临安 …), drawn on the layer itself.
  const focusMat = new THREE.MeshBasicMaterial({ color: COL.giltHi, transparent: true, opacity: 0, depthWrite: false });
  const focusDash = new THREE.LineDashedMaterial({ color: COL.gilt, transparent: true, opacity: 0, dashSize: 0.04, gapSize: 0.03, depthWrite: false });
  const focusGroup = new THREE.Group(); world.add(focusGroup);
  function buildFocusPath(F) {
    focusGroup.children.slice().forEach((c) => { focusGroup.remove(c); if (c.geometry) c.geometry.dispose(); });
    if (F < 0) return;
    const g = data.geo[layers[F].id]; if (!g) return;
    const y = yOf(F) + 0.004;
    const pt = (s) => new THREE.Vector3(px(s.lng), y, pz(s.lat));
    if (g.trail.length > 1) {
      const path = new THREE.CurvePath();
      for (let j = 0; j < g.trail.length - 1; j++) path.add(new THREE.LineCurve3(pt(g.sites[g.trail[j]]), pt(g.sites[g.trail[j + 1]])));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 24 * (g.trail.length - 1), 0.013, 6, false), focusMat);
      tube.renderOrder = 9; focusGroup.add(tube);
      // Arrowhead at the last capital, pointing along the move.
      const a = pt(g.sites[g.trail[g.trail.length - 2]]), b = pt(g.sites[g.trail[g.trail.length - 1]]);
      const dir = b.clone().sub(a).normalize();
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 12), focusMat);
      cone.position.copy(b).addScaledVector(dir, -0.05);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cone.renderOrder = 9; focusGroup.add(cone);
    }
    const dash = [];
    (g.chains || []).forEach((ch) => { for (let j = 0; j < ch.length - 1; j++) { const a = pt(g.sites[ch[j]]), b = pt(g.sites[ch[j + 1]]); dash.push(a.x, a.y, a.z, b.x, b.y, b.z); } });
    if (dash.length) {
      const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dash), 3));
      const dl = new THREE.LineSegments(dg, focusDash); dl.computeLineDistances(); dl.renderOrder = 9; focusGroup.add(dl);
    }
  }

  // ── Camera ──
  // ox / oy shift the projection (px) so the scene centres in what stays visible; they ease
  // like the rest of the camera, so opening a sheet or entering a reading view glides.
  const cam = { az: -0.5, el: 0.52, dist: 12, tx: 0, ty: H * 0.46, tz: 0, ox: 0, oy: 0 };
  const to = Object.assign({}, cam);
  let baseDist = 12, insetBottom = 0, insetRight = 0, ys = 1, fovV = 0.3, fovH = 0.3, halfTan = 0.3, cw = 1, ch = 1;
  let viewOX = NaN, viewOY = NaN;
  function setOffset(x, y) {
    if (Math.abs(x - viewOX) < 0.05 && Math.abs(y - viewOY) < 0.05) return;
    viewOX = x; viewOY = y;
    if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) camera.clearViewOffset();
    else camera.setViewOffset(cw, ch, x, y, cw, ch);
    camera.updateProjectionMatrix();
  }
  function fit(snap) {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    cw = w; ch = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    halfTan = Math.tan(camera.fov * DEG / 2);
    const vh = Math.max(1, h - insetBottom), vw = Math.max(1, w - insetRight);
    // Tall phone screens get taller strata: time takes the vertical room the map can't use.
    ys = vw / vh < 0.8 ? 1.55 : 1;
    world.scale.y = ys;
    const vf = Math.atan(halfTan * vh / h), hf = Math.atan(halfTan * vw / h);
    fovV = vf; fovH = hf;
    // Wide screens frame the stack height-first; a touch further back keeps today's surface
    // clear of the view switch.
    baseDist = Math.max(3.0 / Math.sin(vf), 3.0 / Math.sin(hf)) * (ys > 1 ? 0.84 : 0.9);
    applyFocus(snap !== false);
    viewOX = NaN; setOffset(cam.ox, cam.oy);
  }

  const state = { mode: 'all', dynastyId: null, visited: {}, cand: {}, selectedId: null, focus: -1, sel: -1, hl: -1, mine: false };
  function applyFocus(instant) {
    const sel = state.sel >= 0 ? museums[state.sel] : null;
    const covered = insetBottom > 0 || insetRight > 0;
    to.ox = insetRight / 2; to.oy = insetBottom / 2;
    if (state.focus >= 0) {
      // Read the era like a map: north up, nearly top-down, framed on that dynasty's extent
      // in the band between the view switch and the title block (itself above dock / sheet).
      const L = layers[state.focus];
      const b = (L.terr && L.terr.box) || chinaBox;
      const bandTop = 52, bandBottom = Math.max(insetBottom, ch - titleTop()) + 4;
      const fV = Math.atan(halfTan * Math.max(90, ch - bandTop - bandBottom) / ch);
      to.oy = (bandBottom - bandTop) / 2;
      const halfW = Math.max(0.85, (b.x1 - b.x0) / 2), halfD = Math.max(0.65, (b.z1 - b.z0) / 2);
      const elv = 1.16;
      const dW = halfW / Math.tan(fovH), dD = (halfD * Math.sin(elv) + 0.1) / Math.tan(fV);
      to.tx = (b.x0 + b.x1) / 2; to.tz = (b.z0 + b.z1) / 2; to.ty = L.y * ys;
      to.el = elv; to.dist = Math.max(dW, dD) * 1.1;
      to.az = Math.round(cam.az / (Math.PI * 2)) * Math.PI * 2;
    } else if (sel) {
      const lowest = sel.links.length ? yOf(sel.links[sel.links.length - 1]) : yTop;
      to.tx = sel.x * 0.6; to.tz = sel.z * 0.6; to.ty = (yTop + lowest) / 2 * ys;
      to.dist = baseDist * (covered ? 0.92 : 0.82); to.el = 0.46;
    } else {
      to.tx = 0; to.tz = 0; to.ty = H * (ys > 1 ? 0.46 : 0.5) * ys; to.dist = baseDist; to.el = ys > 1 ? 0.42 : 0.52;
    }
    if (instant) Object.assign(cam, { dist: to.dist, tx: to.tx, ty: to.ty, tz: to.tz, el: to.el, ox: to.ox, oy: to.oy });
    S.needs = true;
  }

  // ── Colour state ──
  function setTint(arr, karr, i, c, k) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; karr[i] = k; }
  function setBeam(i, c, k) {
    const o = i * 4;
    if (PAL.ink) { bCol[o] = c.r; bCol[o + 1] = c.g; bCol[o + 2] = c.b; bCol[o + 3] = Math.min(1, k * 1.5); }
    else { bCol[o] = c.r * k; bCol[o + 1] = c.g * k; bCol[o + 2] = c.b * k; bCol[o + 3] = 1; }
  }
  function recolor() {
    const F = state.focus, mode = state.mode, visited = state.visited, selId = state.selectedId, cand = state.cand;
    const fp = mode === 'footprint';
    // Once you hold seals your footprint leads; the capital trail steps back to a faint line.
    const nVisited = Object.keys(visited).length;
    const mine = nVisited > 0 && mode !== 'dynasty';
    state.mine = mine;
    const H = F < 0 ? state.hl : -1;   // ledger hover: preview one museum's beam
    const linkedToFocus = (m) => F >= 0 && m.links.indexOf(F) >= 0;
    // In a dynasty's reading view the camera looks down onto its stratum, so museums are
    // shown where their beams land on it (dots) — points up on today's surface would
    // parallax away from the map underneath.
    museums.forEach((m, i) => {
      const v = !!visited[m.id], c = cand[m.id] != null, sel = m.id === selId;
      let col = COL.bone, k = m.major ? 0.85 : 0.6, size = m.major ? 15 : 11;
      if (PAL.ink) k *= 0.7;
      if (fp) { if (v) { col = COL.seal; k = 1.15; size = 17; } else if (c) { col = COL.gilt; k = 0.95; size = 13; } else { k = 0.08; } }
      else if (F >= 0) { k = sel && !linkedToFocus(m) ? 1.2 : 0; }
      else if (v) { col = COL.seal; k = 1.15; size = m.major ? 17 : 15; }
      else if (mine) k *= 0.45;
      if (H >= 0 && i !== H) k *= 0.3;
      if (sel && F < 0) { col = COL.giltHi; k = 1.5; size = 26; }
      else if (sel) { col = COL.giltHi; size = 22; }
      setTint(mTint, mK, i, col, k); mSize[i] = size;
    });
    mGeom.attributes.tint.needsUpdate = true; mGeom.attributes.kk.needsUpdate = true; mGeom.attributes.size.needsUpdate = true;

    segs.forEach((s, i) => {
      const m = museums[s.m], v = !!visited[m.id], c = cand[m.id] != null, sel = m.id === selId;
      let col = COL.bone, k = mine ? 0.022 : 0.075;
      if (fp) { if (v) { col = COL.seal; k = 0.6; } else if (c) { col = COL.gilt; k = 0.45; } else k = 0; }
      else if (F >= 0) { if (m.links.indexOf(F) >= 0 && s.lo >= F) { col = v ? COL.seal : COL.gilt; k = PAL.ink ? 0.07 : 0.16; } else k = 0; }
      else if (v) { col = COL.seal; k = 0.5; }
      if (H >= 0) { if (s.m === H) { k = Math.max(k, 0.9); if (!v && !c) col = COL.giltHi; } else k *= 0.2; }
      if (sel && F < 0) { col = COL.giltHi; k = 0.95; }
      // Outside the reading view your beams are drawn as strings instead.
      const st = F < 0 && v ? stringByM[s.m] : null;
      if (st) { st.col = col; st.k = k; st.dirty = true; k = 0; }
      setBeam(i * 2, col, k); setBeam(i * 2 + 1, col, k * 0.55);
    });
    bGeom.attributes.color.needsUpdate = true;
    stringMesh.visible = F < 0;
    if (F >= 0) {
      // Reading one era: strings rest, dots go back to their places.
      dPos.set(dPosBase); dGeom.attributes.position.needsUpdate = true;
    }

    dots.forEach((d, i) => {
      const m = museums[d.m], v = !!visited[m.id], c = cand[m.id] != null, sel = m.id === selId;
      let col = COL.bone, k = d.onSite ? 0.55 : 0.16, size = d.onSite ? 12 : 6;
      if (d.onSite) col = COL.giltHi;
      if (mine && !v) k *= 0.5;
      if (fp) {
        if (v) { col = COL.seal; k = 1.1; size = d.onSite ? 15 : 11; }
        else if (c) { col = COL.gilt; k = 1.0; size = d.onSite ? 13 : 10; }
        else k = 0;
      } else if (F >= 0) {
        if (d.layer === F && m.links.indexOf(F) >= 0) {
          col = v ? COL.seal : (d.onSite ? COL.giltHi : COL.gilt);
          k = v ? 1.3 : d.onSite ? 1.4 : 1.05; size = d.onSite ? (v ? 20 : 22) : (v ? 16 : 14);
        } else k = 0;
      } else if (v) { col = COL.seal; k = 1.0; size = d.onSite ? 13 : 10; }
      // Your on-site dots wear a seal ring.
      let rk = v && d.onSite && k > 0 ? Math.min(1.1, k) : 0;
      if (H >= 0) {
        if (d.m === H) { k = Math.max(k, 1.4); size = Math.max(size, d.onSite ? 20 : 17); if (!v && !c) col = COL.giltHi; }
        else { k *= 0.2; rk *= 0.2; }
      }
      if (sel && (F < 0 || d.layer === F)) { col = COL.giltHi; k = d.onSite ? 1.6 : 1.3; size = d.onSite ? 24 : 18; rk = 0; }
      setTint(dTint, dK, i, col, k); dSize[i] = size;
      setTint(rTint, rK, i, COL.seal, rk); rSize[i] = size * 1.7;
    });
    dKBase.set(dK); dSizeBase.set(dSize);
    dGeom.attributes.tint.needsUpdate = true; dGeom.attributes.kk.needsUpdate = true; dGeom.attributes.size.needsUpdate = true;
    rGeom.attributes.tint.needsUpdate = true; rGeom.attributes.kk.needsUpdate = true; rGeom.attributes.size.needsUpdate = true;

    sites.forEach((s, i) => {
      let c = s.s.role === 'culture' ? COL.patina : COL.gilt;
      let k = s.trail || s.s.role === 'culture' ? 0.75 : 0.45, size = s.s.role === 'capital' ? 14 : 10;
      if (F >= 0) { if (s.layer === F) { c = s.s.role === 'culture' ? COL.patina : COL.giltHi; k = 1.35; size = 22; } else k *= 0.12; }
      if (fp) k *= 0.3; else if (mine) k *= 0.6;
      setTint(siteTint, siteK, i, c, k); siteSize[i] = size;
    });
    siteGeom.attributes.tint.needsUpdate = true; siteGeom.attributes.kk.needsUpdate = true; siteGeom.attributes.size.needsUpdate = true;

    // How many of your seals each stratum holds (ruler count; 集章 mode keeps those strata drawn).
    const depth = {};
    museums.forEach((m) => { if (visited[m.id]) m.links.forEach((li) => { depth[li] = (depth[li] || 0) + 1; }); });
    // A stratum with its own territory draws that (o/f); today's outline (g = ghost) only
    // returns, faintly, under the stratum you are reading. Strata without one fall back to
    // today's outline.
    const lk = (x) => Math.min(1, x * PAL.lineK), fk = (x) => Math.min(1, x * PAL.fillK);
    layers.forEach((L) => {
      const own = !!L.tLine, dep = depth[L.i] || 0;
      let o = own ? 0.2 : 0.11, f = own ? 0.035 : 0.022, r = 0.06, g = 0;
      if (F >= 0) {
        if (L.i === F) { o = own ? 0.85 : 0.62; f = own ? 0.13 : 0.11; r = 0.55; g = own ? 0.16 : 0; }
        else { o = 0.025; f = 0.004; r = 0; }
      }
      // 集章: strata you have reached stay drawn, the rest recede (no red wash — 20/20 said nothing).
      if (fp) { o = dep ? (own ? 0.34 : 0.22) : 0.05; f = dep ? (own ? 0.05 : 0.035) : 0.006; r = dep ? 0.1 : 0.02; g = 0; }
      if (own) L.to = { tLine: lk(o), tFill: fk(f), outline: lk(g), fill: 0, river: lk(r) };
      else L.to = { tLine: 0, tFill: 0, outline: lk(o), fill: fk(f), river: lk(r) };
      (L.tFill || L.fill).material.color.copy(COL.fill);
      const lab = layerLabels[L.i];
      lab.el.classList.toggle('is-active', L.i === F);
      // Hovering a seal in the ledger lights the strata its beam passes through.
      const hl = H >= 0 && museums[H].links.indexOf(L.i) >= 0;
      lab.el.classList.toggle('is-dim', (F >= 0 && L.i !== F) || (H >= 0 && !hl));
      lab.el.classList.toggle('is-hl', hl);
      lab.el.classList.toggle('has-visit', dep > 0);
      lab.el.classList.toggle('is-empty', fp && !dep);
      lab.count.textContent = dep ? String(dep) : '';
    });
    top.to = { outline: lk(F >= 0 ? 0.05 : 0.5), fill: fk(F >= 0 ? 0.006 : 0.045), river: lk(F >= 0 ? 0.03 : 0.28), tLine: 0, tFill: 0 };
    // Seen from above, the other eras' trail would lie across the map being read.
    tube.material.opacity = fp ? 0.1 : F >= 0 ? (PAL.ink ? 0.035 : 0.07) : mine ? (PAL.ink ? 0.24 : 0.3) : 0.95;
    tubeGlow.material.opacity = fp ? 0 : F >= 0 ? 0.015 : mine ? 0.03 : 0.13;
    chains.material.opacity = F >= 0 ? 0.04 : fp ? 0.05 : mine ? 0.12 : 0.32;
    focusMat.opacity = F >= 0 ? 0.95 : 0;
    focusDash.opacity = F >= 0 ? 0.7 : 0;
    S.needs = true;
  }

  function update(next) {
    const prevFocus = state.focus, prevSel = state.sel;
    state.mode = next.mode || 'all';
    state.dynastyId = next.dynastyId || null;
    state.visited = {}; (next.visitedIds || []).forEach((id) => { state.visited[id] = true; });
    state.cand = {}; (next.candidates || []).forEach((c) => { if (c && c.id != null) state.cand[c.id] = c.km || 0; });
    state.selectedId = next.selectedId || null;
    state.focus = state.mode === 'dynasty' && state.dynastyId != null && layerIndexById[state.dynastyId] != null ? layerIndexById[state.dynastyId] : -1;
    state.sel = state.selectedId != null && museumIdx[state.selectedId] != null ? museumIdx[state.selectedId] : -1;
    buildStrings();
    if (prevFocus !== state.focus) {
      stopPlay(); paintPlay();
      buildFocusPath(state.focus); showCredit();
      overlay.classList.toggle('is-focus', state.focus >= 0);
      if (state.focus >= 0) hint.classList.add('is-gone');
    }
    recolor();
    if (prevFocus !== state.focus || prevSel !== state.sel) applyFocus(false);
  }
  // Where a museum sits in the current view: on the stratum being read, else on today's surface.
  function museumY(i) {
    const F = state.focus;
    return F >= 0 && museums[i].links.indexOf(F) >= 0 ? yOf(F) : yTop;
  }

  // ── Interaction ──
  const canvas = renderer.domElement;
  const pointers = new Map();
  let drag = null, pinch = null, lastInteract = 0, hoverIdx = -1;
  const v3 = new THREE.Vector3();
  function screenOf(x, y, z) {
    v3.set(x, y, z).applyMatrix4(world.matrixWorld).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v3.y * 0.5 + 0.5) * canvas.clientHeight, z: v3.z };
  }
  function pickMuseum(cx, cy, radius) {
    let best = -1, bd = radius * radius;
    museums.forEach((m, i) => {
      if (state.mode === 'footprint' && !state.visited[m.id]) return;
      if (state.focus >= 0 && m.links.indexOf(state.focus) < 0 && m.id !== state.selectedId) return;
      const p = screenOf(m.x, museumY(i), m.z); if (p.z > 1) return;
      const dx = p.x - cx, dy = p.y - cy, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function localXY(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localXY(e));
    lastInteract = performance.now(); hint.classList.add('is-gone');
    if (pointers.size === 1) { const p = localXY(e); drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: false }; }
    if (pointers.size === 2) { const ps = Array.from(pointers.values()); pinch = { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), dist: to.dist }; drag = null; }
  });
  let lastPtr = null;
  canvas.addEventListener('pointerdown', () => { if (soundOn && strings.length) audioCtx(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlay(); });
  canvas.addEventListener('pointermove', (e) => {
    const p = localXY(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    const nowP = performance.now(), lp = lastPtr;
    lastPtr = { x: p.x, y: p.y, t: nowP };
    if (lp && nowP - lp.t < 120 && pointers.size < 2) {
      const speed = Math.hypot(p.x - lp.x, p.y - lp.y) / Math.max(8, nowP - lp.t);
      strum(lp, p, Math.min(1.3, 0.35 + speed * 0.9) * (e.pointerType === 'mouse' && !e.buttons ? 0.6 : 1));
    }
    if (pinch && pointers.size === 2) {
      const ps = Array.from(pointers.values());
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      to.dist = Math.max(baseDist * 0.35, Math.min(baseDist * 1.8, pinch.dist * pinch.d / Math.max(1, d)));
      lastInteract = performance.now(); S.needs = true; return;
    }
    if (drag) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 6) drag.moved = true;
      to.az -= dx * 0.0065; to.el = Math.max(0.1, Math.min(1.35, to.el + dy * 0.004));
      cam.az = to.az;
      drag.x = p.x; drag.y = p.y; lastInteract = performance.now(); S.needs = true;
      return;
    }
    if (e.pointerType === 'mouse') {
      const i = pickMuseum(p.x, p.y, 14);
      // A just-plucked string keeps its name up for a moment.
      if (i !== hoverIdx && (i >= 0 || nowP > tagHoldUntil)) { hoverIdx = i; canvas.style.cursor = i >= 0 ? 'pointer' : 'grab'; S.needs = true; }
    }
  });
  function end(e) {
    const wasDrag = drag;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
    if (wasDrag && !wasDrag.moved && performance.now() - wasDrag.t < 400) {
      const p = localXY(e);
      const i = pickMuseum(p.x, p.y, e.pointerType === 'mouse' ? 16 : 28);
      if (i >= 0 && cb.onMuseum) cb.onMuseum(museums[i].id);
      else if (i < 0 && state.focus < 0) {
        const st = nearestString(p, e.pointerType === 'mouse' ? 12 : 22);
        if (st) pluck(st, 1.1, p.x);
      }
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { lastPtr = null; if (hoverIdx >= 0 && performance.now() > tagHoldUntil) { hoverIdx = -1; S.needs = true; } });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    to.dist = Math.max(baseDist * 0.35, Math.min(baseDist * 1.8, to.dist * Math.exp(e.deltaY * 0.0012)));
    lastInteract = performance.now(); S.needs = true;
  }, { passive: false });

  // ── Labels per frame ──
  function placeLabels() {
    const h = canvas.clientHeight;
    const RX = 10;
    const order = layerLabels.slice().sort((a, b) => b.layer - a.layer);
    // Reading one era, the ruler fades out (CSS .is-focus) and the title block names the era;
    // labels keep tracking their strata so they fade back in place.
    const tp = screenOf(todayAnchor.x, todayAnchor.y, todayAnchor.z);
    todayLabel.style.transform = 'translate3d(' + RX + 'px,' + tp.y.toFixed(1) + 'px,0) translate(0,-50%)';
    let lastY = tp.y;
    // The focused layer always shows; the rest give way so labels never overlap.
    const focusY = state.focus >= 0 ? screenOf(0, layers[state.focus].y, 0).y : null;
    order.forEach((lab) => {
      const p = screenOf(lab.v.x, lab.v.y, lab.v.z);
      const active = lab.layer === state.focus;
      const clearOfFocus = focusY == null || active || Math.abs(p.y - focusY) > 16;
      const visible = p.z < 1 && p.y > 4 && p.y < h - 4 && clearOfFocus && (active || Math.abs(p.y - lastY) > 15);
      lab.el.style.visibility = visible ? 'visible' : 'hidden';
      if (visible) { lab.el.style.transform = 'translate3d(' + RX + 'px,' + p.y.toFixed(1) + 'px,0) translate(0,-50%)'; lastY = p.y; }
    });
    // Site labels on the focused layer: each tries above / below / beside its point and
    // takes the first spot clear of labels already placed; one with no room hides (its
    // point still glows). Trying last frame's spot first keeps them from flickering.
    const placed = [];
    const focusSites = [];
    siteLabels.forEach((s) => {
      if (state.focus >= 0 && s.layer === state.focus) focusSites.push(s);
      else s.el.style.visibility = 'hidden';
    });
    focusSites.sort((a, b) => a.rank - b.rank);
    // Regime names (曹魏 / 蜀汉 / 孙吴 …) sit under everything else, centred on their land.
    partLabels.forEach((t) => {
      const show = state.focus >= 0 && t.layer === state.focus;
      t.el.style.visibility = show ? 'visible' : 'hidden';
      if (show) { const p = screenOf(t.v.x, t.v.y, t.v.z); t.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) translate(-50%,-50%)'; }
    });
    // Each label tries spots around its point and takes the first clear of those placed.
    function place(s, p) {
      const g = 7, w = s.w, hh = s.h;
      // Near spots first, then a ring further out so crowded capitals still get named.
      const slots = [[-w / 2, -hh - g], [-w / 2, g], [g + 2, -hh / 2], [-w - g - 2, -hh / 2],
        [g * 0.4, -hh - g], [-w - g * 0.4, -hh - g], [g * 0.4, g], [-w - g * 0.4, g],
        [-w / 2, -hh * 2 - g * 2], [-w / 2, hh + g * 2], [g * 4, -hh / 2], [-w - g * 4, -hh / 2],
        [g * 2, -hh * 2 - g], [-w - g * 2, -hh * 2 - g], [g * 2, hh + g], [-w - g * 2, hh + g]];
      const order = [s.slot].concat(slots.map((_, i) => i).filter((i) => i !== s.slot));
      let hit = null;
      for (const i of order) {
        const r = { x: p.x + slots[i][0], y: p.y + slots[i][1] };
        if (!placed.some((q) => r.x < q.x + q.w + 3 && q.x < r.x + w + 3 && r.y < q.y + q.h + 2 && q.y < r.y + hh + 2)) {
          hit = r; s.slot = i; break;
        }
      }
      if (!hit || p.z >= 1) { s.el.style.visibility = 'hidden'; return false; }
      put(s, hit);
      return true;
    }
    function clear(r, w, hh) { return !placed.some((q) => r.x < q.x + q.w + 3 && q.x < r.x + w + 3 && r.y < q.y + q.h + 2 && q.y < r.y + hh + 2); }
    function put(s, r) {
      placed.push({ x: r.x, y: r.y, w: s.w, h: s.h });
      s.el.style.visibility = 'visible';
      s.el.style.transform = 'translate3d(' + r.x.toFixed(1) + 'px,' + r.y.toFixed(1) + 'px,0)';
    }
    // Seals on (nearly) the same spot — 汉魏洛阳 and 龙门 — stack into a column off the first one.
    const stacks = [];   // { px, py, top, bottom, x }
    function placeMine(t, p) {
      const near = stacks.find((k) => Math.abs(k.px - p.x) < 34 && Math.abs(k.py - p.y) < 34);
      if (near) {
        const below = { x: near.x, y: near.bottom + 2 }, above = { x: near.x, y: near.top - t.h - 2 };
        if (clear(below, t.w, t.h)) { put(t, below); near.bottom = below.y + t.h; return true; }
        if (clear(above, t.w, t.h)) { put(t, above); near.top = above.y; return true; }
      }
      if (!place(t, p)) return false;
      const q = placed[placed.length - 1];
      stacks.push({ px: p.x, py: p.y, x: q.x, top: q.y, bottom: q.y + q.h });
      return true;
    }
    const placeSite = (s) => {
      if (!s.w) { s.w = s.el.offsetWidth; s.h = s.el.offsetHeight; }
      place(s, screenOf(s.v.x, s.v.y, s.v.z));
    };
    // Room goes to capitals first, then your seals, then other sites, then nearby candidates.
    focusSites.filter((s) => s.rank === 0).forEach(placeSite);
    const shown = {};
    const later = [];
    if (state.focus >= 0) {
      const F = state.focus, list = [];
      museums.forEach((m, i) => {
        if (i === state.sel || m.links.indexOf(F) < 0) return;
        const v = !!state.visited[m.id], km = state.cand[m.id];
        if (!v && km == null) return;
        list.push({ i, v, on: !!m.onSite[F], km: km == null ? 0 : km });
      });
      list.sort((a, b) => (b.v - a.v) || (b.on - a.on) || (a.km - b.km));
      list.forEach((x) => {
        const t = mTag(x.i), m = museums[x.i];
        const key = (x.v ? 'v' : 'c') + (x.on ? 'o' : '') + Math.round(x.km);
        if (t.key !== key) {
          t.key = key; t.w = 0;
          t.el.className = 'strata-mtag ' + (x.v ? 'is-mine' : 'is-cand') + (x.on ? ' is-onsite' : '');
          t.el.textContent = x.v ? m.seal : m.seal + ' · ' + (x.km < 10 ? x.km.toFixed(1) : Math.round(x.km)) + 'km';
          t.el.title = m.name;
        }
        if (!t.w) { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; }
        const go = () => { const p = screenOf(m.x, yOf(F), m.z); if (x.v ? placeMine(t, p) : place(t, p)) shown[x.i] = true; };
        if (x.v) go(); else later.push(go);
      });
    }
    focusSites.filter((s) => s.rank !== 0).forEach(placeSite);
    later.forEach((go) => go());
    Object.keys(mTags).forEach((k) => { if (!shown[k]) mTags[k].el.style.visibility = 'hidden'; });
    function tag(node, idx) {
      if (idx < 0) { node.style.visibility = 'hidden'; return; }
      const m = museums[idx], p = screenOf(m.x, museumY(idx), m.z);
      if (node._idx !== idx) {
        node._idx = idx; node.textContent = m.name;
        node._w = node.offsetWidth; node._h = node.offsetHeight;
      }
      // Sits just above the beam's top; kept clear of the view switch (top ~56px) and
      // the canvas edges when the camera frames the stack high or the beam is near a side.
      const w = canvas.clientWidth, hw = (node._w || 0) / 2 + 8;
      const x = Math.max(hw, Math.min(w - hw, p.x));
      const y = Math.max(56 + (node._h || 0) * 1.7, p.y);
      node.style.visibility = p.z < 1 ? 'visible' : 'hidden';
      node.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-170%)';
    }
    tag(selTag, state.sel);
    tag(hoverTag, hoverIdx >= 0 && hoverIdx !== state.sel ? hoverIdx : -1);
  }

  // ── Loop ──
  let active = true, last = performance.now(), intro = 0;
  const lerp = (a, b, k) => a + (b - a) * k;
  function lerpMat(mat, target, k) { mat.opacity = lerp(mat.opacity, target, k); }
  function frame(now) {
    S.raf = requestAnimationFrame(frame);
    if (!active || document.hidden) { last = now; return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const idle = now - lastInteract > 5000 && state.sel < 0 && state.focus < 0;
    if (idle) to.az += dt * 0.035 * Math.cos(now / 9000);
    const k = 1 - Math.pow(0.0015, dt);
    cam.az = lerp(cam.az, to.az, k); cam.el = lerp(cam.el, to.el, k); cam.dist = lerp(cam.dist, to.dist, k);
    cam.tx = lerp(cam.tx, to.tx, k); cam.ty = lerp(cam.ty, to.ty, k); cam.tz = lerp(cam.tz, to.tz, k);
    cam.ox = lerp(cam.ox, to.ox, k); cam.oy = lerp(cam.oy, to.oy, k); setOffset(cam.ox, cam.oy);
    camera.position.set(cam.tx + cam.dist * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);

    intro = Math.min(1, intro + dt / 2.2);
    const ka = 1 - Math.pow(0.002, dt);
    layers.forEach((L) => {
      const appear = Math.max(0, Math.min(1, intro * 1.6 - (L.i / N) * 0.75));
      // The era being played lights up.
      const pf = play && playLayer === L.i ? (playRest ? 1.5 : 2.6) : 1;
      lerpMat(L.outline.material, Math.min(1, L.to.outline * appear * pf), ka); lerpMat(L.fill.material, Math.min(1, L.to.fill * appear * pf), ka); lerpMat(L.river.material, L.to.river * appear, ka);
      if (L.tLine) { lerpMat(L.tLine.material, Math.min(1, L.to.tLine * appear * pf), ka); lerpMat(L.tFill.material, Math.min(1, L.to.tFill * appear * pf), ka); }
    });
    const ta = Math.max(0, intro * 1.6 - 0.6);
    lerpMat(top.outline.material, top.to.outline * Math.min(1, ta), ka); lerpMat(top.fill.material, top.to.fill * Math.min(1, ta), ka); lerpMat(top.river.material, top.to.river * Math.min(1, ta), ka);
    const grow = Math.min(1, intro * 1.25);
    tube.geometry.setDrawRange(0, Math.floor(tubeIndexCount * grow / 3) * 3);
    tubeGlow.geometry.setDrawRange(0, Math.floor(glowIndexCount * grow / 3) * 3);
    pulses.forEach((sp, i) => {
      const t = ((now / 1000) * 0.045 + i / pulses.length) % 1;
      if (t > grow) { sp.visible = false; return; }
      sp.visible = state.mode !== 'footprint' && state.focus < 0 && !state.mine;
      sp.position.copy(curve.getPointAt(t));
      const s = 0.12 + 0.05 * Math.sin(now / 300 + i);
      sp.scale.set(s, s, s);
    });

    tickPlay();
    if (strings.length) {
      let moved = false;
      strings.forEach((st) => { if (st.dirty || st.live) { writeString(st, now); st.dirty = false; moved = true; } });
      if (moved) {
        sGeom.attributes.position.needsUpdate = true; sGeom.attributes.color.needsUpdate = true;
        dGeom.attributes.position.needsUpdate = true; dGeom.attributes.kk.needsUpdate = true; dGeom.attributes.size.needsUpdate = true;
      }
      if (hoverIdx >= 0 && now > tagHoldUntil && tagHoldUntil > 0 && !pointers.size) { tagHoldUntil = 0; if (!lastPtr) hoverIdx = -1; }
    }
    renderer.render(scene, camera);
    placeLabels();
  }

  // ── Hall (theme): palette + light-vs-ink blending ──
  function applyTheme(name) {
    themeName = name || 'night';
    loadPalette(themeName);
    // Dark halls add light to the colour only, leaving the canvas alpha alone. Plain additive
    // blending also adds alpha, so on this transparent canvas a switched-off (black) beam or
    // point would composite as an opaque black line over the hall's background (青绿 showed it).
    [sitePoints, mPoints, dPoints, rPoints, tube, tubeGlow, chains, beams, stringMesh].concat(pulses).forEach((o) => {
      const m = o.material;
      if (PAL.ink) { m.blending = THREE.NormalBlending; return; }
      m.blending = THREE.CustomBlending;
      m.blendEquation = THREE.AddEquation; m.blendEquationAlpha = THREE.AddEquation;
      m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneFactor;
      m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
    });
    [sitePoints, mPoints, dPoints, rPoints].forEach((p) => { p.material.uniforms.ink.value = PAL.ink ? 1 : 0; });
    layers.concat([top]).forEach((L) => {
      L.outline.material.color.copy(COL.line); L.river.material.color.copy(COL.river);
      if (L.tLine) L.tLine.material.color.copy(COL.line);
    });
    top.fill.material.color.copy(COL.line);
    tube.material.color.copy(COL.gilt); tubeGlow.material.color.copy(COL.gilt); chains.material.color.copy(COL.gilt);
    pulses.forEach((p) => p.material.color.copy(COL.giltHi));
    focusMat.color.copy(COL.giltHi); focusDash.color.copy(COL.gilt);
    recolor();
  }

  paintSound(); paintPlay();
  const ro = new ResizeObserver(() => fit(true));
  ro.observe(container);
  fit(true);
  applyTheme(data.theme || 'night');
  S.raf = requestAnimationFrame(frame);

  Object.assign(S, {
    ready: true,
    update,
    setActive(on) { active = !!on; if (on) { last = performance.now(); fit(true); } else stopPlay(); },
    resize: () => fit(true),
    setTheme: applyTheme,
    // Preview one museum's beam through its strata (ledger hover); null clears.
    highlight(id) {
      const i = id != null && museumIdx[id] != null ? museumIdx[id] : -1;
      if (i === state.hl) return;
      state.hl = i; hoverIdx = i; recolor();
    },
    setInset(bottom, right) {
      const b = Math.max(0, Math.round(bottom || 0)), r = Math.max(0, Math.round(right || 0));
      if (b === insetBottom && r === insetRight) return;
      insetBottom = b; insetRight = r;
      // A bottom sheet already names the era — the title block keeps only year + source, above it.
      credit.style.bottom = b > 0 ? (b + 10) + 'px' : '';
      credit.classList.toggle('is-sheet', b > 0);
      fit(false);
    },
  });
  return true;
}

window.MuseumStrata = {
  init(container, data, cb) { try { return init(container, data, cb || {}); } catch (e) { console.error('[strata] init failed', e); return false; } },
  update(next) { if (S.ready) S.update(next); },
  setActive(on) { if (S.ready) S.setActive(on); },
  resize() { if (S.ready) S.resize(); },
  /** Pixels of the view covered by a sheet (bottom) or side drawer (right). */
  setInset(bottom, right) { if (S.ready) S.setInset(bottom, right); },
  /** Preview one museum's beam (id) or clear (null). */
  highlight(id) { if (S.ready) S.highlight(id); },
  /** 'night' | 'paper' | 'qinglu' */
  setTheme(name) { if (S.ready) S.setTheme(name); },
};
window.dispatchEvent(new Event('strata-ready'));
`
