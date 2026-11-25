// src/ui/client/thread-core.ts
// 循迹's pure logic, shipped as window.ThreadCore and evaluated as-is by the tests.
// Threads come from /assets/threads.json (src/data/threads.ts). Coordinates WGS-84, km.
export const THREAD_CORE_SCRIPT = `
(function(global){
  var PROVINCES = ['内蒙古','黑龙江','北京','天津','上海','重庆','河北','山西','辽宁','吉林','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','台湾','香港','澳门'];
  var MERGE_KM = 30;
  function km(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /** "湖北黄冈" → "黄冈"; a bare municipality stays as is. */
  function cityOf(modern) {
    var s = String(modern || '');
    for (var i = 0; i < PROVINCES.length; i++) {
      var p = PROVINCES[i];
      if (s.indexOf(p) === 0 && s.length > p.length) return s.slice(p.length);
    }
    return s;
  }
  /** The trip a thread becomes: trip stops in order, consecutive stops < 30 km merged. */
  function toTrip(t) {
    var cities = [], skipped = 0;
    (t.stops || []).forEach(function(s){
      if (!s.trip) { skipped++; return; }
      var last = cities[cities.length - 1];
      if (last && km(last, s) < MERGE_KM) return;
      cities.push({ name: cityOf(s.modern), lat: s.lat, lng: s.lng, days: 1 });
    });
    return { cities: cities, skipped: skipped };
  }
  /** For each thread, its stop nearest to p within maxKm; nearest first. */
  function near(threads, p, maxKm) {
    var out = [];
    (threads || []).forEach(function(t){
      var best = null;
      (t.stops || []).forEach(function(s, i){
        var d = km(p, s);
        if (d <= maxKm && (!best || d < best.km)) best = { thread: t, stop: s, index: i, km: d };
      });
      if (best) out.push(best);
    });
    return out.sort(function(a, b){ return a.km - b.km; });
  }
  function byEra(threads, eraId) { return (threads || []).filter(function(t){ return t.era === eraId; }); }
  /** One pentatonic degree per stop: rises to the middle and comes home. */
  function notes(t) {
    var n = (t.stops || []).length;
    if (n <= 1) return n ? [5] : [];
    var out = [];
    for (var i = 0; i < n; i++) out.push(Math.max(0, Math.min(17, 5 + Math.round(4 * Math.sin(Math.PI * i / (n - 1))))));
    return out;
  }
  global.ThreadCore = { cityOf: cityOf, toTrip: toTrip, near: near, byEra: byEra, notes: notes, km: km, MERGE_KM: MERGE_KM };
})(window);
`
