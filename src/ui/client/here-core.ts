// src/ui/client/here-core.ts
// 脚下千年's pure logic, shipped to the page as window.HereCore and evaluated as-is by the tests.
// read(point, { dynasties (oldest first), museums, lineages }) → the land at that point, era by era.
// Coordinates are WGS-84 {lat, lng}; distances are km.
export const HERE_CORE_SCRIPT = `
(function(global){
  var R_NAME = 40, R_EVENT = 50, R_MUSEUM = 100, MAX_MUSEUMS = 2;
  function km(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  /** First year in a date label: "前221年" → -221, "627—649年" → 627, "约前1300年" → -1300. */
  function year(date) {
    var m = String(date || '').match(/(前)?(\\d+)/);
    return m ? (m[1] ? -1 : 1) * Number(m[2]) : 0;
  }
  function nearestOf(p, list) {
    var best = null;
    (list || []).forEach(function(c){
      if (c.lat == null || c.lng == null) return;
      var d = km(p, c);
      if (!best || d < best.km) best = { item: c, km: d };
    });
    return best;
  }
  function read(p, ctx) {
    ctx = ctx || {};
    var near = nearestOf(p, ctx.lineages);
    var city = near && near.km <= R_NAME ? near.item : null;
    var byId = {};
    (ctx.museums || []).forEach(function(m){ byId[m.id] = m; });
    var layers = [];
    (ctx.dynasties || []).forEach(function(d){
      var nm = null;
      if (city) for (var i = 0; i < city.names.length; i++) if (city.names[i].era === d.id) { nm = city.names[i]; break; }
      var events = (d.events || []).filter(function(e){ return e.lat != null && e.lng != null; })
        .map(function(e){ return { date: e.date, event: e.event, lat: e.lat, lng: e.lng, km: km(p, e) }; })
        .filter(function(e){ return e.km <= R_EVENT; })
        .sort(function(a, b){ return year(a.date) - year(b.date); });
      var seen = {}, ms = [];
      (d.recommendedMuseums || []).concat(d.relatedMuseums || []).forEach(function(r){
        var m = r && r.museumId && byId[r.museumId];
        if (!m || seen[m.id] || m.lat == null) return;
        seen[m.id] = true;
        var k = km(p, m);
        if (k <= R_MUSEUM) ms.push({ id: m.id, name: m.name, km: k });
      });
      ms.sort(function(a, b){ return a.km - b.km; });
      if (nm || events.length || ms.length) layers.push({
        dynastyId: d.id, name: nm ? nm.name : null, note: nm && nm.note ? nm.note : null,
        events: events, museums: ms.slice(0, MAX_MUSEUMS),
      });
    });
    layers.reverse();
    var nearest = null;
    if (!layers.length) {
      (ctx.dynasties || []).forEach(function(d){
        (d.events || []).forEach(function(e){
          if (e.lat == null || e.lng == null) return;
          var k = km(p, e);
          if (!nearest || k < nearest.km) nearest = { event: { date: e.date, event: e.event, lat: e.lat, lng: e.lng, dynastyId: d.id }, km: k };
        });
      });
    }
    return {
      point: { lat: p.lat, lng: p.lng },
      city: city ? { id: city.id, name: city.name, km: near.km } : null,
      nearCity: near ? { id: near.item.id, name: near.item.name, km: near.km } : null,
      layers: layers,
      nearest: nearest,
    };
  }
  /** The name the land is best remembered by: most frequent ancient name that isn't today's; ties → the newer. */
  function headline(r) {
    if (!r || !r.city) return null;
    var count = {}, best = null;
    r.layers.forEach(function(l){            // newest first, so the first to reach a count wins ties
      if (!l.name || l.name === r.city.name) return;
      count[l.name] = (count[l.name] || 0) + 1;
    });
    r.layers.forEach(function(l){
      if (!l.name || !count[l.name]) return;
      if (!best || count[l.name] > count[best]) best = l.name;
    });
    return best;
  }
  global.HereCore = { read: read, headline: headline, year: year, km: km, R_NAME: R_NAME, R_EVENT: R_EVENT, R_MUSEUM: R_MUSEUM };
})(window);
`
