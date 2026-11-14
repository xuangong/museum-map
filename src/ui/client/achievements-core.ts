// src/ui/client/achievements-core.ts
// 打卡成就 engine, shipped as window.AchCore and evaluated as-is by tests.
// Levels: 0 未达成 · 1 达成 · 2 圆满 (single-level achievements jump straight to 2).
export const ACH_CORE_SCRIPT = `
(function(global){
  function set(list){ var s = {}; (list || []).forEach(function(x){ s[x] = true; }); return s; }

  function longestRun(have, n) {
    var best = 0, cur = 0;
    for (var i = 1; i <= n; i++) { if (have[i]) { cur++; if (cur > best) best = cur; } else cur = 0; }
    return best;
  }

  function evaluate(catalog, ctx) {
    var visited = set(ctx.visited), byId = {}, provinces = {}, provVisited = {}, cityVisited = {}, layerHave = {};
    ctx.museums.forEach(function(m){
      byId[m.id] = m;
      if (m.province) provinces[m.province] = true;
      if (visited[m.id]) {
        if (m.province) provVisited[m.province] = true;
        if (m.city) cityVisited[m.city] = true;
        (ctx.eras[m.id] || []).forEach(function(l){ layerHave[l] = true; });
      }
    });
    var allProv = Object.keys(provinces), visitedProv = allProv.filter(function(p){ return provVisited[p]; });
    return catalog.map(function(a){
      var have = 0, reach = 0, total = 0, missing = [];
      if (a.members) {
        total = a.members.length; reach = a.reach || total;
        a.members.forEach(function(mem){
          var ok = mem.museum ? !!visited[mem.museum] : !!cityVisited[mem.city];
          if (ok) have++; else missing.push(mem.museum ? { museum: mem.museum } : { city: mem.city });
        });
        return { id: a.id, line: a.line, level: have >= total ? 2 : have >= reach ? 1 : 0, have: have, reach: reach, total: total, missing: missing };
      }
      if (a.provinces) {
        var inCat = a.provinces.filter(function(p){ return provinces[p]; });
        total = inCat.length; reach = 1;
        inCat.forEach(function(p){ if (provVisited[p]) have++; else missing.push({ province: p }); });
        return { id: a.id, line: a.line, level: total && have >= total ? 2 : have >= 1 ? 1 : 0, have: have, reach: reach, total: total, missing: missing };
      }
      if (a.share) {
        total = reach = Math.max(1, Math.ceil(allProv.length * a.share));
        have = Math.min(visitedProv.length, total);
        allProv.forEach(function(p){ if (!provVisited[p]) missing.push({ province: p }); });
        return { id: a.id, line: a.line, level: have >= total ? 2 : 0, have: have, reach: reach, total: total, missing: have >= total ? [] : missing };
      }
      if (a.layers) {
        for (var l = a.layers[0]; l <= a.layers[1]; l++) { total++; if (layerHave[l]) have++; else missing.push({ layer: l }); }
        reach = total;
        return { id: a.id, line: a.line, level: have >= total ? 2 : 0, have: have, reach: reach, total: total, missing: missing };
      }
      if (a.chain) {
        total = reach = a.chain;
        have = Math.min(longestRun(layerHave, ctx.layers), total);
        return { id: a.id, line: a.line, level: have >= total ? 2 : 0, have: have, reach: reach, total: total, missing: [] };
      }
      return { id: a.id, line: a.line, level: 0, have: 0, reach: 0, total: 0, missing: [] };
    });
  }

  // stored: { id: { r: reachedAt, c: completedAt } } (0 = not yet). Never lowers anything.
  function merge(stored, results, now) {
    var next = {}, fresh = [];
    Object.keys(stored || {}).forEach(function(k){ next[k] = { r: stored[k].r || 0, c: stored[k].c || 0 }; });
    results.forEach(function(res){
      var cur = next[res.id] || { r: 0, c: 0 }, was = cur.c ? 2 : cur.r ? 1 : 0;
      if (res.level <= was) return;
      if (!cur.r) cur.r = now;
      if (res.level === 2) cur.c = now;
      next[res.id] = cur;
      fresh.push({ id: res.id, level: res.level });
    });
    return { next: next, fresh: fresh };
  }

  function levelOf(stored, res) {
    var s = (stored || {})[res.id], was = s ? (s.c ? 2 : s.r ? 1 : 0) : 0;
    return Math.max(was, res.level);
  }

  // What visiting museum m would do: [{ id, kind: 'last'|'first'|'advance', next }] — 'last' = this completes a level.
  function nudges(catalog, results, m, eras) {
    var out = [], byRes = {};
    results.forEach(function(r){ byRes[r.id] = r; });
    var mEras = set((eras || {})[m.id]);
    catalog.forEach(function(a){
      var r = byRes[a.id]; if (!r || r.level === 2) return;
      var hit = r.missing.some(function(x){
        return (x.museum && x.museum === m.id) || (x.city && x.city === m.city) || (x.province && x.province === m.province) || (x.layer && mEras[x.layer]);
      });
      if (!hit) return;
      if (a.share || a.chain) return;
      var target = r.level === 1 ? r.total : r.reach;
      if (a.provinces && r.level === 0) { out.push({ id: a.id, kind: 'first', next: 1 }); return; }
      if (target - r.have === 1) out.push({ id: a.id, kind: 'last', next: r.level === 1 ? 2 : (r.reach === r.total ? 2 : 1) });
      else if (a.members) out.push({ id: a.id, kind: 'advance', next: r.level });
    });
    var rank = { last: 0, first: 1, advance: 2 };
    return out.sort(function(x, y){ return rank[x.kind] - rank[y.kind]; });
  }

  global.AchCore = { evaluate: evaluate, merge: merge, levelOf: levelOf, nudges: nudges, longestRun: longestRun };
})(window);
`
