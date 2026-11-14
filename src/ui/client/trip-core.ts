// src/ui/client/trip-core.ts
// 行程's pure logic, shipped to the page as window.TripCore and evaluated as-is by the tests.
// Coordinates are WGS-84 {lat, lng}; lines are [[lat, lng], ...]; distances are km.
export const TRIP_CORE_SCRIPT = `
(function(global){
  function km(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function pt(p) { return { lat: p[0], lng: p[1] }; }
  // Distance from p to segment a–b on a local flat projection, and how far along it (0..1).
  function seg(p, a, b) {
    var kx = 111.32 * Math.cos(p.lat * Math.PI / 180), ky = 110.57;
    var ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky, bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky;
    var dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
    var x = ax + t * dx, y = ay + t * dy;
    return { km: Math.sqrt(x * x + y * y), t: t };
  }
  function lineKm(line) {
    var s = 0;
    for (var i = 1; i < line.length; i++) s += km(pt(line[i - 1]), pt(line[i]));
    return s;
  }
  // Nearest distance from p to the line, and the km along the line where that happens.
  function along(p, line) {
    if (line.length === 1) return { km: km(p, pt(line[0])), at: 0 };
    var best = { km: Infinity, at: 0 }, acc = 0;
    for (var i = 1; i < line.length; i++) {
      var a = pt(line[i - 1]), b = pt(line[i]), L = km(a, b), r = seg(p, a, b);
      if (r.km < best.km) best = { km: r.km, at: acc + r.t * L };
      acc += L;
    }
    return best;
  }
  function stopsAlong(museums, line, radius) {
    var out = [];
    museums.forEach(function(m){
      if (m.lat == null || m.lng == null) return;
      var r = along(m, line);
      if (r.km <= radius) out.push({ m: m, km: r.km, at: r.at });
    });
    return out.sort(function(a, b){ return a.at - b.at; });
  }
  function stopsNearCities(museums, cities, radius) {
    var out = [];
    museums.forEach(function(m){
      if (m.lat == null || m.lng == null) return;
      var best = -1, bk = Infinity;
      cities.forEach(function(c, i){ var d = km(m, c); if (d < bk) { bk = d; best = i; } });
      if (best >= 0 && bk <= radius) out.push({ m: m, km: bk, city: best });
    });
    return out.sort(function(a, b){ return a.city - b.city || a.km - b.km; });
  }
  // 必看 3 · each empty era it fills 2 · continues your line 2 · on site 1 · nearness up to 1.
  function score(t) {
    return (t.must ? 3 : 0) + t.fills * 2 + (t.connects ? 2 : 0) + (t.onSite ? 1 : 0) - Math.min(1, (t.km || 0) / 100);
  }
  function transitHint(d) {
    if (d < 150) return { mode: '高铁或大巴', h: Math.round((d / 100 + 0.5) * 10) / 10 };
    if (d <= 1200) return { mode: '高铁', h: Math.round((d / 250 + 1) * 10) / 10 };
    return { mode: '飞机', h: Math.round((d / 700 + 2.5) * 10) / 10 };
  }
  // groups: [{days?, stops: [...]}] → [{day, group, stops, over}]. With days: one day per day of
  // the city, stops spread at most perDay a day (the last day takes the rest, flagged over).
  // Without days (drive): chunk by perDay.
  function splitDays(groups, perDay) {
    var plan = [], day = 0;
    groups.forEach(function(g, gi){
      var s = g.stops.slice();
      if (g.days) {
        for (var d = 0; d < g.days; d++) {
          var last = d === g.days - 1, take = last ? s.splice(0) : s.splice(0, perDay);
          plan.push({ day: ++day, group: gi, stops: take, over: take.length > perDay });
        }
      } else {
        while (s.length) plan.push({ day: ++day, group: gi, stops: s.splice(0, perDay), over: false });
      }
    });
    return plan;
  }
  // Longest run of consecutive integers in eras that contains one of must; [from, to] or null.
  function longestRun(eras, must) {
    var set = {}; eras.forEach(function(e){ set[e] = true; });
    var best = null;
    must.forEach(function(x){
      if (!set[x]) return;
      var a = x, b = x;
      while (set[a - 1]) a--;
      while (set[b + 1]) b++;
      if (!best || b - a > best[1] - best[0]) best = [a, b];
    });
    return best;
  }
  // Old trips were a list of museum ids; the new trip is cities + picks.
  function migrate(saved, byId) {
    var fresh = { v: 2, mode: 'transit', cities: [], radius: 30, picks: [], route: null };
    if (!saved) return fresh;
    var has = function(id){ return typeof id === 'string' && Object.prototype.hasOwnProperty.call(byId, id) && byId[id]; };
    if (saved.v === 2) {
      var cities = (Array.isArray(saved.cities) ? saved.cities : []).filter(function(c){
        return c && typeof c.name === 'string' && c.name && typeof c.lat === 'number' && isFinite(c.lat) && typeof c.lng === 'number' && isFinite(c.lng);
      }).map(function(c){
        var o = { name: c.name, lat: c.lat, lng: c.lng };
        if (c.days != null) { var d = Math.round(Number(c.days)); o.days = isFinite(d) ? Math.max(1, Math.min(9, d)) : 1; }
        return o;
      });
      var rad = typeof saved.radius === 'number' && isFinite(saved.radius) && saved.radius > 0 ? saved.radius : 30;
      return { v: 2, mode: saved.mode === 'drive' ? 'drive' : 'transit', cities: cities, radius: rad,
        picks: (Array.isArray(saved.picks) ? saved.picks : []).filter(has), route: null };
    }
    if (!Array.isArray(saved.ids)) return fresh;
    var picks = saved.ids.filter(has), order = [], acc = Object.create(null);
    picks.forEach(function(id){
      var m = byId[id], c = m.city || m.name;
      if (!acc[c]) { acc[c] = { name: c, lat: 0, lng: 0, n: 0 }; order.push(c); }
      if (m.lat != null) { acc[c].lat += m.lat; acc[c].lng += m.lng; acc[c].n++; }
    });
    fresh.picks = picks;
    fresh.cities = order.filter(function(c){ return acc[c].n; }).map(function(c){ var a = acc[c]; return { name: a.name, lat: a.lat / a.n, lng: a.lng / a.n, days: 1 }; });
    return fresh;
  }
  global.TripCore = { km: km, lineKm: lineKm, along: along, stopsAlong: stopsAlong, stopsNearCities: stopsNearCities,
    score: score, transitHint: transitHint, splitDays: splitDays, longestRun: longestRun, migrate: migrate };
})(window);
`
