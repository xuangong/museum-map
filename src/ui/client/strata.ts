import { CHINA_GEO_JSON } from "./geo-data"

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

const COL = {
  bone: new THREE.Color(0xEFE8DA),
  gilt: new THREE.Color(0xD4B072),
  giltHi: new THREE.Color(0xF2D79E),
  seal: new THREE.Color(0xEC5A3D),
  river: new THREE.Color(0x6FA3B8),
  patina: new THREE.Color(0x8DB8A9),
};

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

function pointsMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, pr: { value: Math.min(window.devicePixelRatio || 1, 2) }, k: { value: 9.0 } },
    vertexShader:
      'attribute float size; attribute vec3 tint; varying vec3 vTint; uniform float pr; uniform float k;' +
      'void main(){ vTint = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0);' +
      ' gl_PointSize = size * pr * (k / -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader:
      'uniform sampler2D map; varying vec3 vTint;' +
      'void main(){ vec4 t = texture2D(map, gl_PointCoord); if (t.a < 0.01) discard; gl_FragColor = vec4(vTint, t.a); }',
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

function fillGeometry() {
  const geoms = [];
  for (const r of GEO.main) {
    if (ringArea(r) < 1) continue;
    const shape = new THREE.Shape(r.map((p) => new THREE.Vector2(px(p[0]), -pz(p[1]))));
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    geoms.push(g);
  }
  // merge
  let count = 0; geoms.forEach((g) => { count += g.index ? g.index.count : g.attributes.position.count; });
  const pos = [];
  geoms.forEach((g) => {
    const p = g.attributes.position.array;
    if (g.index) { const idx = g.index.array; for (let i = 0; i < idx.length; i++) pos.push(p[idx[i] * 3], p[idx[i] * 3 + 1], p[idx[i] * 3 + 2]); }
    else for (let i = 0; i < p.length; i++) pos.push(p[i]);
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
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
  const fillGeom = fillGeometry();

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
    return { group: g, fill, outline, river, to: { fill: 0, outline: 0, river: 0 } };
  }
  const layers = layersData.map((L, i) => Object.assign(L, { i, y: yOf(i) }, makeLayer(yOf(i), false)));
  const top = makeLayer(yTop, true);

  // ── Sites (capitals / culture centres) ──
  const sites = [];
  layers.forEach((L) => {
    const g = data.geo[L.id]; if (!g) return;
    g.sites.forEach((s, k) => sites.push({ layer: L.i, k, s, x: px(s.lng), z: pz(s.lat), trail: g.trail.indexOf(k) >= 0 }));
  });
  const sitePos = new Float32Array(sites.length * 3), siteTint = new Float32Array(sites.length * 3), siteSize = new Float32Array(sites.length);
  sites.forEach((s, i) => { sitePos[i * 3] = s.x; sitePos[i * 3 + 1] = yOf(s.layer); sitePos[i * 3 + 2] = s.z; });
  const siteGeom = new THREE.BufferGeometry();
  siteGeom.setAttribute('position', new THREE.BufferAttribute(sitePos, 3));
  siteGeom.setAttribute('tint', new THREE.BufferAttribute(siteTint, 3));
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
    return { id: m.id, name: m.name, x: px(m.lng), z: pz(m.lat), links: ls, onSite, major: tiers.indexOf('tier1') >= 0 || tiers.indexOf('heritage-site') >= 0 };
  });
  const museumIdx = {}; museums.forEach((m, i) => { museumIdx[m.id] = i; });

  const mPos = new Float32Array(museums.length * 3), mTint = new Float32Array(museums.length * 3), mSize = new Float32Array(museums.length);
  museums.forEach((m, i) => { mPos[i * 3] = m.x; mPos[i * 3 + 1] = yTop; mPos[i * 3 + 2] = m.z; });
  const mGeom = new THREE.BufferGeometry();
  mGeom.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
  mGeom.setAttribute('tint', new THREE.BufferAttribute(mTint, 3));
  mGeom.setAttribute('size', new THREE.BufferAttribute(mSize, 1));
  const mPoints = new THREE.Points(mGeom, pointsMaterial(tex)); mPoints.renderOrder = 9; world.add(mPoints);

  const segs = [];   // { m, lo, hi }  (layer indices; hi = N means today)
  const dots = [];   // { m, layer, onSite }
  museums.forEach((m, mi) => {
    let upper = N;
    m.links.forEach((li) => { segs.push({ m: mi, lo: li, hi: upper }); dots.push({ m: mi, layer: li, onSite: !!m.onSite[li] }); upper = li; });
  });
  const bPos = new Float32Array(segs.length * 6), bCol = new Float32Array(segs.length * 6);
  const yAt = (li) => (li >= N ? yTop : yOf(li));
  segs.forEach((s, i) => {
    const m = museums[s.m];
    bPos.set([m.x, yAt(s.hi), m.z, m.x, yAt(s.lo), m.z], i * 6);
  });
  const bGeom = new THREE.BufferGeometry();
  bGeom.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  bGeom.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  const beams = new THREE.LineSegments(bGeom, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  beams.renderOrder = 5; world.add(beams);

  const dPos = new Float32Array(dots.length * 3), dTint = new Float32Array(dots.length * 3), dSize = new Float32Array(dots.length);
  dots.forEach((d, i) => { const m = museums[d.m]; dPos.set([m.x, yOf(d.layer), m.z], i * 3); });
  const dGeom = new THREE.BufferGeometry();
  dGeom.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeom.setAttribute('tint', new THREE.BufferAttribute(dTint, 3));
  dGeom.setAttribute('size', new THREE.BufferAttribute(dSize, 1));
  const dPoints = new THREE.Points(dGeom, pointsMaterial(tex)); dPoints.renderOrder = 8; world.add(dPoints);

  // ── HTML labels ──
  const overlay = el('div', 'strata-overlay'); container.appendChild(overlay);
  // Layer labels form a time ruler down the left edge; their height tracks the layer centre.
  const anchorX = 0, anchorZ = 0;
  const layerLabels = layers.map((L) => {
    const b = el('button', 'strata-label');
    b.type = 'button';
    b.appendChild(el('span', 'sl-name', L.name));
    b.appendChild(el('span', 'sl-period', L.period));
    b.addEventListener('click', (e) => { e.stopPropagation(); cb.onDynasty && cb.onDynasty(L.id); });
    overlay.appendChild(b);
    return { el: b, v: new THREE.Vector3(anchorX, L.y, anchorZ), layer: L.i };
  });
  const todayLabel = el('button', 'strata-label is-today');
  todayLabel.type = 'button';
  todayLabel.appendChild(el('span', 'sl-name', '今'));
  todayLabel.appendChild(el('span', 'sl-period', museums.length + ' 座博物馆'));
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
  // Label boxes are measured once; re-measure after the web fonts swap in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      siteLabels.forEach((s) => { s.w = 0; });
      hoverTag._idx = selTag._idx = -1;
      S.needs = true;
    });
  }
  const hint = el('div', 'strata-hint', '拖动旋转 · 双指缩放 · 点地层看朝代 · 点光点看博物馆'); overlay.appendChild(hint);

  // ── Camera ──
  const cam = { az: -0.5, el: 0.52, dist: 12, tx: 0, ty: H * 0.46, tz: 0 };
  const to = Object.assign({}, cam);
  let baseDist = 12, insetBottom = 0, insetRight = 0, ys = 1;
  function fit(snap) {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Shift the projection so the scene centres in the part not covered by a sheet / drawer.
    if (insetBottom > 0 || insetRight > 0) camera.setViewOffset(w, h, insetRight / 2, insetBottom / 2, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const half = Math.tan(camera.fov * DEG / 2);
    const vh = Math.max(1, h - insetBottom), vw = Math.max(1, w - insetRight);
    // Tall phone screens get taller strata: time takes the vertical room the map can't use.
    ys = vw / vh < 0.8 ? 1.55 : 1;
    world.scale.y = ys;
    const vf = Math.atan(half * vh / h), hf = Math.atan(half * vw / h);
    baseDist = Math.max(3.0 / Math.sin(vf), 3.0 / Math.sin(hf)) * 0.84;
    applyFocus(snap !== false);
  }

  const state = { mode: 'all', dynastyId: null, visited: {}, selectedId: null, focus: -1, sel: -1 };
  function applyFocus(instant) {
    const sel = state.sel >= 0 ? museums[state.sel] : null;
    const covered = insetBottom > 0 || insetRight > 0;
    if (state.focus >= 0) {
      to.ty = layers[state.focus].y * ys; to.tx = 0; to.tz = 0.15;
      to.dist = baseDist * (covered ? 0.9 : 0.76); to.el = 0.82;
    } else if (sel) {
      const lowest = sel.links.length ? yOf(sel.links[sel.links.length - 1]) : yTop;
      to.tx = sel.x * 0.6; to.tz = sel.z * 0.6; to.ty = (yTop + lowest) / 2 * ys;
      to.dist = baseDist * (covered ? 0.92 : 0.82); to.el = 0.46;
    } else {
      to.tx = 0; to.tz = 0; to.ty = H * 0.46 * ys; to.dist = baseDist; to.el = ys > 1 ? 0.42 : 0.52;
    }
    if (instant) Object.assign(cam, { dist: to.dist, tx: to.tx, ty: to.ty, tz: to.tz, el: to.el });
    S.needs = true;
  }

  // ── Colour state ──
  function setTint(arr, i, c, k) { arr[i * 3] = c.r * k; arr[i * 3 + 1] = c.g * k; arr[i * 3 + 2] = c.b * k; }
  function recolor() {
    const F = state.focus, mode = state.mode, visited = state.visited, selId = state.selectedId;
    const linkedToFocus = (m) => F >= 0 && m.links.indexOf(F) >= 0;
    museums.forEach((m, i) => {
      const v = !!visited[m.id], sel = m.id === selId;
      let c = COL.bone, k = m.major ? 0.85 : 0.6, size = m.major ? 15 : 11;
      if (mode === 'footprint') { if (v) { c = COL.seal; k = 1.15; size = 17; } else { k = 0.1; } }
      else if (F >= 0) { if (linkedToFocus(m)) { c = v ? COL.seal : COL.gilt; k = 1.15; size = 16; } else { k = 0.16; } }
      else if (v) { c = COL.seal; k = 1.1; size = m.major ? 17 : 14; }
      if (sel) { c = COL.giltHi; k = 1.5; size = 26; }
      setTint(mTint, i, c, k); mSize[i] = size;
    });
    mGeom.attributes.tint.needsUpdate = true; mGeom.attributes.size.needsUpdate = true;

    segs.forEach((s, i) => {
      const m = museums[s.m], v = !!visited[m.id], sel = m.id === selId;
      let c = COL.bone, k = 0.075;
      if (mode === 'footprint') { if (v) { c = COL.seal; k = 0.6; } else k = 0; }
      else if (F >= 0) { if (m.links.indexOf(F) >= 0 && s.lo >= F) { c = v ? COL.seal : COL.gilt; k = 0.62; } else k = 0.025; }
      else if (v) { c = COL.seal; k = 0.42; }
      if (sel) { c = COL.giltHi; k = 0.95; }
      setTint(bCol, i * 2, c, k); setTint(bCol, i * 2 + 1, c, k * 0.55);
    });
    bGeom.attributes.color.needsUpdate = true;

    dots.forEach((d, i) => {
      const m = museums[d.m], v = !!visited[m.id], sel = m.id === selId;
      let c = COL.bone, k = d.onSite ? 0.55 : 0.16, size = d.onSite ? 12 : 6;
      if (d.onSite) c = COL.giltHi;
      if (mode === 'footprint') { if (v) { c = COL.seal; k = 0.9; size = d.onSite ? 15 : 9; } else { k = 0; } }
      else if (F >= 0) {
        if (d.layer === F && m.links.indexOf(F) >= 0) { c = d.onSite ? COL.giltHi : (v ? COL.seal : COL.gilt); k = d.onSite ? 1.4 : 0.95; size = d.onSite ? 20 : 11; }
        else k *= 0.25;
      } else if (v) { c = COL.seal; k = 0.7; }
      if (sel) { c = COL.giltHi; k = d.onSite ? 1.6 : 1.1; size = d.onSite ? 22 : 13; }
      setTint(dTint, i, c, k); dSize[i] = size;
    });
    dGeom.attributes.tint.needsUpdate = true; dGeom.attributes.size.needsUpdate = true;

    sites.forEach((s, i) => {
      let c = s.s.role === 'culture' ? COL.patina : COL.gilt;
      let k = s.trail || s.s.role === 'culture' ? 0.75 : 0.45, size = s.s.role === 'capital' ? 14 : 10;
      if (F >= 0) { if (s.layer === F) { c = s.s.role === 'culture' ? COL.patina : COL.giltHi; k = 1.35; size = 22; } else k *= 0.3; }
      if (mode === 'footprint') k *= 0.5;
      setTint(siteTint, i, c, k); siteSize[i] = size;
    });
    siteGeom.attributes.tint.needsUpdate = true; siteGeom.attributes.size.needsUpdate = true;

    // Layer opacities
    const depth = {};
    if (mode === 'footprint') {
      museums.forEach((m) => { if (visited[m.id]) m.links.forEach((li) => { depth[li] = (depth[li] || 0) + 1; }); });
    }
    layers.forEach((L) => {
      let o = 0.11, f = 0.022, r = 0.07;
      if (F >= 0) { if (L.i === F) { o = 0.62; f = 0.11; r = 0.6; } else { o = 0.045; f = 0.008; r = 0.02; } }
      if (mode === 'footprint') { const d = Math.min(1, (depth[L.i] || 0) / 4); o = 0.05 + d * 0.4; f = 0.008 + d * 0.07; r = 0.03 + d * 0.15; }
      L.to = { outline: o, fill: f, river: r };
      L.fill.material.color.copy(mode === 'footprint' && depth[L.i] ? COL.seal : COL.gilt);
      layerLabels[L.i].el.classList.toggle('is-active', L.i === F);
      layerLabels[L.i].el.classList.toggle('is-dim', F >= 0 && L.i !== F);
      layerLabels[L.i].el.classList.toggle('has-visit', !!depth[L.i]);
    });
    top.to = { outline: F >= 0 ? 0.24 : 0.5, fill: F >= 0 ? 0.02 : 0.045, river: F >= 0 ? 0.1 : 0.28 };
    tube.material.opacity = mode === 'footprint' ? 0.35 : 0.95;
    tubeGlow.material.opacity = mode === 'footprint' ? 0.05 : 0.13;
    S.needs = true;
  }

  function update(next) {
    const prevFocus = state.focus, prevSel = state.sel;
    state.mode = next.mode || 'all';
    state.dynastyId = next.dynastyId || null;
    state.visited = {}; (next.visitedIds || []).forEach((id) => { state.visited[id] = true; });
    state.selectedId = next.selectedId || null;
    state.focus = state.mode === 'dynasty' && state.dynastyId != null && layerIndexById[state.dynastyId] != null ? layerIndexById[state.dynastyId] : -1;
    state.sel = state.selectedId != null && museumIdx[state.selectedId] != null ? museumIdx[state.selectedId] : -1;
    recolor();
    if (prevFocus !== state.focus || prevSel !== state.sel) applyFocus(false);
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
      const p = screenOf(m.x, yTop, m.z); if (p.z > 1) return;
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
  canvas.addEventListener('pointermove', (e) => {
    const p = localXY(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
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
      if (i !== hoverIdx) { hoverIdx = i; canvas.style.cursor = i >= 0 ? 'pointer' : 'grab'; S.needs = true; }
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
    }
  }
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (hoverIdx >= 0) { hoverIdx = -1; S.needs = true; } });
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
    focusSites.forEach((s) => {
      if (!s.w) { s.w = s.el.offsetWidth; s.h = s.el.offsetHeight; }
      const p = screenOf(s.v.x, s.v.y, s.v.z);
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
      if (!hit || p.z >= 1) { s.el.style.visibility = 'hidden'; return; }
      placed.push({ x: hit.x, y: hit.y, w, h: hh });
      s.el.style.visibility = 'visible';
      s.el.style.transform = 'translate3d(' + hit.x.toFixed(1) + 'px,' + hit.y.toFixed(1) + 'px,0)';
    });
    function tag(node, idx) {
      if (idx < 0) { node.style.visibility = 'hidden'; return; }
      const m = museums[idx], p = screenOf(m.x, yTop, m.z);
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
    const idle = now - lastInteract > 5000 && state.sel < 0;
    if (idle) to.az += dt * 0.035 * Math.cos(now / 9000);
    const k = 1 - Math.pow(0.0015, dt);
    cam.az = lerp(cam.az, to.az, k); cam.el = lerp(cam.el, to.el, k); cam.dist = lerp(cam.dist, to.dist, k);
    cam.tx = lerp(cam.tx, to.tx, k); cam.ty = lerp(cam.ty, to.ty, k); cam.tz = lerp(cam.tz, to.tz, k);
    camera.position.set(cam.tx + cam.dist * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.dist * Math.sin(cam.el), cam.tz + cam.dist * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);

    intro = Math.min(1, intro + dt / 2.2);
    const ka = 1 - Math.pow(0.002, dt);
    layers.forEach((L) => {
      const appear = Math.max(0, Math.min(1, intro * 1.6 - (L.i / N) * 0.75));
      lerpMat(L.outline.material, L.to.outline * appear, ka); lerpMat(L.fill.material, L.to.fill * appear, ka); lerpMat(L.river.material, L.to.river * appear, ka);
    });
    const ta = Math.max(0, intro * 1.6 - 0.6);
    lerpMat(top.outline.material, top.to.outline * Math.min(1, ta), ka); lerpMat(top.fill.material, top.to.fill * Math.min(1, ta), ka); lerpMat(top.river.material, top.to.river * Math.min(1, ta), ka);
    const grow = Math.min(1, intro * 1.25);
    tube.geometry.setDrawRange(0, Math.floor(tubeIndexCount * grow / 3) * 3);
    tubeGlow.geometry.setDrawRange(0, Math.floor(glowIndexCount * grow / 3) * 3);
    pulses.forEach((sp, i) => {
      const t = ((now / 1000) * 0.045 + i / pulses.length) % 1;
      if (t > grow) { sp.visible = false; return; }
      sp.visible = state.mode !== 'footprint';
      sp.position.copy(curve.getPointAt(t));
      const s = 0.12 + 0.05 * Math.sin(now / 300 + i);
      sp.scale.set(s, s, s);
    });

    renderer.render(scene, camera);
    placeLabels();
  }

  const ro = new ResizeObserver(() => fit(true));
  ro.observe(container);
  fit(true);
  recolor();
  S.raf = requestAnimationFrame(frame);

  Object.assign(S, {
    ready: true,
    update,
    setActive(on) { active = !!on; if (on) { last = performance.now(); fit(true); } },
    resize: () => fit(true),
    setInset(bottom, right) {
      const b = Math.max(0, Math.round(bottom || 0)), r = Math.max(0, Math.round(right || 0));
      if (b === insetBottom && r === insetRight) return;
      insetBottom = b; insetRight = r; fit(false);
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
};
window.dispatchEvent(new Event('strata-ready'));
`
