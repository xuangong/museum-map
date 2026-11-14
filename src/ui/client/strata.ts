import { CHINA_GEO_JSON } from "./geo-data"
import { ERA_VOICES } from "../../data/era-voices"
import { ERA_TUNES } from "../../data/era-tunes"

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
// The room every note plays into: a soft top-end roll-off, a dark hall, a gentle limiter.
// Built per context so a performance can also be rendered offline (renderTune).
function makeGraph(ac) {
  const m = ac.createGain(); m.gain.value = 1.1;
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 6500; tone.Q.value = 0.5;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  m.connect(tone); tone.connect(comp); comp.connect(ac.destination);
  try {
    const sr = ac.sampleRate, n = Math.floor(sr * 2.6), ir = ac.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { lp = lp * 0.55 + (Math.random() * 2 - 1) * 0.45; d[i] = lp * Math.pow(1 - i / n, 2.6); }
    }
    const conv = ac.createConvolver(); conv.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.3;
    tone.connect(conv); conv.connect(wet); wet.connect(comp);
  } catch (e) {}
  return m;
}
function audioCtx() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { actx = new AC(); master = makeGraph(actx); } catch (e) { actx = null; return null; }
  }
  if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
  return actx;
}
function ksBuffer(ac, freq, lpk, decay) {
  lpk = lpk == null ? 0.4 : lpk; decay = decay || 2.4;
  const key = Math.round(freq * 10) + ':' + lpk + ':' + decay + ':' + ac.sampleRate;
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
// 今 is your own strings. All synthesized and kept in a warm middle register:
//   pluck: Karplus–Strong [brightness, seconds to fade]
//   bell:  struck partials [ratio, level, seconds] — near-harmonic, so a melody stays clear
//   h:     blown/bowed tone (harmonic levels), shaped to the note's length, through a low-pass
//          at lp × pitch, with a little breath and a late vibrato [rate, depth, delay]
// Era → instrument and the museum object it is drawn from (src/data/era-voices.ts).
const ERA = ${JSON.stringify(ERA_VOICES)};
// Era → the famous pieces it is remembered by (src/data/era-tunes.ts), named while it plays.
const TUNES = ${JSON.stringify(ERA_TUNES)};
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const VOICES = {
  ks: { name: '你的琴弦', g: 1.15, pluck: [0.4, 2.4] },
  zhu: { g: 1.25, pluck: [0.22, 0.9], click: 0.08 },
  se: { g: 1.15, pluck: [0.38, 2.2] },
  pipa: { g: 1.15, pluck: [0.16, 1.2] },
  qing: { g: 0.62, bell: [[1, 1, 1.2], [2.76, 0.18, 0.4], [5.4, 0.05, 0.2]], click: 0.05 },
  tongqing: { g: 0.6, bell: [[1, 1, 1.6], [2, 0.28, 0.8], [3, 0.1, 0.5]], click: 0.04 },
  nao: { g: 0.6, bell: [[1, 1, 0.9], [2, 0.32, 0.5], [3.01, 0.12, 0.3]], click: 0.06 },
  zhong: { g: 0.58, bell: [[0.5, 0.22, 1.8], [1, 1, 1.5], [2, 0.28, 0.8], [3, 0.1, 0.5]], click: 0.04 },
  tonggu: { g: 0.8, oct: 0.5, bell: [[1, 1, 0.55], [1.5, 0.25, 0.3], [2, 0.15, 0.2]], click: 0.1 },
  qin: { g: 0.62, bell: [[1, 1, 2.4], [2, 0.32, 1.6], [3, 0.13, 1], [4, 0.05, 0.7]], click: 0.03, vib: [5, 0.004, 0.45] },
  gudi: { g: 0.5, h: [1, 0.12, 0.04], a: 0.05, rel: 0.25, lp: 5, breath: 0.07, vib: [5, 0.004, 0.35] },
  paixiao: { g: 0.5, h: [1, 0.06, 0.12, 0.02], a: 0.06, rel: 0.3, lp: 4, breath: 0.09 },
  di: { g: 0.46, h: [1, 0.3, 0.12, 0.05], a: 0.04, rel: 0.22, lp: 6, breath: 0.05, vib: [5.6, 0.005, 0.25] },
  guan: { g: 0.36, h: [1, 0.6, 0.45, 0.3, 0.2, 0.12], a: 0.05, rel: 0.2, lp: 3, breath: 0.02, vib: [5, 0.007, 0.25] },
  huqin: { g: 0.4, h: [1, 0.5, 0.33, 0.25, 0.18, 0.12, 0.08], a: 0.1, rel: 0.25, lp: 3.5, vib: [5.5, 0.007, 0.18] },
  // Underneath: a soft bass line, one root per bar.
  bass: { g: 0.62, h: [1, 0.35, 0.1], a: 0.08, rel: 0.5, lp: 2.5 },
};
const waveCache = new WeakMap();
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
function burst(ac, out, freq, when, len, srcs, envFn) {
  const n = ac.createBufferSource(); n.buffer = noise(ac); n.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.min(8000, freq); bp.Q.value = 1.4;
  const g = ac.createGain();
  envFn(g.gain);
  n.connect(bp); bp.connect(g); g.connect(out);
  n.start(when, Math.random() * 0.5); n.stop(when + len + 0.05); srcs.push(n);
}
// One note at pentatonic degree 'deg' (or o.freq Hz) on voice 'vk', starting at AudioContext
// time 'when'. o.dur shapes held notes; o.ac / o.dest render somewhere other than the live room.
// Returns the sources it started, so a performance can be cut short.
function stringSound(deg, vel, pan, when, vk, o) {
  o = o || {};
  const ac = o.ac || audioCtx(), dest = o.dest || master;
  if (!ac || !dest) return [];
  const V = VOICES[vk] || VOICES.ks, srcs = [];
  try {
    const t = Math.max(when || 0, ac.currentTime), f = (o.freq || degFreq(deg)) * (V.oct || 1) * (o.mul || 1) * (o.semi ? Math.pow(2, o.semi / 12) : 1), dur = o.dur || 0.5;
    const out = ac.createGain(); out.gain.value = 0.34 * V.g * Math.max(0.15, Math.min(1.3, vel));
    if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = Math.max(-0.7, Math.min(0.7, pan || 0)); out.connect(pn); pn.connect(dest); }
    else out.connect(dest);
    if (V.pluck) {
      const src = ac.createBufferSource();
      src.buffer = ksBuffer(ac, f, V.pluck[0], V.pluck[1]);
      src.connect(out); src.start(t); srcs.push(src);
    } else if (V.bell) {
      // Struck: each partial rings and dies on its own; quick notes ring shorter.
      V.bell.forEach(([r, a, dec]) => {
        const fr = f * r; if (fr > 8000) return;
        const d = Math.min(dec, 0.35 + dur * 1.6);
        const osc = ac.createOscillator(), g = ac.createGain();
        osc.frequency.value = fr;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.006); g.gain.setTargetAtTime(0, t + 0.006, d / 4);
        osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + d * 1.5 + 0.1); srcs.push(osc);
        vibrato(ac, osc.frequency, fr, V.vib, t, t + d * 1.5 + 0.1, srcs);
      });
      if (V.click) burst(ac, out, f * 5, t, 0.03, srcs, (gp) => { gp.setValueAtTime(V.click, t); gp.exponentialRampToValueAtTime(0.0001, t + 0.03); });
    } else {
      // Blown or bowed: rises, holds for the note's length, lets go — legato, never piling up.
      const a = Math.min(V.a, dur * 0.5), hold = Math.max(0.04, dur - a - 0.02), rel = V.rel, end = t + a + hold + rel * 3;
      let cache = waveCache.get(ac); if (!cache) { cache = {}; waveCache.set(ac, cache); }
      if (!cache[vk]) { const im = new Float32Array([0].concat(V.h)), re = new Float32Array(im.length); cache[vk] = ac.createPeriodicWave(re, im); }
      const osc = ac.createOscillator(), lpf = ac.createBiquadFilter(), g = ac.createGain();
      osc.setPeriodicWave(cache[vk]); osc.frequency.value = f;
      lpf.type = 'lowpass'; lpf.frequency.value = Math.min(9000, f * V.lp); lpf.Q.value = 0.4;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + a);
      g.gain.linearRampToValueAtTime(0.85, t + a + hold); g.gain.setTargetAtTime(0, t + a + hold, rel / 3);
      osc.connect(lpf); lpf.connect(g); g.connect(out); osc.start(t); osc.stop(end); srcs.push(osc);
      vibrato(ac, osc.frequency, f, V.vib, t, end, srcs);
      if (V.breath) burst(ac, out, f * 2, t, a + hold + rel, srcs, (gp) => {
        gp.setValueAtTime(0, t); gp.linearRampToValueAtTime(V.breath, t + a * 0.7); gp.setTargetAtTime(V.breath * 0.3, t + a, 0.06); gp.setTargetAtTime(0, t + a + hold, rel / 3);
      });
    }
  } catch (e) {}
  return srcs;
}
// 16-bit PCM WAV of a rendered buffer (for listening to a performance outside the page).
function wavBytes(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, data[c][i])); out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Uint8Array(out.buffer);
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
    hint.textContent = strings.length ? '按住红色琴弦拨动 · 拖动旋转 · 右键或双指平移' : '拖动旋转 · 右键或双指平移 · 滚轮缩放 · 点地层看朝代 · 点光点看博物馆';
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

  // ── 奏一曲: your eras play the tune together, the way a 丝竹 ensemble does ──
  // One written pentatonic melody (宫调, G) in five phrases, each starting on the note the last
  // one ended on (鱼咬尾), closing 商 → 宫. The eras you have collected join in time order and
  // play it 支声复调: everyone plays the same tune, each in its own way — the lead ornaments it,
  // 弹拨 picks out its bones an octave down, 拉弦 carries it low and smooth, 吹管 floats a few
  // long notes above (你繁我简，你高我低), 古琴 touches the strong beats, 钟磬 and 鼓 mark where
  // phrases begin and end; when the lead holds a long note a plucked voice slips a short fill
  // in (嵌挡让路). No chords: the ending is everyone landing on 宫 in octaves. One instrument
  // per family at a time (≤ 6 voices). Sound runs on the audio clock; each frame plucks the
  // strings whose notes have started on that clock.
  let play = null, playLayer = -1, playRest = false, playAct = new Set();
  let voy = null;   // 溯洄 in progress (see the 溯洄 section below)
  // Every performance is a new reading of the same score (see vary()); BEAT and rnd belong to it.
  let BEAT = 0.36, rnd = Math.random, perf = { heads: [], lift: [], dyn: [], qpick: {}, mul: 1, semis: 0 };
  function seeded(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  // Alternative openings (换头) for each phrase's first bar: same first note (so the phrase still
  // bites the last one's tail), leading by step into the bar after; the rest of the phrase stays.
  const HEADS = [
    [[[8, 1], [7, 1], [8, 1], [10, 1]], [[8, 1.5], [9, 0.5], [10, 2]]],
    [[[9, 1], [11, 1], [10, 1], [9, 1]], [[9, 2], [10, 1], [11, 1]]],
    [[[10, 1], [9, 1], [8, 1], [7, 1]], [[10, 1.5], [8, 0.5], [9, 1], [7, 1]]],
    [[[10, 2], [12, 1], [13, 1]], [[10, 1.5], [11, 0.5], [12, 2]]],
    [[[9, 1], [10, 1], [9, 1], [8, 1]], [[9, 1.5], [10, 0.5], [9, 1], [8, 1]]],
  ];
  // 五声调式: steps the tune moves along the scale (kept in register), chance, and a touch of pace.
  const MODES = [
    { name: '宫调', shift: 0, upTo: 0.25, pace: 0 },
    { name: '徵调', shift: -2, upTo: 0.5, pace: -0.015 },
    { name: '羽调', shift: -1, upTo: 0.75, pace: 0.02 },
    { name: '商调', shift: 1, upTo: 0.9, pace: 0 },
    { name: '角调', shift: 2, upTo: 1, pace: 0.02 },
  ];
  // Decide this performance: key (whole-tone moves only, so the scale stays the scale), tempo,
  // openings, which phrases lift an octave, the dynamics.
  function vary(seed) {
    rnd = seeded(seed);
    const semis = pick([-2, 0, 0, 2, 3, 5]);
    // 调式: the same pentatonic, a different home note — the written tune is moved along the scale
    // so it rests on that mode's 主音 (its 鱼咬尾 links and closing step move with it).
    const r = rnd(), mode = MODES.find((m) => r < m.upTo) || MODES[0];
    BEAT = 0.33 + rnd() * 0.06 + mode.pace;
    perf = { semis, mul: Math.pow(2, semis / 12), heads: [], lift: [], dyn: [], qpick: {}, seed, mode: mode.name, shift: mode.shift };
    for (let ph = 0; ph < 5; ph++) {
      perf.heads[ph] = Math.floor(rnd() * 3);
      const top = mode.shift + Math.max(...MELODY.slice(ph * 4, ph * 4 + 4).flat().map((n) => n[0]), ...HEADS[ph].flat().map((n) => n[0]));
      perf.lift[ph] = ph < 4 && semis < 3 && top + 5 <= MAX_DEG && rnd() < 0.22;
    }
    perf.dyn = [0.88, 0.94, 1, 1.06, 0.98, 1.04].map((d) => d + (rnd() - 0.5) * 0.06);
  }
  // Bar b as this performance plays it (its opening may be swapped).
  function barMel(b) {
    if (b >= 100) return QUOTE_BARS[b - 100];
    const ph = Math.floor(b / 4), bar = b % 4 === 0 && perf.heads[ph] ? HEADS[ph][perf.heads[ph] - 1] : MELODY[b];
    return perf.shift ? bar.map(([d, bt]) => [d + perf.shift, bt]) : bar;
  }
  // [degree, beats]; degree 5 = G3 (宫) … 13 = D5. Phrase ends → next phrase starts:
  // 9→9, 10→10, 10→10, 9→9 (鱼咬尾); the tune closes A → G (商 → 宫).
  const MELODY = [
    [[8, 2], [9, 1], [10, 1]], [[9, 1.5], [8, 0.5], [7, 1], [8, 1]], [[10, 2], [11, 1], [12, 1]], [[11, 1], [10, 1], [9, 2]],
    [[9, 1], [10, 1], [11, 1.5], [10, 0.5]], [[9, 2], [8, 2]], [[8, 1], [9, 1], [10, 1], [12, 1]], [[11, 3], [10, 1]],
    [[10, 2], [9, 1], [7, 1]], [[8, 1], [7, 1], [6, 2]], [[7, 1], [8, 1], [9, 1], [11, 1]], [[10, 4]],
    [[10, 1], [11, 1], [12, 1], [13, 1]], [[12, 1.5], [11, 0.5], [10, 2]], [[11, 1], [12, 1], [13, 1.5], [12, 0.5]], [[11, 2], [9, 2]],
    [[9, 2], [10, 1], [8, 1]], [[9, 1], [8, 1], [7, 1], [6, 1]], [[7, 1], [8, 1], [7, 1], [6, 1]], [[5, 4]],
  ];
  const G2 = 98;
  // 名曲: when you have collected an era that has one, a phrase of its real tune is woven in
  // (before the closing phrase, in era order), led by that era's instrument where it can carry
  // a melody. Only tunes whose notation we could verify; written in the same G pentatonic.
  //   茉莉花 — 19th-c. 鲜花调, from a public-domain transcription (Wikimedia Commons
  //   File:Maturika.mid, D major → G): 3 35 6 i6 | 5. 6 5 - (sung twice).
  //   阳关三叠 — 琴歌 on 王维's poem, score 据《琴学入门》(1867) as engraved by 国琴网 (1=♭B, ♩=50):
  //   「渭城朝雨浥轻尘，客舍」 6̣. 1 3 2 | 1 2 ↗2 – | 5 6 5; note values doubled to keep its slowness.
  //   霓裳羽衣曲 — the only surviving strain: 姜夔 (1186) found 商调霓裳曲 in an old music book and
  //   noted 中序第一 in 俗字谱 (《白石道人歌曲》卷四); 简谱 as engraved at jianpujia.com (1=F, 4/4,
  //   transcriber not credited). Museum "复原" versions (叶栋 etc.) are modern and not used.
  //   广陵散 — 据《神奇秘谱》(1425) 管平湖打谱 (国琴网 pu/292); 梅花三弄 — 溥雪斋演奏谱 (pu/790);
  //   流水 — 据《天闻阁琴谱》 管平湖演奏谱 (pu/776); all read from engraved 简谱 and checked by eye.
  //   胡笳十八拍 — 据《五知斋谱》吴景略打谱 (国琴网 pu/283); 渔樵问答 — 据《琴学入门》吴景略打谱
  //   许健记谱 (pu/791); 潇湘水云 — 郭楚望曲 查阜西传谱 龚一整理 (爱曲谱 2qupu.com).
  //   阳春白雪 — 琵琶, 卫仲乐演奏谱 (裘春尧、叶绪然整理; cnjpw.net scan), section 一「独占鳌头」, 1=D 2/4.
  //   平沙落雁 — 管平湖演奏谱, 王迪记谱, 据《琴学丛书》 (国琴网, 1=F, ♩=34), section 三:
  //   6 6 5 35 | 656 i | 6i i6 5 35 | 656 i; note values doubled.
  // Each era may hold several; one is chosen per performance.
  const QUOTES = {
    'eastern-han': [{ name: '胡笳十八拍', note: '琴曲 · 据《五知斋谱》（1722），吴景略打谱', bars: [
      // 第一段, 1=♭B ♩=40: 3̇·5̇ | 5̇ 6̇ 6̇5̇ 3̇ | 3̇ 2̇3̇2̇ 1̇·2̇
      [[12, 3], [13, 1]], [[13, 2], [14, 2]], [[14, 1], [13, 1], [12, 2]], [[12, 2], [11, 0.5], [12, 0.5], [11, 1]], [[10, 3], [11, 1]],
    ] }],
    song: [{ name: '潇湘水云', note: '琴曲 · 南宋郭楚望作，查阜西传谱、龚一整理', bars: [
      // 第二段入拍, 1=♭B ♩=42: 5̇·6̇ 5̇6̇5̇6̇ 5̇6̇5̇ 3— | 1̇·2̇ 1̇ (the 3 is the upper note of a 3/3̣ dyad, middle octave)
      [[13, 1.5], [14, 0.5], [13, 0.5], [14, 0.5], [13, 0.5], [14, 0.5]], [[13, 1], [14, 0.5], [13, 0.5], [7, 2]], [[7, 2], [10, 1.5], [11, 0.5]], [[10, 4]],
    ] }],
    'three-kingdoms': [{ name: '广陵散', note: '琴曲 · 据《神奇秘谱》（1425），管平湖打谱', bars: [
      // 开指, 1=C ♩=39, 泛音: 1̇·6 1̇616 | 1̇·2̇ 5·2̇ | 1̇ 1̇ (three bars as engraved, not padded).
      [[10, 1.5], [9, 0.5], [10, 0.5], [9, 0.5], [10, 0.5], [9, 0.5]], [[10, 1.5], [11, 0.5], [8, 1.5], [11, 0.5]], [[10, 2], [10, 2]],
    ] }],
    jin: [{ name: '梅花三弄', note: '琴曲 · 溥雪斋演奏谱，泛音「梅花」主题', bars: [
      // 第二段, 1=F ♩=76, 泛音: 1̇5̇ 5̇ | 5̇. 3̇2̇ | 1̇5̇ 5̇ | 5̇. 3̇2̇
      [[10, 1], [13, 1], [13, 2]], [[13, 3], [12, 0.5], [11, 0.5]], [[10, 1], [13, 1], [13, 2]], [[13, 3], [12, 0.5], [11, 0.5]],
    ] }],
    'eastern-zhou': [{ name: '流水', note: '琴曲（高山流水）· 据《天闻阁琴谱》，管平湖演奏谱', bars: [
      // 第二段, 1=F ♩=72, 泛音: 5̇ 1̇·2̇ 3̇3̇ | 6̇6̇ 6̇5̇⌒| 5̇ 3̇2̇ 1̇ (final 1̇ held to close the bar)
      [[13, 2], [10, 1.5], [11, 0.5]], [[12, 1], [12, 1], [14, 1], [14, 1]], [[14, 1], [13, 2], [12, 0.5], [11, 0.5]], [[10, 4]],
    ] }, { name: '阳春白雪', note: '琵琶曲 · 卫仲乐演奏谱「独占鳌头」', bars: [
      // 1=D 2/4 ♩≈100, eighth notes: 6̣ 3 6̣ 2 | 1 2 1 1 | 5̣ 6̣ 1 3 | 2 2 3 3 (one app beat per ♪).
      [[9, 1], [12, 1], [9, 1], [11, 1]], [[10, 1], [11, 1], [10, 1], [10, 1]], [[8, 1], [9, 1], [10, 1], [12, 1]], [[11, 1], [11, 1], [12, 1], [12, 1]],
    ] }],
    tang: [{ name: '阳关三叠', note: '王维诗谱成的琴歌 · 谱据《琴学入门》', bars: [
      [[9, 1.5], [10, 0.5], [12, 1], [11, 1]], [[10, 2], [11, 2]], [[11, 4]], [[13, 1], [14, 1], [13, 2]],
    ] }, { name: '霓裳羽衣曲', note: '唐大曲残段 · 南宋姜夔记《霓裳中序第一》', bars: [
      // 1=F, 「一帘淡月，仿佛照颜」 3 2 3 5 | 3 4·3 5·6 — the 4 (清角) kept as B + 1 semitone.
      [[7, 2], [6, 2]], [[7, 2], [8, 2]], [[7, 2], [7, 1.5, 1], [7, 0.5]], [[8, 3], [9, 1]],
    ] }],
    ming: [{ name: '平沙落雁', note: '琴曲 · 管平湖演奏谱（王迪记谱）', bars: [
      [[9, 1], [9, 1], [8, 1], [7, 0.5], [8, 0.5]], [[9, 0.5], [8, 0.5], [9, 1], [10, 2]],
      [[9, 0.5], [10, 0.5], [10, 0.5], [9, 0.5], [8, 1], [7, 0.5], [8, 0.5]], [[9, 0.5], [8, 0.5], [9, 1], [10, 2]],
    ] }, { name: '渔樵问答', note: '琴曲 · 据《琴学入门》，吴景略打谱、许健记谱', bars: [
      // 第一段, 1=F 3/4: 3̣ 3̣ 5̣6̣ | 5̣ 6̣ — (low octave; three bars as engraved)
      [[7, 2], [7, 2]], [[8, 1], [9, 1], [8, 2]], [[9, 4]],
    ] }],
    qing: [{ name: '茉莉花', note: '清代江南民歌（鲜花调）', bars: [
      [[7, 1], [7, 0.5], [8, 0.5], [9, 1], [10, 0.5], [9, 0.5]], [[8, 1.5], [9, 0.5], [8, 2]],
      [[7, 1], [7, 0.5], [8, 0.5], [9, 1], [10, 0.5], [9, 0.5]], [[8, 1.5], [9, 0.5], [8, 2]],
    ] }],
  };
  const QUOTE_BARS = [];
  Object.keys(QUOTES).forEach((id) => QUOTES[id].forEach((q) => { q.at = 100 + QUOTE_BARS.length; QUOTE_BARS.push(...q.bars); }));
  // This performance's 名曲 for era li (picked on first ask, from the performance's own dice).
  function quoteOf(li) {
    const qs = li >= 0 && li < N ? QUOTES[layers[li].id] : null;
    if (!qs || !qs.length) return null;
    if (perf.qpick[li] == null) perf.qpick[li] = Math.floor(rnd() * qs.length);
    return qs[perf.qpick[li]];
  }
  const FAMILY = { qing: 'bell', tongqing: 'bell', nao: 'bell', zhong: 'bell', tonggu: 'drum', zhu: 'pluck', se: 'pluck', pipa: 'pluck', qin: 'qin', gudi: 'wind', paixiao: 'wind', di: 'wind', guan: 'wind', huqin: 'bow', ks: 'pluck' };
  const LEADS = ['wind', 'pluck', 'bow', 'qin'];
  function stringsAt(li) { return strings.filter((st) => museums[st.m].links.indexOf(li) >= 0); }
  function eraOf(li) { return li >= 0 && li < N ? ERA[layers[li].id] || null : null; }
  function voiceOf(li) { const e = eraOf(li); return e && VOICES[e.voice] ? e.voice : 'ks'; }
  function famOf(li) { return FAMILY[voiceOf(li)] || 'pluck'; }
  function barOf(li) { return Math.round(li * (MELODY.length - 1) / Math.max(1, N - 1)); }
  function panOf(st) { if (!st) return 0; const m = museums[st.m], p = screenOf(m.x, st.y0, m.z); return (p.x / Math.max(1, canvas.clientWidth)) * 2 - 1; }
  function melodyAt(b, beat) { const m = barMel(b); let p0 = 0; for (const [deg, beats] of m) { if (beat < p0 + beats) return deg; p0 += beats; } return m[0][0]; }
  // A string of era 'li' to pluck with a note (each era's strings take its notes in turn).
  function stringFor(li, k) { const here = li >= 0 ? stringsAt(li) : strings; return here.length ? here[k % here.length] : null; }
  // ── The score grows with what you have collected ──
  // Length: how many eras you have → how many phrases (FORMS); every form ends on the last
  // phrase, so it always comes home to 宫. Parts: one per instrument family (≤ 6 voices).
  // 加花: how many eras share a family, and how many museums you have in an era → how ornate
  // that part plays (1 plain · 2 passing notes / denser rhythm · 3 grace notes / fullest).
  // Ornaments only step to neighbouring pentatonic notes, so nothing new can clash.
  const FORMS = [[4], [0, 4], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 4]];
  function formFor(n) { return FORMS[n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 10 ? 3 : n <= 15 ? 4 : 5]; }
  // The melody of bar b at ornament level lv: [{deg, beats, at, grace}].
  function ornament(b, lv) {
    const src = barMel(b), out = [], last = b === MELODY.length - 1, up = perf.lift[Math.floor(b / 4)] ? 5 : 0;
    let pos = 0;
    src.forEach(([deg, beats, semi], i) => {
      const next = i + 1 < src.length ? src[i + 1][0] : b + 1 < MELODY.length ? barMel(b + 1)[0][0] : deg, gap = next - deg;
      if (!last && !semi && lv >= 3 && i > 0 && beats >= 1 && pos % 1 === 0 && rnd() < 0.55) out.push({ deg: deg + 1 + up, at: pos, grace: true });
      if (!last && lv >= 2 && beats >= 1 && Math.abs(gap) >= 2 && rnd() < 0.75) {
        out.push({ deg: deg + up, beats: beats - 0.5, at: pos, semi });
        out.push({ deg: deg + Math.sign(gap) + up, beats: 0.5, at: pos + beats - 0.5 });
      } else if (!last && beats >= 2 && gap !== 0 && rnd() < 0.12 * lv) {
        // A dotted figure leaning into the next note.
        out.push({ deg: deg + up, beats: beats - 0.5, at: pos, semi });
        out.push({ deg: deg + Math.sign(gap) + up, beats: 0.5, at: pos + beats - 0.5 });
      } else out.push({ deg: deg + up, beats, at: pos, semi });
      pos += beats;
    });
    return out;
  }
  // Bar b: the lead plays the tune at its 加花 level; every other active family plays the same
  // tune its own way at its level (lv: era → 1..3). lead < 0: the tune is on your own strings.
  function ensembleBar(ev, b, t, lead, parts, k0, lv) {
    let k = k0;
    const lvl = (li) => (lv && lv[li]) || 1;
    const ph = Math.floor(b / 4), inPh = b % 4, cad = inPh === 3, last = b === MELODY.length - 1;
    // The bar's bones: [deg, beats, at].
    const skel = [];
    let p0 = 0;
    barMel(b).forEach(([deg, beats, semi]) => { skel.push([deg, beats, p0, semi || 0]); p0 += beats; });
    // A 名曲 may use 偏音 (4, 7): written as a pentatonic degree plus semitones. Any voice doubling
    // that note (same step, any octave) takes the same inflection, so nothing rubs against it.
    const semiAt = (at, deg) => { const n = skel.find(([d, bt, a0]) => at >= a0 && at < a0 + bt); return n && n[3] && (((deg - n[0]) % 5) + 5) % 5 === 0 ? n[3] : 0; };
    const nextOf = (i) => (i + 1 < skel.length ? skel[i + 1][0] : b + 1 < MELODY.length ? barMel(b + 1)[0][0] : skel[i][0]);
    const vk0 = lead >= 0 ? voiceOf(lead) : 'ks';
    ornament(b, lead >= 0 ? lvl(lead) : 1).forEach((n, i) => {
      if (n.grace) { ev.push({ t: t + n.at * BEAT - 0.07, dur: 0.07, deg: n.deg, vel: 0.4, voice: vk0, st: null, li: lead }); return; }
      ev.push({ t: t + n.at * BEAT, dur: n.beats * BEAT, deg: n.deg, semi: n.semi || 0, vel: i === 0 ? 0.95 : 0.85, voice: vk0, st: stringFor(lead, k++), li: lead });
    });
    let filled = false;
    parts.forEach((li) => {
      const vk = voiceOf(li), fam = famOf(li), L = lvl(li);
      const put = (at, beats, deg, vel, pl) => {
        while (deg < 0) deg += 5;
        while (deg > MAX_DEG) deg -= 5;
        ev.push({ t: t + at * BEAT, dur: beats * BEAT, deg, semi: semiAt(at, deg), vel, voice: vk, st: pl ? stringFor(li, k++) : null, li });
      };
      if (fam === 'pluck') {
        // The bones an octave down — strong beats only at first, every note when richer — and,
        // while the lead holds a long note, a short step toward the next one (嵌挡).
        skel.forEach(([deg, beats, at], i) => {
          if (L < 2 && at % 2 !== 0) return;
          put(at, Math.min(beats, 2), deg - 5, i === 0 ? 0.42 : 0.34, i === 0);
          if (L >= 3 && beats >= 2 && !filled && !last) {
            const nx = nextOf(i), dir = Math.sign(nx - deg) || -1;
            put(at + beats - 0.5, 0.5, deg - 5 + dir, 0.26, false);
            filled = true;
          }
        });
      } else if (fam === 'bow') {
        // Low and smooth: the tune an octave down, with passing notes once there is more of it.
        skel.forEach(([deg, beats, at], i) => {
          const nx = nextOf(i), gap = nx - deg;
          if (L >= 2 && beats >= 1 && Math.abs(gap) >= 2 && !last) { put(at, beats - 0.5, deg - 5, 0.3, i === 0); put(at + beats - 0.5, 0.5, deg - 5 + Math.sign(gap), 0.24, false); }
          else put(at, beats, deg - 5, 0.3, i === 0);
        });
      } else if (fam === 'wind') {
        // Above, few and long: the held notes of the tune an octave up (or in place if too high).
        skel.forEach(([deg, beats, at], i) => {
          if (beats < 1 || (L < 2 && i > 0)) return;
          put(at, beats, deg + 5 <= MAX_DEG ? deg + 5 : deg, 0.2, i === 0);
        });
      } else if (fam === 'qin') {
        // Strong beats, low; a harmonic (泛音) where the phrase closes.
        skel.forEach(([deg, beats, at], i) => { if (at === 0 || at === 2 || (L >= 2 && at % 1 === 0)) put(at, Math.max(1, beats), deg - 5, 0.32, at === 0); });
        if (cad) put(2, 2, Math.min(MAX_DEG, skel[skel.length - 1][0] + 5), 0.16, false);
      } else if (fam === 'bell') {
        // Where phrases begin and end.
        if (inPh === 0 || cad || (L >= 2 && inPh === 2)) put(0, 2, skel[0][0], inPh === 0 ? 0.45 : 0.36, true);
      } else if (fam === 'drum') {
        if (inPh === 0) put(0, 0.5, 5, 0.5, true);
        else if (cad) put(0, 0.5, 5, 0.38, true);
        else if (L >= 2) put(0, 0.5, 5, 0.26, false);
        if (L >= 3 && (inPh === 0 || cad)) put(2, 0.5, 5, 0.18, false);
      }
    });
    // The lowest voice follows the bones too (strong beats, an octave below 弹拨).
    skel.forEach(([deg, beats, at, semi]) => { if (at === 0 || at === 2) ev.push({ t: t + at * BEAT, dur: Math.max(1, beats) * BEAT, freq: degFreq(deg) / 2 * Math.pow(2, semi / 12), vel: 0.32, voice: 'bass', st: null, li: -1 }); });
    return k;
  }
  // Who plays in phrase p of P: collected eras join in time order; one voice per family (the
  // newest to join); the lead is the newest 吹/弹/拉/琴 voice, else the 钟磬 (编钟 and 编磬 were
  // melodic instruments), never the drum — with only the drum, your own strings take the tune.
  // 'reprise' (the coda of a full collection): everyone, the oldest melodic voice leads again.
  function lineup(col, p, P, reprise, prevLead) {
    const n = col.length, act = reprise ? col.slice() : col.slice(0, Math.max(1, Math.ceil((p + 1) * n / P)));
    const byFam = {}, famN = {};
    act.forEach((li) => { const f = famOf(li); byFam[f] = li; famN[f] = (famN[f] || 0) + 1; });
    const voices = Object.values(byFam).sort((a, b) => a - b);
    const leadCands = voices.filter((li) => LEADS.indexOf(famOf(li)) >= 0);
    const newest = (xs) => xs.reduce((a, b) => (act.indexOf(b) > act.indexOf(a) ? b : a));
    const oldestLead = col.filter((li) => LEADS.indexOf(famOf(li)) >= 0)[0];
    const bells = voices.filter((li) => famOf(li) === 'bell');
    let lead = leadCands.length ? newest(leadCands) : bells.length ? newest(bells) : -1;
    const others = leadCands.filter((li) => li !== prevLead);
    if (leadCands.length > 1 && (lead === prevLead || rnd() < 0.45) && others.length) lead = pick(others);
    if (reprise && oldestLead != null) lead = oldestLead;
    // 加花 level: eras sharing this family + a second museum in this era.
    const lv = {};
    voices.concat(lead >= 0 ? [lead] : []).forEach((li) => {
      const more = !o_eras && stringsAt(li).length >= 2 ? 1 : 0;
      lv[li] = Math.max(1, Math.min(3, famN[famOf(li)] + more + (reprise ? 1 : 0)));
    });
    return { act, lead, show: lead >= 0 ? lead : act[act.length - 1], parts: voices.filter((li) => li !== lead), lv };
  }
  let o_eras = null;
  // F: era index (reading one era) or -1 (all strata). o.eras: treat these eras as collected
  // (for rendering what other passports would hear).
  function compose(F, o) {
    o = o || {};
    o_eras = o.eras || null;
    vary(o.seed != null ? o.seed : Math.floor(Math.random() * 2147483647));
    if (o.qpick) Object.assign(perf.qpick, o.qpick);   // render a chosen 名曲 (era index → which one)
    const ev = [], lay = [];
    let t = 0, k = 0;
    if (F < 0) {
      const col = (o.eras || [...Array(N).keys()].filter((li) => stringsAt(li).length)).slice().sort((x, y) => x - y);
      const form = formFor(col.length), P = form.length;
      if (!col.length) {
        // Nothing collected yet: one quiet phrase on the strings you will have.
        lay.push({ t: 0, li: -1, rest: true, act: [] });
        for (let b = form[0] * 4; b < form[0] * 4 + 4; b++) { k = ensembleBar(ev, b, t, -1, [], k, null); t += 4 * BEAT; }
        ev.forEach((e) => { if (e.voice === 'ks') e.vel *= 0.6; });
        return { ev, lay, dur: t + 2.4, mul: perf.mul };
      }
      let L = null;
      // The form, with each collected era's 名曲 placed after the phrases of its time (never
      // after the closing phrase — those go just before it).
      const items = form.map((ph, p) => ({ ph, p }));
      // At most four 名曲 per performance — a different handful each time, kept in era order.
      let withQuote = col.filter((li) => QUOTES[layers[li].id]);
      while (withQuote.length > 4) withQuote.splice(Math.floor(rnd() * withQuote.length), 1);
      withQuote.forEach((q) => {
        const band = Math.floor(barOf(q) / 4);
        let at = items.length - 1;
        for (let i = 0; i < items.length - 1; i++) if (items[i].ph != null && items[i].ph <= band) at = i + 1;
        items.splice(Math.min(at, items.length - 1), 0, { q });
      });
      let lastP = 0;
      items.forEach((it) => {
        const from = ev.length;
        if (it.q != null) {
          // The quote: the era's own instrument leads if it carries a tune; otherwise it plays
          // its part and the current lead sings the tune.
          const base = lineup(col, lastP, P, false, L ? L.lead : null), q = it.q;
          const melodic = LEADS.indexOf(famOf(q)) >= 0;
          const parts = base.parts.filter((li) => famOf(li) !== famOf(q) && li !== q);
          let lead = base.lead;
          if (melodic) { if (lead >= 0 && lead !== q) parts.push(lead); lead = q; }
          else parts.push(q);
          const act = base.act.indexOf(q) >= 0 ? base.act : base.act.concat([q]);
          L = { act, lead, parts: parts.filter((li) => li !== lead), lv: base.lv, show: q };
          if (L.lv[q] == null) L.lv[q] = 1;
          lay.push({ t, li: q, act, quote: quoteOf(q) });
          for (let b = quoteOf(q).at; b < quoteOf(q).at + quoteOf(q).bars.length; b++) { k = ensembleBar(ev, b, t, L.lead, L.parts, k, L.lv); t += 4 * BEAT; }
          for (let j = from; j < ev.length; j++) ev[j].vel *= perf.dyn[lastP] || 1;
          return;
        }
        const ph = it.ph, p = it.p, reprise = p === P - 1 && P === 6;
        L = lineup(col, Math.min(p, P - 1), P, reprise, L ? L.lead : null);
        lastP = p;
        lay.push({ t, li: L.show, act: L.act });
        for (let b = ph * 4; b < ph * 4 + 4; b++) { k = ensembleBar(ev, b, t, L.lead, L.parts, k, L.lv); t += 4 * BEAT; }
        for (let j = from; j < ev.length; j++) ev[j].vel *= perf.dyn[p] || 1;
      });
      // 今: everyone lands on the mode's 主音 together, in octaves; your strings answer with it and
      // the note three steps above.
      lay.push({ t, li: N, act: L.act });
      const sh = perf.shift || 0, FINAL = { pluck: 5, bow: 5, qin: 5, wind: 10, bell: 10, drum: 5 };
      (L.lead >= 0 ? [L.lead] : []).concat(L.parts).forEach((li, n) => {
        ev.push({ t: t + n * 0.02, dur: 2.6, deg: (li === L.lead ? 10 : FINAL[famOf(li)]) + sh, vel: famOf(li) === 'drum' ? 0.35 : 0.5, voice: voiceOf(li), st: null, li });
        if (famOf(li) === 'qin') ev.push({ t: t + 0.4, dur: 2.2, deg: Math.min(MAX_DEG, 15 + sh), vel: 0.16, voice: 'qin', st: null, li });
      });
      const order = strings.slice().sort((a, b) => a.note - b.note), close = [5, 8, 10, 13, 15].map((d) => Math.min(MAX_DEG, d + sh));
      const n = Math.max(3, Math.min(close.length, order.length || 3));
      for (let j = 0; j < n; j++) ev.push({ t: t + 0.14 + j * 0.08, dur: 2.5, deg: close[j], vel: 0.7, voice: 'ks', st: order.length ? order[j % order.length] : null, li: -1 });
      ev.push({ t, dur: 3, freq: degFreq(5 + sh) / 4, vel: 0.4, voice: 'bass', st: null, li: -1 });
      ev.sort((a, b) => a.t - b.t);
      return { ev, lay, dur: t + 3.6, mul: perf.mul };
    }
    // One era: its phrase, its instrument leading, the same instrument answering in its family part.
    const here = stringsAt(F), qF = quoteOf(F), b0 = qF ? qF.at : Math.floor(barOf(F) / 4) * 4;
    lay.push({ t: 0, li: F, rest: !here.length, act: [F], quote: qF });
    const drum = famOf(F) === 'drum';
    const lvF = { [F]: Math.max(1, Math.min(3, here.length)) };
    // A 名曲 on a struck instrument: your strings sing it, the era's bronze or stone marks it.
    const tuneOnStrings = drum || (qF && LEADS.indexOf(famOf(F)) < 0);
    for (let b = b0; b < b0 + (qF ? qF.bars.length : 4) && (b < MELODY.length || b >= 100); b++) { k = ensembleBar(ev, b, t, tuneOnStrings ? -1 : F, tuneOnStrings || (b > b0 && famOf(F) !== 'wind') ? [F] : [], k, lvF); t += 4 * BEAT; }
    ev.sort((a, b) => a.t - b.t);
    return { ev, lay, dur: t + 2.4, mul: perf.mul };
  }
  // The same performance rendered offline, as WAV bytes (F: era index, or -1 for all strata).
  // o.noBass leaves out the bass line (for comparing by ear).
  // A thin ensemble (1–3 instruments) would sound quieter than a full one; even it out.
  function balance(c) {
    const n = new Set(c.ev.filter((e) => e.voice !== 'bass').map((e) => e.voice)).size;
    const g = n <= 2 ? 1.45 : n === 3 ? 1.2 : 1;
    if (g !== 1) c.ev.forEach((e) => { e.vel *= g; });
    return c;
  }
  async function renderTune(F, o) {
    o = o || {};
    const c = balance(compose(F == null ? state.focus : F, o)), sr = 44100;
    if (o.noBass) c.ev = c.ev.filter((e) => e.voice !== 'bass');
    // o.stats: just describe the score (notes, distinct instruments, seconds).
    if (o.stats) return { notes: c.ev.filter((e) => e.voice !== 'bass').length, voices: new Set(c.ev.map((e) => e.voice)).size - 1, seconds: Math.round(c.dur), semis: perf.semis, beat: Math.round(BEAT * 1000) / 1000, heads: perf.heads.join(''), lift: perf.lift.map((x) => (x ? 1 : 0)).join(''), mode: perf.mode };
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const oc = new OAC(2, Math.ceil((c.dur + 1) * sr), sr), dest = makeGraph(oc);
    c.ev.forEach((e) => stringSound(e.deg, e.vel, panOf(e.st), 0.1 + e.t, e.voice, { dur: e.dur, freq: e.freq, semi: e.semi, mul: c.mul, ac: oc, dest }));
    return wavBytes(await oc.startRendering());
  }
  // li: the era leading now (N = 今); act: every era playing with it.
  function markPlayLayer(li, rest, act, quote) {
    playLayer = li; playRest = !!rest; playAct = new Set(act || []);
    paintNow(li, quote);
    layerLabels.forEach((l) => {
      const on = l.layer === li;
      l.el.classList.toggle('is-playing', on); l.el.classList.toggle('is-rest', on && !!rest);
      l.el.classList.toggle('is-joined', !on && playAct.has(l.layer));
    });
    todayLabel.classList.toggle('is-playing', li === N);
  }
  function startPlay() {
    voyStop();
    const F = state.focus;
    const c = balance(compose(F));
    if (!c.ev.length) return;
    if (!soundOn) { soundOn = true; try { localStorage.setItem('mmStringSound', '1'); } catch (e) {} paintSound(); }
    unlockAudio();
    const ac = audioCtx(), audio = !!(ac && master);
    const t0 = (audio ? ac.currentTime : performance.now() / 1000) + 0.15;
    const srcs = [];
    c.ev.forEach((e) => { e.at = t0 + e.t; if (audio) srcs.push(...stringSound(e.deg, e.vel, panOf(e.st), e.at, e.voice, { dur: e.dur, freq: e.freq, semi: e.semi, mul: c.mul })); });
    c.lay.forEach((l) => { l.at = t0 + l.t; });
    play = { audio, ev: c.ev, lay: c.lay, i: 0, j: 0, end: t0 + c.dur, srcs, focus: F };
    playTunes = {};
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
    while (play.j < play.lay.length && play.lay[play.j].at <= c + 0.01) { const l = play.lay[play.j++]; markPlayLayer(l.li, l.rest, l.act, l.quote); }
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
    if (state.focus >= 0 || voy || !strings.length || !stringMesh.visible) return;
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
    b.addEventListener('click', (e) => { e.stopPropagation(); if (voy) { voyJump(L.i); return; } cb.onDynasty && cb.onDynasty(L.id); });
    overlay.appendChild(b);
    return { el: b, count, v: new THREE.Vector3(anchorX, L.y, anchorZ), layer: L.i };
  });
  const todayLabel = el('button', 'strata-label is-today');
  todayLabel.type = 'button';
  todayLabel.appendChild(el('span', 'sl-name', '今'));
  todayLabel.appendChild(el('span', 'sl-period', museums.length + ' 座博物馆'));
  todayLabel.appendChild(el('span', 'sl-inst', VOICES.ks.name));
  todayLabel.addEventListener('click', (e) => { e.stopPropagation(); if (voy) { voyJumpTo(0); return; } cb.onDynasty && cb.onDynasty(null); });
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
  const hint = el('div', 'strata-hint', '拖动旋转 · 右键或双指平移 · 滚轮缩放 · 点地层看朝代 · 点光点看博物馆'); overlay.appendChild(hint);
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
    else { stopPlay(); voyStopSound(); }
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
    const label = play ? '停' + (perf.mode ? ' · ' + perf.mode : '') : F >= 0 ? verb + ' · ' + layers[F].name : verb + '一曲';
    playBtn.innerHTML = icon + '<span>' + label + '</span>';
    playBtn.setAttribute('aria-label', play ? '停止演奏'
      : F >= 0 ? (n > 0 ? '用这一层的琴弦奏一段' : '听这一层的乐器；在这里集章，你的琴弦会加入')
      : (n > 0 ? '用你的琴弦，从远古奏到今天' : '听二十个朝代的乐器；集章之后，你的琴弦会加入'));
  }
  playBtn.addEventListener('click', (e) => { e.stopPropagation(); if (play) stopPlay(); else startPlay(); });
  // 奏一曲 and 溯洄 sit side by side under the sound switch.
  const actions = el('div', 'strata-actions');
  actions.appendChild(playBtn); overlay.appendChild(actions);
  // 此声取自: the object behind this era's sound, one tap from its museum.
  const nowCap = el('button', 'strata-now');
  nowCap.type = 'button';
  let nowMuseum = null, playTunes = {};
  function paintNow(li, quote) {
    nowMuseum = null;
    if (li < 0) { nowCap.classList.remove('is-on'); return; }
    let html;
    if (li === N) html = '<b>今</b><span>你的琴弦</span>';
    else if (quote) html = '<b>《' + esc(quote.name) + '》</b><span>' + esc(quote.note) + ' · ' + esc(layers[li].name) + '</span>';
    else {
      const e = eraOf(li), name = layers[li].name;
      if (!e) html = '<b>' + esc(name) + '</b>';
      else if (!e.src) html = '<b>' + esc(e.inst) + '</b><span class="nc-src">' + esc(name) + ' · 示意，馆藏里还没找到实物</span>';
      else {
        const m = museums.find((x) => x.id === e.src.museumId);
        nowMuseum = m ? m.id : null;
        html = '<b>' + esc(e.inst) + '</b><span class="nc-src"><em class="nc-from">此声取自 · </em>' + esc(e.src.artifact) + (m ? '<em class="nc-museum"> · ' + esc(m.name) + '</em>' : '') + '</span>' + (m ? '<i aria-hidden="true">›</i>' : '');
        nowCap.setAttribute('aria-label', e.inst + '，此声取自' + e.src.artifact + (m ? '，' + m.name + '，点按查看这座馆' : ''));
      }
    }
    // The era's 名曲 (one of them, chosen afresh each performance).
    const tunes = li >= 0 && li < N && !quote ? TUNES[layers[li].id] : null;
    let tune = null;
    if (tunes && tunes.length) {
      if (playTunes[li] == null) playTunes[li] = Math.floor(Math.random() * tunes.length);
      tune = tunes[playTunes[li]];
      html += '<span class="nc-tune">♪ 《' + esc(tune.name) + '》 ' + esc(tune.story) + '</span>';
    }
    nowCap.innerHTML = html;
    nowCap.classList.toggle('has-tune', !!tune);
    nowCap.classList.toggle('has-link', !!nowMuseum);
    nowCap.classList.add('is-on');
  }
  nowCap.addEventListener('click', (e) => { e.stopPropagation(); if (nowMuseum && cb.onMuseum) cb.onMuseum(nowMuseum); });
  overlay.appendChild(nowCap);
  // ── 溯洄: from 今 sink through the strata, one layer at a time, down to 新石器 ──
  // A timeline of [{ kind, layer, dwell }]: an opening at 今, one entry per layer (清 → 新石器),
  // and an ending. Each layer lights up and the one above lingers as a ghost; the camera sinks to
  // it and drifts along that dynasty's capital trail; your stamped museums are the anchors (their
  // strings stay, their dot flashes where they pass a layer they link to); the era's instrument
  // plays a short phrase. Weighted dwell, ~72 s in all. Reduced motion: no camera flight, fades only.
  const VOY_BIG = { qin: 1, 'western-han': 1, 'eastern-han': 1, tang: 1, song: 1, ming: 1, qing: 1 };
  const VOY_MINOR = { wudai: 1, 'jin-jurchen': 1, sui: 1 };
  const voyDwell = (id) => VOY_BIG[id] ? 4.5 : VOY_MINOR[id] ? 2.5 : id === 'neolithic' ? 3.5 : 3;
  let voyTL = [];
  function voyBuild() {
    voyTL = [{ kind: 'open', layer: N, dwell: 3 }];
    for (let i = N - 1; i >= 0; i--) voyTL.push({ kind: 'layer', layer: i, dwell: voyDwell(layers[i].id) });
    voyTL.push({ kind: 'end', layer: 0, dwell: 0 });
  }
  const voyCap = el('div', 'strata-voy-cap'); voyCap.setAttribute('aria-live', 'polite'); overlay.appendChild(voyCap);
  const voyBtn = el('button', 'strata-voy-btn');
  voyBtn.type = 'button';
  voyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v13"/><path d="m6.5 12 5.5 5.5 5.5-5.5"/><path d="M5 21h14"/></svg><span>溯洄</span>';
  voyBtn.setAttribute('aria-label', '溯洄：从今天一层层沉到新石器');
  voyBtn.addEventListener('click', (e) => { e.stopPropagation(); voyStart(); });
  const voyCtl = el('div', 'strata-voy-ctl');
  const voyPauseBtn = el('button', 'sv-btn'); voyPauseBtn.type = 'button';
  const voyNextBtn = el('button', 'sv-btn'); voyNextBtn.type = 'button';
  voyNextBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v13"/><path d="m6.5 12 5.5 5.5 5.5-5.5"/></svg><span>下一层</span>';
  voyNextBtn.setAttribute('aria-label', '跳到下一层');
  const voyCloseBtn = el('button', 'sv-btn sv-close'); voyCloseBtn.type = 'button';
  voyCloseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>';
  voyCloseBtn.setAttribute('aria-label', '退出溯洄');
  voyPauseBtn.addEventListener('click', (e) => { e.stopPropagation(); if (!voy) return; if (voy.paused) voyResume(); else voyPause(); });
  voyNextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (!voy) return; voy.paused = false; voyEnterIdx(voy.i + 1); });
  voyCloseBtn.addEventListener('click', (e) => { e.stopPropagation(); voyStop(); });
  voyCtl.appendChild(voyPauseBtn); voyCtl.appendChild(voyNextBtn); voyCtl.appendChild(voyCloseBtn);
  actions.insertBefore(voyBtn, playBtn); actions.appendChild(voyCtl);
  document.addEventListener('keydown', (e) => { if (voy && e.key === 'Escape') voyStop(); });

  function voyPaint() {
    overlay.classList.toggle('is-voyage', !!voy);
    const last = !!voy && voyTL[voy.i].kind === 'end';
    overlay.classList.toggle('is-voy-end', last);
    const paused = !!voy && voy.paused;
    voyPauseBtn.innerHTML = (paused
      ? '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>') + '<span>' + (paused ? '继续' : '暂停') + '</span>';
    voyPauseBtn.setAttribute('aria-label', paused ? '继续溯洄' : '暂停溯洄');
    voyPauseBtn.classList.toggle('is-paused', paused);
  }
  function stampedAt(li) { return museums.filter((m) => state.visited[m.id] && m.links.indexOf(li) >= 0); }
  // 都城 · 长安 → 洛阳 (or the scattered centres of the Neolithic).
  function voyWhere(li) {
    const g = data.geo[layers[li].id];
    if (!g || !g.sites.length) return '';
    if (g.sites.every((s) => s.role === 'culture')) return '满天星斗 · ' + g.sites.slice(0, 4).map((s) => shortName(s.name)).join('、') + (g.sites.length > 4 ? ' 等' : '');
    const names = [];
    g.trail.forEach((k) => { const n = g.sites[k] && shortName(g.sites[k].name); if (n && names.indexOf(n) < 0) names.push(n); });
    return names.length ? '都城 · ' + names.join(' → ') : '';
  }
  function voyCaption(e) {
    voyCap.innerHTML = '';
    voyCap.classList.remove('is-on'); void voyCap.offsetWidth;
    const head = el('div', 'vc-head');
    if (e.kind === 'open') {
      head.appendChild(el('span', 'vc-name', '今'));
      head.appendChild(el('small', null, '溯洄 · 从这里往下'));
      voyCap.appendChild(head);
      voyCap.appendChild(el('div', 'vc-line is-quote', '光阴者，百代之过客'));
      voyCap.appendChild(el('div', 'vc-sub', '—— 李白'));
    } else if (e.kind === 'end') {
      const seen = new Set();
      museums.forEach((m) => { if (state.visited[m.id]) m.links.forEach((li) => seen.add(li)); });
      head.appendChild(el('span', 'vc-name', '新石器'));
      head.appendChild(el('small', null, layers[0].period));
      voyCap.appendChild(head);
      voyCap.appendChild(el('div', 'vc-line is-quote', seen.size ? '百代过客，你走过其中 ' + seen.size + ' 层' : '每一层都还空着——去集第一枚印吧'));
      const row = el('div', 'vc-actions');
      const again = el('button', 'vc-btn', '再溯一次'); again.type = 'button';
      again.addEventListener('click', (ev) => { ev.stopPropagation(); if (voy) { voy.paused = false; voyEnterIdx(0); } });
      const home = el('button', 'vc-btn is-main', '回到今天'); home.type = 'button';
      home.addEventListener('click', (ev) => { ev.stopPropagation(); voyStop(); });
      row.appendChild(again); row.appendChild(home); voyCap.appendChild(row);
    } else {
      const L = layers[e.layer];
      head.appendChild(el('span', 'vc-name', L.name));
      head.appendChild(el('small', null, L.period));
      voyCap.appendChild(head);
      const where = voyWhere(e.layer);
      if (where) voyCap.appendChild(el('div', 'vc-line', where));
      const mine = stampedAt(e.layer);
      if (mine.length) {
        const names = mine.slice(0, 2).map((m) => m.name).join('、');
        voyCap.appendChild(el('div', 'vc-mine', '你在 ' + names + (mine.length > 2 ? ' 等 ' + mine.length + ' 座馆' : '') + ' 见过这一层'));
      }
    }
    voyCap.classList.add('is-on');
  }

  // The capital(s) the camera follows in layer li: its trail, or the middle of the scattered sites.
  function voyTrail(li) {
    const g = data.geo[layers[li].id];
    if (!g || !g.sites.length) return [{ x: 0, z: 0 }];
    if (g.converge || !g.trail.length) {
      let x = 0, z = 0;
      g.sites.forEach((s) => { x += px(s.lng); z += pz(s.lat); });
      return [{ x: x / g.sites.length, z: z / g.sites.length }];
    }
    return g.trail.map((k) => ({ x: px(g.sites[k].lng), z: pz(g.sites[k].lat) }));
  }
  const voyEase = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  function voyCam() {
    if (!voy || reduceMotion) return;
    const e = voyTL[voy.i];
    if (e.kind === 'open') { to.tx = 0; to.tz = 0; to.ty = yTop * ys; to.dist = baseDist * 0.78; to.el = 0.5; to.az = voy.az; return; }
    const pts = voyTrail(e.layer), p = e.dwell ? voy.t / e.dwell : 1;
    let x = pts[0].x, z = pts[0].z;
    if (pts.length > 1) {
      // Glide along the capital moves (迁都) through the middle of the dwell.
      const f = voyEase((p - 0.12) / 0.76) * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), r = f - k;
      x = pts[k].x + (pts[k + 1].x - pts[k].x) * r; z = pts[k].z + (pts[k + 1].z - pts[k].z) * r;
    }
    const end = e.kind === 'end';
    to.tx = x * 0.85; to.tz = z * 0.85; to.ty = layers[e.layer].y * ys;
    to.dist = baseDist * (end ? 0.8 : 0.56); to.el = end ? 0.6 : 0.62; to.az = voy.az;
  }
  function voyTick(dt) {
    if (!voy || voy.paused) return;
    const e = voyTL[voy.i];
    voy.az += dt * 0.03;
    if (e.kind !== 'end') {
      voy.t += dt;
      if (voy.t >= e.dwell) { voyEnterIdx(voy.i + 1); return; }
    }
    voyCam();
    S.needs = true;
  }
  function voyPause() {
    if (!voy || voy.paused) return;
    voy.paused = true; voyPaint();
  }
  function voyResume() {
    if (!voy || !voy.paused) return;
    voy.paused = false; voy.az = to.az; voyPaint();
    voyCam();
  }

  // Your seals flash where they pass a layer they link to (opening: all of them, softly).
  function voyFlashSet(e) {
    const list = [];
    dots.forEach((d, i) => {
      if (!state.visited[museums[d.m].id]) return;
      if (e.kind === 'open' || (e.kind === 'layer' && d.layer === e.layer)) list.push(i);
    });
    voy.flash = list.length ? { list, t0: performance.now(), soft: e.kind === 'open' } : null;
  }
  function voyFlash(now) {
    if (!voy || !voy.flash) return;
    const f = voy.flash, age = (now - f.t0) / 1000, g = Math.exp(-age / 0.9) * (f.soft ? 0.5 : 1) * (1 + 0.5 * Math.cos(age * 7));
    const done = age > 3.2;
    f.list.forEach((di) => { dK[di] = dKBase[di] + (done ? 0 : 1.7 * g); dSize[di] = dSizeBase[di] + (done ? 0 : 14 * g); });
    dGeom.attributes.kk.needsUpdate = true; dGeom.attributes.size.needsUpdate = true;
    if (done) voy.flash = null;
  }

  // ── Sound: the era's instrument, a short phrase on the audio clock ──
  function voyStopSound() {
    if (!voy) return;
    voy.srcs.forEach((s0) => { try { s0.stop(); } catch (e) {} });
    voy.srcs = [];
  }
  function voySound(e) {
    if (!soundOn || !voy) return;
    unlockAudio();
    const ac = audioCtx();
    if (!ac || !master) return;
    const t0 = ac.currentTime + 0.06, B = 0.34, put = (xs) => { voy.srcs.push(...xs); if (voy.srcs.length > 160) voy.srcs.splice(0, 80); };
    if (e.kind === 'open') { put(stringSound(10, 0.45, 0, t0, 'ks', { dur: 1.2 })); return; }
    if (e.kind === 'end') { put(stringSound(5, 0.5, 0, t0, 'ks', { dur: 2 })); put(stringSound(10, 0.4, 0, t0 + 0.12, 'ks', { dur: 2 })); put(stringSound(12, 0.32, 0, t0 + 0.26, 'ks', { dur: 2 })); return; }
    const id = layers[e.layer].id, fam = famOf(e.layer);
    let vk = voiceOf(e.layer);
    // A drum cannot carry a tune: it marks the start, the 琴 sings.
    if (fam === 'drum') { put(stringSound(5, 0.55, 0, t0, vk, { dur: 0.4 })); vk = 'qin'; }
    const qs = QUOTES[id], maxBeats = Math.max(3, (e.dwell - 0.9) / B);
    // The era's 名曲 (verified notation only) — else a bar of the shared melody, in the era's voice.
    const bars = qs && qs.length ? qs[0].bars : [MELODY[e.layer], MELODY[(e.layer + 1) % MELODY.length]];
    const hi = fam === 'wind' ? 99 : 12;
    let pos = 0;
    outer: for (const bar of bars) {
      for (const n of bar) {
        if (pos > 0 && pos + n[1] > maxBeats) break outer;
        const deg = n[0] > hi ? n[0] - 5 : n[0];
        put(stringSound(deg, 0.62, 0, t0 + pos * B, vk, { dur: n[1] * B, semi: n[2] || 0 }));
        pos += n[1];
      }
    }
  }

  // ── Entering an entry of the timeline ──
  function voyEnterIdx(i) {
    if (!voy) return;
    i = Math.max(0, Math.min(voyTL.length - 1, i));
    const e = voyTL[i];
    voy.i = i; voy.t = 0; voy.cur = e.layer;
    buildFocusPath(e.kind === 'open' ? -1 : e.layer);
    layerLabels.forEach((l) => l.el.classList.toggle('is-voy', e.kind !== 'open' && l.layer === e.layer));
    todayLabel.classList.toggle('is-voy', e.kind === 'open');
    recolor();
    voyFlashSet(e);
    voyCaption(e);
    voySound(e);
    voyCam();
    voyPaint();
    S.needs = true;
  }
  function voyJump(li) {
    if (!voy) return;
    const i = voyTL.findIndex((e) => e.kind === 'layer' && e.layer === li);
    voyJumpTo(i);
  }
  function voyJumpTo(i) {
    if (!voy || i < 0) return;
    voy.paused = false; voy.az = to.az;
    voyEnterIdx(i);
  }
  function voyStart() {
    if (state.focus >= 0 || !layers.length) return;
    stopPlay();
    if (voy) voyStopSound();
    voyBuild();
    voy = { i: 0, t: 0, paused: false, cur: N, srcs: [], flash: null, az: to.az };
    hint.classList.add('is-gone');
    if (reduceMotion) applyFocus(false);
    voyEnterIdx(0);
  }
  function voyStop(reset) {
    if (!voy) return;
    voyStopSound();
    voy = null;
    voyCap.classList.remove('is-on');
    layerLabels.forEach((l) => l.el.classList.remove('is-voy'));
    todayLabel.classList.remove('is-voy');
    dK.set(dKBase); dSize.set(dSizeBase);
    dGeom.attributes.kk.needsUpdate = true; dGeom.attributes.size.needsUpdate = true;
    buildFocusPath(state.focus);
    recolor();
    voyPaint();
    if (reset !== false) applyFocus(false);
    S.needs = true;
  }
  voyPaint();

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
    if (state.focus >= 0 && cb.onEraMap) {
      const go = el('button', 'sc-map', '在地图上看 →');
      go.type = 'button';
      go.addEventListener('click', (e) => { e.stopPropagation(); cb.onEraMap(L.id); });
      credit.appendChild(go);
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
      if (voy && !v) k = 0;
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
      } else if (v) { col = COL.seal; k = 1.0; size = 10; }
      if (voy && !v) k *= 0.3;
      if (H >= 0) {
        if (d.m === H) { k = Math.max(k, 1.4); size = Math.max(size, 17); if (!v && !c) col = COL.giltHi; }
        else k *= 0.2;
      }
      if (sel && (F < 0 || d.layer === F)) { col = COL.giltHi; k = 1.3; size = 18; }
      setTint(dTint, dK, i, col, k); dSize[i] = size;
    });
    dKBase.set(dK); dSizeBase.set(dSize);
    dGeom.attributes.tint.needsUpdate = true; dGeom.attributes.kk.needsUpdate = true; dGeom.attributes.size.needsUpdate = true;

    sites.forEach((s, i) => {
      let c = s.s.role === 'culture' ? COL.patina : COL.gilt;
      let k = s.trail || s.s.role === 'culture' ? 0.75 : 0.45, size = s.s.role === 'capital' ? 14 : 10;
      if (F >= 0) { if (s.layer === F) { c = s.s.role === 'culture' ? COL.patina : COL.giltHi; k = 1.35; size = 22; } else k *= 0.12; }
      else if (voy) { if (s.layer === voy.cur) { c = s.s.role === 'culture' ? COL.patina : COL.giltHi; k = 1.35; size = 22; } else k *= s.layer === voy.cur + 1 ? 0.3 : 0.06; }
      if (fp) k *= 0.3; else if (mine && !voy) k *= 0.6;
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
      // 溯洄: the layer being passed is lit; the one just above lingers as a ghost; the rest all but vanish.
      if (voy) {
        if (L.i === voy.cur) { o = own ? 0.85 : 0.62; f = own ? 0.13 : 0.11; r = 0.55; g = own ? 0.16 : 0; }
        else if (L.i === voy.cur + 1) { o = own ? 0.15 : 0.1; f = own ? 0.025 : 0.018; r = 0.05; g = 0; }
        else { o = 0.012; f = 0.002; r = 0; g = 0; }
      }
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
    if (voy) top.to = voy.cur === N ? { outline: lk(0.5), fill: fk(0.045), river: lk(0.28), tLine: 0, tFill: 0 } : voy.cur === N - 1 ? { outline: lk(0.14), fill: fk(0.016), river: lk(0.05), tLine: 0, tFill: 0 } : { outline: 0, fill: 0, river: 0, tLine: 0, tFill: 0 };
    const quiet = F >= 0 || !!voy;
    // Seen from above, the other eras' trail would lie across the map being read.
    tube.material.opacity = fp ? 0.1 : quiet ? (PAL.ink ? 0.035 : 0.07) : mine ? (PAL.ink ? 0.24 : 0.3) : 0.95;
    tubeGlow.material.opacity = fp ? 0 : quiet ? 0.015 : mine ? 0.03 : 0.13;
    chains.material.opacity = quiet ? 0.04 : fp ? 0.05 : mine ? 0.12 : 0.32;
    const showPath = F >= 0 || (voy && voy.cur < N);
    focusMat.opacity = showPath ? 0.95 : 0;
    focusDash.opacity = showPath ? 0.7 : 0;
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
      if (voy) voyStop(false);
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
  // Which era a point in the model means. The strata are stacked bands: once the point is on the
  // model at all (the ray meets some layer), take the layer whose centre sits at that height on
  // screen — like the ruler on the left, but anywhere across the model.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function onModel(p) {
    ndc.set(p.x / canvas.clientWidth * 2 - 1, -(p.y / canvas.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(layers.map((L) => L.tFill || L.fill), false).length > 0;
  }
  function pickLayer(p) {
    // Reading one era, the other strata are faded ghosts: clicking the model shouldn't jump to them.
    if (state.focus >= 0 || voy || !onModel(p)) return null;
    let best = null, bd = Infinity;
    layers.forEach((L) => { const s = screenOf(0, L.y, 0); if (s.z > 1) return; const d = Math.abs(s.y - p.y); if (d < bd) { bd = d; best = L; } });
    return best;
  }
  let pickHover = -1, hoverPickRaf = 0;
  function showPick(L) {
    const i = L ? L.i : -1;
    if (i === pickHover) return;
    if (pickHover >= 0) layerLabels[pickHover].el.classList.remove('is-pick');
    pickHover = i;
    if (i >= 0) layerLabels[i].el.classList.add('is-pick');
  }
  // Pan: slide the view (screen right/left moves across the map, up/down moves through time).
  function panBy(dx, dy) {
    const k = 2 * cam.dist * halfTan / Math.max(1, canvas.clientHeight);
    to.tx -= dx * k * Math.cos(cam.az); to.tz += dx * k * Math.sin(cam.az);
    to.ty += dy * k;
    const lim = 9;
    to.tx = Math.max(-lim, Math.min(lim, to.tx)); to.tz = Math.max(-lim, Math.min(lim, to.tz));
    to.ty = Math.max(-H * ys * 0.2, Math.min(H * ys * 1.3, to.ty));
    cam.tx = to.tx; cam.ty = to.ty; cam.tz = to.tz;
    lastInteract = performance.now(); S.needs = true;
  }
  const MIN_ZOOM = 0.12, MAX_ZOOM = 1.8;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // Lost after panning and zooming? Double-click (double-tap) returns to the framed view.
  let tapTimer = 0;
  canvas.addEventListener('dblclick', (e) => { e.preventDefault(); clearTimeout(tapTimer); if (!voy) applyFocus(false); lastInteract = performance.now(); S.needs = true; });
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, localXY(e));
    lastInteract = performance.now(); hint.classList.add('is-gone');
    if (pointers.size === 1) {
      const p = localXY(e), mouse = e.pointerType === 'mouse';
      // Press a string to play it (drag along to strum); press anywhere else to turn the model.
      // A museum dot wins over a string: tapping it opens the museum.
      let mode = 'turn';
      if (mouse && (e.button === 2 || e.shiftKey)) mode = 'pan';
      else if (state.focus < 0 && !voy && strings.length && pickMuseum(p.x, p.y, mouse ? 16 : 28) < 0) {
        const st = nearestString(p, mouse ? 10 : 20);
        if (st) { mode = 'strum'; if (soundOn) audioCtx(); pluck(st, 1.1, p.x); }
      }
      drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: false, mode: mode };
      canvas.style.cursor = mode === 'pan' ? 'move' : mode === 'strum' ? 'pointer' : 'grabbing';
    }
    if (pointers.size === 2) {
      const ps = Array.from(pointers.values());
      pinch = { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), dist: to.dist, mx: (ps[0].x + ps[1].x) / 2, my: (ps[0].y + ps[1].y) / 2 };
      drag = null;
    }
  });
  let lastPtr = null;
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPlay(); });
  canvas.addEventListener('pointermove', (e) => {
    const p = localXY(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    const nowP = performance.now(), lp = lastPtr;
    lastPtr = { x: p.x, y: p.y, t: nowP };
    if (pinch && pointers.size === 2) {
      if (voy && !voy.paused) voyPause();
      // Two fingers: spread to zoom, move together to pan.
      const ps = Array.from(pointers.values());
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      const mx = (ps[0].x + ps[1].x) / 2, my = (ps[0].y + ps[1].y) / 2;
      to.dist = Math.max(baseDist * MIN_ZOOM, Math.min(baseDist * MAX_ZOOM, pinch.dist * pinch.d / Math.max(1, d)));
      panBy(mx - pinch.mx, my - pinch.my);
      pinch.mx = mx; pinch.my = my;
      return;
    }
    if (drag) {
      const dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 6) drag.moved = true;
      if (drag.moved && voy && !voy.paused) voyPause();
      if (drag.mode === 'strum') {
        if (lp && nowP - lp.t < 120) {
          const speed = Math.hypot(p.x - lp.x, p.y - lp.y) / Math.max(8, nowP - lp.t);
          strum(lp, p, Math.min(1.3, 0.35 + speed * 0.9));
        }
      } else if (drag.mode === 'pan') panBy(dx, dy);
      else {
        to.az -= dx * 0.0065; to.el = Math.max(0.1, Math.min(1.35, to.el + dy * 0.004));
        cam.az = to.az;
      }
      drag.x = p.x; drag.y = p.y; lastInteract = performance.now(); S.needs = true;
      return;
    }
    if (e.pointerType === 'mouse') {
      const i = pickMuseum(p.x, p.y, 14);
      // A just-plucked string keeps its name up for a moment.
      if (i !== hoverIdx && (i >= 0 || nowP > tagHoldUntil)) { hoverIdx = i; S.needs = true; }
      const onString = i < 0 && state.focus < 0 && strings.length && nearestString(p, 10);
      // Layer hover costs a raycast: at most once per frame.
      if (i < 0 && !onString && !hoverPickRaf) {
        hoverPickRaf = requestAnimationFrame(() => { hoverPickRaf = 0; const q = lastPtr; if (q) { const L2 = pickLayer(q); showPick(L2); canvas.style.cursor = L2 ? 'pointer' : canvas.style.cursor; } });
      }
      if (i >= 0 || onString) showPick(null);
      const L = pickHover >= 0 ? layers[pickHover] : null;
      canvas.style.cursor = i >= 0 || onString || L ? 'pointer' : 'grab';
    }
  });
  function end(e) {
    const wasDrag = drag;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) { drag = null; canvas.style.cursor = 'grab'; }
    if (wasDrag && wasDrag.mode === 'turn' && !wasDrag.moved && performance.now() - wasDrag.t < 400) {
      const p = localXY(e), mouse = e.pointerType === 'mouse';
      // Wait a beat: if this turns into a double-click (reset view), the tap does nothing.
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        const i = pickMuseum(p.x, p.y, mouse ? 16 : 28);
        if (i >= 0 && cb.onMuseum) { if (voy) voyPause(); cb.onMuseum(museums[i].id); }
        else if (i < 0 && cb.onDynasty && !voy) {
          // Tap a stratum in the model to read that era.
          const L = pickLayer(p);
          if (L) cb.onDynasty(L.id);
        }
      }, 260);
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { lastPtr = null; showPick(null); if (hoverIdx >= 0 && performance.now() > tagHoldUntil) { hoverIdx = -1; S.needs = true; } });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (voy && !voy.paused) voyPause();
    // Trackpad two-finger scroll (no ctrl) pans; pinch (ctrlKey) and mouse wheels zoom.
    if (!e.ctrlKey && e.deltaMode === 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5 && Math.abs(e.deltaX) > 1) { panBy(-e.deltaX, -e.deltaY); return; }
    to.dist = Math.max(baseDist * MIN_ZOOM, Math.min(baseDist * MAX_ZOOM, to.dist * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012))));
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
    // The layer whose capitals are named: the one read, or the one 溯洄 is passing.
    const LL = state.focus >= 0 ? state.focus : voy && voy.cur < N ? voy.cur : -1;
    siteLabels.forEach((s) => {
      if (LL >= 0 && s.layer === LL) focusSites.push(s);
      else s.el.style.visibility = 'hidden';
    });
    focusSites.sort((a, b) => a.rank - b.rank);
    // Regime names (曹魏 / 蜀汉 / 孙吴 …) sit under everything else, centred on their land.
    partLabels.forEach((t) => {
      const show = LL >= 0 && t.layer === LL;
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
    voyTick(dt);
    const idle = now - lastInteract > 5000 && state.sel < 0 && state.focus < 0 && !voy;
    if (idle) to.az += dt * 0.035 * Math.cos(now / 9000);
    const k = 1 - Math.pow(voy && !voy.paused && !reduceMotion ? 0.08 : 0.0015, dt);
    cam.az = lerp(cam.az, to.az, k); cam.el = lerp(cam.el, to.el, k); cam.dist = lerp(cam.dist, to.dist, k);
    cam.tx = lerp(cam.tx, to.tx, k); cam.ty = lerp(cam.ty, to.ty, k); cam.tz = lerp(cam.tz, to.tz, k);
    cam.ox = lerp(cam.ox, to.ox, k); cam.oy = lerp(cam.oy, to.oy, k); setOffset(cam.ox, cam.oy);
    camera.position.set(cam.tx + cam.dist * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);

    intro = Math.min(1, intro + dt / 2.2);
    const ka = 1 - Math.pow(voy ? 0.015 : 0.002, dt);
    layers.forEach((L) => {
      const appear = Math.max(0, Math.min(1, intro * 1.6 - (L.i / N) * 0.75));
      // The era being played lights up.
      const pf = !play ? 1 : playLayer === L.i ? (playRest ? 1.5 : 2.6) : playAct.has(L.i) ? 1.7 : 1;
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
      sp.visible = state.mode !== 'footprint' && state.focus < 0 && !state.mine && !voy;
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
    voyFlash(now);
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
    [sitePoints, mPoints, dPoints, tube, tubeGlow, chains, beams, stringMesh].concat(pulses).forEach((o) => {
      const m = o.material;
      if (PAL.ink) { m.blending = THREE.NormalBlending; return; }
      m.blending = THREE.CustomBlending;
      m.blendEquation = THREE.AddEquation; m.blendEquationAlpha = THREE.AddEquation;
      m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneFactor;
      m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
    });
    [sitePoints, mPoints, dPoints].forEach((p) => { p.material.uniforms.ink.value = PAL.ink ? 1 : 0; });
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
    setActive(on) { active = !!on; if (on) { last = performance.now(); fit(true); } else { stopPlay(); voyStop(false); } },
    renderTune,
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
      voyCap.style.bottom = b > 0 ? (b + 10) + 'px' : '';
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
  /** WAV bytes of 奏一曲 (F: era index, -1 all strata, omitted: what the view would play). */
  renderTune(F, o) { return S.ready ? S.renderTune(F, o) : Promise.resolve(null); },
  /** 'night' | 'paper' | 'qinglu' */
  setTheme(name) { if (S.ready) S.setTheme(name); },
};
window.dispatchEvent(new Event('strata-ready'));
`
