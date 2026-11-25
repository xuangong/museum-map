// src/ui/client/era-synth.ts
// The era instruments, shared by 时空地层 (strata.ts) and 脚下千年. A classic script that sets
// window.EraSynth; audio goes through window.MMAudio (follows the silent switch, survives iOS
// interruptions). Moved verbatim from strata.ts — change the instruments here only.
import { ERA_VOICES } from "../../data/era-voices"

export const ERA_SYNTH_SCRIPT = `
(function(global){
  var window = global;
// ── 琴弦 sound: a warm plucked string (Karplus–Strong), tuned to 宫商角徵羽 ──
// Pitches are degrees of a pentatonic ladder (5 per octave) above G2. Longer strings reach
// deeper into history and sound lower; stopping a string at an era (its 徽) shortens it.
const PENTA = [0, 2, 4, 7, 9];
const MAX_DEG = 17;
const degFreq = (d) => { d = Math.max(0, Math.min(MAX_DEG, d)); return 98 * Math.pow(2, (12 * Math.floor(d / 5) + PENTA[d % 5]) / 12); };
let actx = null, master = null;
const ksCache = {};
// Audio lives in the page-wide MMAudio (app.ts): it follows the silent switch; iOS
// interruptions and the mute-after-background context are handled there. A new context gets its own room graph.
function bindCtx(c) {
  if (!c || c === actx) return;
  actx = c; master = makeGraph(c);
  Object.keys(ksCache).forEach((k) => { delete ksCache[k]; });
}
if (window.MMAudio) window.MMAudio.onNew(bindCtx);
/** Inside a real gesture (touchend / click — touchstart does not count). */
function unlockAudio() {
  if (window.MMAudio) bindCtx(window.MMAudio.unlock());
  else audioCtx();
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
  if (window.MMAudio) { bindCtx(window.MMAudio.get()); return actx; }
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { bindCtx(new AC()); } catch (e) { return null; }
  }
  if (actx.state !== 'running') { try { actx.resume(); } catch (e) {} }
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
  const ERA = ${JSON.stringify(ERA_VOICES)};
  function voiceOf(eraId) { const e = ERA[eraId]; return e && VOICES[e.voice] ? e.voice : 'ks'; }
  /** One note of an era's instrument, inside a user gesture. Silent if audio is unavailable. */
  function note(eraId, deg, vel) {
    try {
      unlockAudio();
      const ac = audioCtx();
      if (!ac || !master) return [];
      return stringSound(deg == null ? 7 : deg, vel == null ? 0.9 : vel, 0, ac.currentTime + 0.01, voiceOf(eraId));
    } catch (e) { return []; }
  }
  global.EraSynth = {
    PENTA: PENTA, MAX_DEG: MAX_DEG, degFreq: degFreq, VOICES: VOICES, ERA: ERA,
    makeGraph: makeGraph, ksBuffer: ksBuffer, stringSound: stringSound,
    audioCtx: audioCtx, unlock: unlockAudio, ctx: function(){ return actx; }, master: function(){ return master; },
    voiceOf: voiceOf, note: note,
  };
})(window);
`
