export const MAP_SCRIPT = `
window.MuseumMap = {
  map: null,
  tileLayer: null,
  markersLayer: null,
  eventMarkersLayer: null,
  routeLayer: null,
  mentionLayer: null,
  userLayer: null,
  _markerById: {},
  _selectedId: null,
  init: function(centerLat, centerLng) {
    this.map = L.map('map', {
      center: window.toMapCoord(centerLat, centerLng),
      zoom: 5,
      zoomControl: true,
    });
    this.tileLayer = L.tileLayer('/tile/{s}/{z}/{x}/{y}', {
      attribution: '© 高德地图', maxZoom: 18, subdomains: '1234',
      crossOrigin: 'anonymous'
    }).addTo(this.map);
    this.territoryLayer = L.layerGroup().addTo(this.map);
    this.eraLayer = L.layerGroup().addTo(this.map);
    this.rangeLayer = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.eventMarkersLayer = L.layerGroup().addTo(this.map);
    this.mentionLayer = L.layerGroup().addTo(this.map);
    this.userLayer = L.layerGroup().addTo(this.map);
    this.hereLayer = L.layerGroup().addTo(this.map);
    this.threadLayer = L.layerGroup().addTo(this.map);
  },
  setMarkers: function(museums, onClick, opts) {
    this.markersLayer.clearLayers();
    this._markerById = {};
    var self = this;
    var baseRecommended = !!(opts && opts.recommended);
    var isVisited = (opts && typeof opts.isVisited === 'function') ? opts.isVisited : null;
    var isCandidate = (opts && typeof opts.isCandidate === 'function') ? opts.isCandidate : null;
    var weightById = (opts && opts.weightById) || null;
    museums.forEach(function(m){
      if (!m.lat || !m.lng) return;
      var coord = window.toMapCoord(m.lat, m.lng);
      var visited = isVisited ? isVisited(m.id) : false;
      var cls = 'museum-marker';
      if (baseRecommended) cls += ' recommended';
      if (visited) cls += ' visited';
      else if (isCandidate && isCandidate(m.id)) cls += ' candidate';
      if (m.id === self._selectedId) cls += ' selected';
      var size = 14;
      if (weightById && weightById[m.id]) {
        var w = weightById[m.id];
        cls += w >= 5 ? ' w-curated' : (w >= 2 ? ' w-tier1' : ' w-other');
        size = w >= 5 ? 18 : (w >= 2 ? 14 : 10);
      }
      var icon = L.divIcon({ className: '', html: '<div class="' + cls + '" title="' + String(m.name || '').replace(/"/g, '&quot;') + '"></div>', iconSize: [size, size] });
      var marker = L.marker(coord, { icon: icon }).addTo(self.markersLayer);
      marker.on('click', function(){ onClick(m.id); });
      self._markerById[m.id] = marker;
    });
  },
  setSelected: function(id) {
    var prev = this._selectedId && this._markerById[this._selectedId];
    if (prev && prev.getElement()) {
      var pe = prev.getElement().querySelector('.museum-marker');
      if (pe) pe.classList.remove('selected');
      prev.setZIndexOffset(0);
    }
    this._selectedId = id || null;
    var cur = id && this._markerById[id];
    if (cur && cur.getElement()) {
      var ce = cur.getElement().querySelector('.museum-marker');
      if (ce) ce.classList.add('selected');
      cur.setZIndexOffset(1000);
    }
  },
  /** Trip route: stops in order, joined by a dashed gilt line, numbered. */
  setRoute: function(stops) {
    this.routeLayer.clearLayers();
    var pts = (stops || []).filter(function(m){ return m.lat && m.lng; }).map(function(m){ return window.toMapCoord(m.lat, m.lng); });
    if (!pts.length) return;
    if (pts.length > 1) {
      // Stroke colours come from the theme (.route-glow / .route-line in theme.ts).
      L.polyline(pts, { className: 'route-glow', weight: 6, opacity: 0.12, interactive: false }).addTo(this.routeLayer);
      L.polyline(pts, { className: 'route-line', weight: 2, opacity: 0.95, dashArray: '2 7', lineCap: 'round', interactive: false }).addTo(this.routeLayer);
    }
    var self = this;
    pts.forEach(function(p, i){
      L.marker(p, {
        icon: L.divIcon({ className: '', html: '<div class="route-stop">' + (i + 1) + '</div>', iconSize: [22, 22], iconAnchor: [11, 30] }),
        interactive: false, zIndexOffset: 500,
      }).addTo(self.routeLayer);
    });
    try { this.map.flyToBounds(L.latLngBounds(pts).pad(0.3), { duration: 0.8, maxZoom: 9 }); } catch(_) {}
  },
  clearRoute: function() {
    if (this.routeLayer) this.routeLayer.clearLayers();
  },
  /** 行程: the line we travel (WGS [[lat,lng]]), a soft corridor when driving, numbered city stops. */
  setTripLine: function(line, cities, opts) {
    opts = opts || {};
    this.routeLayer.clearLayers();
    var pts = (line || []).map(function(p){ return window.toMapCoord(p[0], p[1]); });
    if (pts.length > 1) {
      if (opts.corridor) L.polyline(pts, { className: 'route-corridor', weight: 26, opacity: 0.16, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(this.routeLayer);
      L.polyline(pts, { className: 'route-glow', weight: 6, opacity: 0.12, interactive: false }).addTo(this.routeLayer);
      L.polyline(pts, opts.real
        ? { className: 'route-line', weight: 2.6, opacity: 0.95, lineCap: 'round', interactive: false }
        : { className: 'route-line', weight: 2, opacity: 0.95, dashArray: '2 7', lineCap: 'round', interactive: false }).addTo(this.routeLayer);
    }
    var self = this, cs = [];
    (cities || []).forEach(function(c, i){
      var p = window.toMapCoord(c.lat, c.lng); cs.push(p);
      L.marker(p, {
        icon: L.divIcon({ className: '', html: '<div class="route-city"><b>' + (i + 1) + '</b><span>' + String(c.name).replace(/[<&]/g, '') + '</span></div>', iconSize: [0, 0], iconAnchor: [11, 11] }),
        interactive: false, zIndexOffset: 600,
      }).addTo(self.routeLayer);
    });
    var all = pts.length ? pts : cs;
    var key = all.length + ':' + (all[0] || []).join(',') + ':' + (all[all.length - 1] || []).join(',');
    if (all.length && key !== this._tripKey) {
      this._tripKey = key;
      // On phones the trip panel is a bottom sheet over the map: fit the route into what's left above it.
      var self2 = this, bounds = L.latLngBounds(all);
      setTimeout(function(){
      var bottom = 30;
      try {
        // Use the sheet's height, not its position: it may still be sliding in.
        var sheet = document.querySelector('.stage.is-trip .toc-wrap');
        if (sheet && window.innerWidth <= 920) bottom = sheet.offsetHeight + 20;
      } catch(_) {}
      try { self2.map.flyToBounds(bounds, { duration: 0.8, maxZoom: 10, paddingTopLeft: [30, 90], paddingBottomRight: [30, bottom] }); } catch(_) {}
      }, 0);
    }
  },
  /** Museums the AI guide mentioned: numbered pins in order of appearance, on top of whatever markers are showing. */
  setMentions: function(museums, onClick, opts) {
    opts = opts || {};
    this.mentionLayer.clearLayers();
    var self = this, pts = [];
    (museums || []).forEach(function(m, i){
      if (!m.lat || !m.lng) return;
      var p = window.toMapCoord(m.lat, m.lng); pts.push(p);
      var visited = opts.isVisited ? opts.isVisited(m.id) : false;
      var marker = L.marker(p, {
        icon: L.divIcon({ className: '', html: '<div class="mention-pin' + (visited ? ' visited' : '') + '" title="' + String(m.name || '').replace(/[<&"]/g, '') + '">' + (i + 1) + '</div>', iconSize: [24, 24], iconAnchor: [12, 12] }),
        zIndexOffset: 800,
      }).addTo(self.mentionLayer);
      marker.on('click', function(){ onClick(m.id); });
    });
    this._mentionPts = pts;
    if (opts.fit !== false) this.fitMentions();
  },
  /** Fly to the mentioned pins, leaving room for the chat sheet when it is open. */
  fitMentions: function() {
    var pts = this._mentionPts || [], self = this;
    if (!pts.length) return;
    var bounds = L.latLngBounds(pts);
    setTimeout(function(){
      var bottom = 40;
      try {
        // The sheet's height, not its position: it may still be sliding.
        var sheet = document.querySelector('.chat-panel.open');
        if (sheet && !sheet.classList.contains('fullscreen')) bottom = sheet.offsetHeight + 24;
      } catch(_) {}
      try { self.map.flyToBounds(bounds, { duration: 0.8, maxZoom: pts.length === 1 ? 11 : 12, paddingTopLeft: [40, 90], paddingBottomRight: [40, bottom] }); } catch(_) {}
    }, 0);
  },
  clearMentions: function() {
    if (this.mentionLayer) this.mentionLayer.clearLayers();
    this._mentionPts = [];
  },
  /** A small popup at a place (WGS) with one action button. */
  askCity: function(p, label, onAdd) {
    var c = window.toMapCoord(p.lat, p.lng), self = this;
    var el = document.createElement('button');
    el.className = 'ask-city'; el.type = 'button'; el.textContent = label;
    el.addEventListener('click', function(){ self.map.closePopup(); onAdd(); });
    L.popup({ closeButton: false, className: 'ask-city-pop', offset: [0, -4] }).setLatLng(c).setContent(el).openOn(this.map);
  },
  /** Map taps (GCJ latlng) while a mode wants them; null to stop. */
  onMapClick: function(cb) {
    this._mapClick = cb;
    if (!this._mapClickBound && this.map) {
      this._mapClickBound = true;
      var self = this;
      this.map.on('click', function(e){
        if (self._suppressClickUntil && Date.now() < self._suppressClickUntil) return;   // the click that ends a long-press
        if (self._mapClick) self._mapClick(e.latlng);
      });
    }
  },
  /** Long-press / right-click on the map (GCJ latlng); null to stop. Leaflet turns a desktop
   *  right-click and an Android / iOS Safari long-press into contextmenu; the timer covers
   *  webviews where it doesn't (WeChat on iOS). Both paths fire once. */
  onLongPress: function(cb) {
    this._longPress = cb;
    if (this._lpBound || !this.map) return;
    this._lpBound = true;
    var self = this, map = this.map, el = map.getContainer(), timer = null, start = null, firedAt = 0;
    function fire(ll) {
      if (!self._longPress || Date.now() - firedAt < 800) return;
      firedAt = Date.now();
      self._suppressClickUntil = firedAt + 600;
      self._longPress(ll);
    }
    map.on('contextmenu', function(e){
      if (e.originalEvent && e.originalEvent.preventDefault) e.originalEvent.preventDefault();
      fire(e.latlng);
    });
    function cancel(){ if (timer) { clearTimeout(timer); timer = null; } }
    el.addEventListener('touchstart', function(e){
      cancel();
      if (e.touches.length !== 1) return;
      if (e.target && e.target.closest && e.target.closest('.leaflet-marker-icon, .leaflet-popup')) return;
      var t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      timer = setTimeout(function(){
        timer = null;
        var r = el.getBoundingClientRect();
        fire(map.containerPointToLatLng(L.point(start.x - r.left, start.y - r.top)));
      }, 550);
    }, { passive: true });
    el.addEventListener('touchmove', function(e){
      if (!timer || !start) return;
      var t = e.touches[0];
      if (e.touches.length !== 1 || Math.abs(t.clientX - start.x) > 8 || Math.abs(t.clientY - start.y) > 8) cancel();
    }, { passive: true });
    el.addEventListener('touchend', cancel, { passive: true });
    el.addEventListener('touchcancel', cancel, { passive: true });
  },
  /** 脚下千年: the point being read and its event ring (WGS-84 in). */
  setHere: function(lat, lng, km) {
    this.hereLayer.clearLayers();
    var c = window.toMapCoord(lat, lng);
    L.circle(c, { radius: (km || 50) * 1000, color: '#D4B072', weight: 1, opacity: 0.6, dashArray: '4 6', fill: false, interactive: false }).addTo(this.hereLayer);
    L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="here-pin"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false, zIndexOffset: 950 }).addTo(this.hereLayer);
  },
  clearHere: function() { if (this.hereLayer) this.hereLayer.clearLayers(); },
  /** Fly to a point of the reading (WGS-84), never zooming out. */
  focusPoint: function(lat, lng, zoom) {
    this.map.flyTo(window.toMapCoord(lat, lng), Math.max(this.map.getZoom(), zoom || 8), { duration: 0.6 });
  },
  /** 循迹 view: museum / event / mention markers step back; only the thread is drawn. */
  setThreadMode: function(on) {
    var self = this;
    var order = ['markersLayer', 'eventMarkersLayer', 'mentionLayer', 'rangeLayer', 'routeLayer', 'eraLayer', 'territoryLayer'];
    // hide in this order; bring back bottom-up so the stacking is what it was
    (on ? order : ['territoryLayer', 'eraLayer', 'rangeLayer', 'routeLayer', 'markersLayer', 'eventMarkersLayer', 'mentionLayer']).forEach(function(k){
      var l = self[k]; if (!l) return;
      if (on && self.map.hasLayer(l)) self.map.removeLayer(l);
      if (!on && !self.map.hasLayer(l)) l.addTo(self.map);
    });
    if (!on) { this.clearThread(); if (this._selectedId && this.setSelected) this.setSelected(this._selectedId); }
  },
  /** Draw a thread: the whole route faint, the walked part (0..upto) in vermilion, numbered stops. */
  setThreadRoute: function(stops, upto) {
    this.threadLayer.clearLayers();
    var pts = (stops || []).map(function(s){ return window.toMapCoord(s.lat, s.lng); });
    if (!pts.length) return;
    L.polyline(pts, { className: 'thread-line', weight: 1.5, opacity: 0.35, dashArray: '3 6', interactive: false }).addTo(this.threadLayer);
    if (upto > 0) L.polyline(pts.slice(0, upto + 1), { className: 'thread-walked', weight: 2.5, opacity: 0.9, interactive: false }).addTo(this.threadLayer);
    var self = this;
    pts.forEach(function(c, k){
      var cls = 'thread-dot' + (k <= upto ? ' on' : '') + (k === upto ? ' cur' : '');
      L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="' + cls + '">' + (k + 1) + '</div>', iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, zIndexOffset: k === upto ? 900 : 800 }).addTo(self.threadLayer);
    });
  },
  fitThread: function(stops, pad) {
    pad = pad || {};
    var pts = (stops || []).map(function(s){ return window.toMapCoord(s.lat, s.lng); });
    if (!pts.length) return;
    var m = pad.m != null ? pad.m : 48, b = L.latLngBounds(pts), sz = this.map.getSize();
    var usableW = sz.x - (pad.left || 0) - (pad.right || 0) - 2 * m, usableH = sz.y - (pad.top || 0) - (pad.bottom || 0) - 2 * m;
    if (usableW < 60 || usableH < 60) { this.map.flyTo(b.getCenter(), Math.min(this.map.getZoom(), 6), { duration: 0.8 }); return; }
    this.map.flyToBounds(b, { paddingTopLeft: [(pad.left || 0) + m, (pad.top || 0) + m], paddingBottomRight: [(pad.right || 0) + m, (pad.bottom || 0) + m], duration: 0.8, maxZoom: 8 });
  },
  clearThread: function() { if (this.threadLayer) this.threadLayer.clearLayers(); if (this.threadSegLayer) this.threadSegLayer.clearLayers(); },
  /** The leg picked in the timetable (上车 → 下车), drawn as a wide glow over the route; null clears. */
  setThreadSegment: function(stops) {
    if (!this.threadSegLayer) this.threadSegLayer = L.layerGroup().addTo(this.map);
    this.threadSegLayer.clearLayers();
    if (!stops || !stops.length) return;
    var pts = stops.map(function(s){ return window.toMapCoord(s.lat, s.lng); });
    if (pts.length === 1) L.circleMarker(pts[0], { radius: 16, className: 'thread-seg-dot', weight: 3, fill: false, interactive: false }).addTo(this.threadSegLayer);
    else L.polyline(pts, { className: 'thread-seg', weight: 8, opacity: 0.5, interactive: false }).addTo(this.threadSegLayer);
  },
  setUser: function(lat, lng) {
    this.userLayer.clearLayers();
    var c = window.toMapCoord(lat, lng);
    L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [16, 16] }), interactive: false, zIndexOffset: 900 }).addTo(this.userLayer);
    this.map.flyTo(c, 9, { duration: 0.8 });
  },
  /** 附近可补: the range around each anchor ({ lat, lng }), radius in km; styled by .range-ring. */
  setRange: function(anchors, km, noFly) {
    this.clearRange();
    var self = this, pts = [];
    (anchors || []).forEach(function(a){
      var c = window.toMapCoord(a.lat, a.lng);
      pts.push(c);
      L.circle(c, { radius: km * 1000, className: 'range-ring', weight: 1.2, dashArray: '3 6', interactive: false }).addTo(self.rangeLayer);
    });
    // Fly only when the range itself changes, not on every marker refresh.
    var key = km + ':' + pts.map(function(p){ return p[0].toFixed(3) + ',' + p[1].toFixed(3); }).join(';');
    if (pts.length && key !== this._rangeKey) {
      this._rangeKey = key;
      if (noFly) return;
      try {
        var b = L.latLngBounds(pts);
        var pad = km / 111;
        this.map.flyToBounds(L.latLngBounds([b.getSouth() - pad, b.getWest() - pad], [b.getNorth() + pad, b.getEast() + pad]), { duration: 0.8, maxZoom: 10 });
      } catch(_) {}
    }
  },
  clearRange: function() {
    if (this.rangeLayer) this.rangeLayer.clearLayers();
  },
  /** Leaving 附近可补: the next range flies the map again. */
  resetRange: function() {
    this.clearRange();
    this._rangeKey = null;
  },
  /** Your position, without moving the map. */
  showUser: function(lat, lng) {
    this.userLayer.clearLayers();
    L.marker(window.toMapCoord(lat, lng), { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [16, 16] }), interactive: false, zIndexOffset: 900 }).addTo(this.userLayer);
  },
  clearEvents: function(){
    if (this.eventMarkersLayer) this.eventMarkersLayer.clearLayers();
  },
  /** A dynasty on top of today's map. era = { parts, sites, trail, chains, culture, year, sketch, label, key }.
      parts = [{ n, r: [[[lng, lat]…]…] }]; sites = [{ name, lat, lng, role, note }]; styled by .territory / .era-* in theme.ts. */
  setEra: function(era) {
    this.clearEra();
    if (!era) return;
    var self = this;
    var L_ = L;
    function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    var pts = [];
    var parts = era.parts || [];
    var sites = era.sites || [];
    parts.forEach(function(part){
      if (!part.r || !part.r.length) return;
      var rings = part.r.map(function(ring){ return ring.map(function(p){ var c = window.toMapCoord(p[1], p[0]); pts.push(c); return c; }); });
      L_.polygon(rings, { className: 'territory', weight: 1.4, interactive: false, smoothFactor: 1.5 }).addTo(self.territoryLayer);
      if (parts.length >= 2 || part.n !== era.label) {
        var best = null, bestA = -1;
        part.r.forEach(function(ring){
          var a = 0;
          for (var i = 0; i < ring.length; i++) { var q = ring[(i + 1) % ring.length]; a += ring[i][0] * q[1] - q[0] * ring[i][1]; }
          a = Math.abs(a) / 2;
          if (a > bestA) { bestA = a; best = ring; }
        });
        if (best && best.length) {
          var sx = 0, sy = 0, sa = 0;
          for (var j = 0; j < best.length; j++) {
            var p0 = best[j], p1 = best[(j + 1) % best.length];
            var cr = p0[0] * p1[1] - p1[0] * p0[1];
            sa += cr; sx += (p0[0] + p1[0]) * cr; sy += (p0[1] + p1[1]) * cr;
          }
          var cx, cy;
          if (Math.abs(sa) > 1e-9) { cx = sx / (3 * sa); cy = sy / (3 * sa); }
          else { cx = best[0][0]; cy = best[0][1]; }
          L_.marker(window.toMapCoord(cy, cx), {
            icon: L_.divIcon({ className: 'era-label era-region-label', html: '<span>' + esc(part.n) + '</span>', iconSize: [0, 0] }),
            interactive: false, keyboard: false, zIndexOffset: 100,
          }).addTo(self.eraLayer);
        }
      }
    });
    // Neolithic: no territory, circles around the culture sites.
    if (era.culture) {
      sites.forEach(function(s){
        if (s.role !== 'culture') return;
        var c = window.toMapCoord(s.lat, s.lng); pts.push(c);
        L_.circle(c, { radius: 120000, className: 'territory', weight: 1.4, interactive: false }).addTo(self.territoryLayer);
        var o = window.toMapCoord(s.lat + 1.1, s.lng); pts.push(o);
        var o2 = window.toMapCoord(s.lat - 1.1, s.lng); pts.push(o2);
        L_.marker(c, {
          icon: L_.divIcon({ className: 'era-label era-region-label', html: '<span>' + esc(s.name) + '</span>', iconSize: [0, 0] }),
          interactive: false, keyboard: false, zIndexOffset: 100,
        }).addTo(self.eraLayer);
      });
    }
    // Capital moves.
    var trail = era.trail || [];
    if (trail.length > 1) {
      var line = [];
      trail.forEach(function(i){ var s = sites[i]; if (s) line.push(window.toMapCoord(s.lat, s.lng)); });
      L_.polyline(line, { className: 'era-trail', weight: 2, interactive: false }).addTo(self.eraLayer);
      for (var k = 0; k < line.length - 1; k++) {
        var a = self.map.project(line[k], 5), b = self.map.project(line[k + 1], 5);
        var dx = b.x - a.x, dy = b.y - a.y;
        if (Math.sqrt(dx * dx + dy * dy) < 6) continue;
        var ang = Math.atan2(dy, dx) * 180 / Math.PI;
        L_.marker([(line[k][0] + line[k + 1][0]) / 2, (line[k][1] + line[k + 1][1]) / 2], {
          icon: L_.divIcon({ className: 'era-arrow-wrap', html: '<i class="era-arrow" style="transform:rotate(' + ang.toFixed(1) + 'deg)"></i>', iconSize: [0, 0] }),
          interactive: false, keyboard: false, zIndexOffset: 300,
        }).addTo(self.eraLayer);
      }
    }
    (era.chains || []).forEach(function(ch){
      var line = [];
      ch.forEach(function(i){ var s = sites[i]; if (s) line.push(window.toMapCoord(s.lat, s.lng)); });
      if (line.length > 1) L_.polyline(line, { className: 'era-chain', weight: 1.2, interactive: false }).addTo(self.eraLayer);
    });
    // Capitals.
    sites.forEach(function(s){
      if (s.role !== 'capital' && s.role !== 'secondary') return;
      var c = window.toMapCoord(s.lat, s.lng); pts.push(c);
      var txt = esc(s.name) + (s.note ? '<em> · ' + esc(s.note) + '</em>' : '');
      L_.marker(c, {
        icon: L_.divIcon({ className: 'era-site-wrap', html: '<div class="era-site ' + (s.role === 'capital' ? 'is-capital' : 'is-secondary') + '"><i></i><span>' + txt + '</span></div>', iconSize: [0, 0] }),
        interactive: false, keyboard: false, zIndexOffset: 500,
      }).addTo(self.eraLayer);
    });
    this._eraPts = pts;
    this._eraKey = era.key || null;
    // Where to look when the whole era won't fit at a readable zoom: its (first) capital.
    var fs = (era.trail && era.trail.length && sites[era.trail[0]]) || sites.filter(function(s){ return s.role === 'capital'; })[0] || sites[0];
    this._eraFocus = fs ? window.toMapCoord(fs.lat, fs.lng) : null;
    this._syncEraZoom();
    if (parts.length && !era.culture && !this._territoryCredit) {
      this._territoryCredit = '疆域示意：Cliopatria (Seshat) CC BY 4.0';
      this.map.attributionControl.addAttribution(this._territoryCredit);
    }
    if (!this._eraZoomBound) { this._eraZoomBound = true; this.map.on('zoomend', function(){ self._syncEraZoom(); }); }
  },
  _syncEraZoom: function(){
    var c = this.map && this.map.getContainer();
    if (c) { c.classList.toggle('era-zoom-lo', this.map.getZoom() < 3); c.classList.toggle('era-zoom-far', this.map.getZoom() < 5); }
  },
  /** Fly to the era; pad = { left, right, top, bottom } px kept clear. Once per era key unless force. */
  fitEra: function(pad, force) {
    if (!this._eraPts || !this._eraPts.length) return;
    if (!force && this._eraFitted === this._eraKey) return;
    this._eraFitted = this._eraKey;
    pad = pad || {};
    this.map.invalidateSize();
    var b = L.latLngBounds(this._eraPts);
    var tl = L.point((pad.left || 0) + 24, (pad.top || 0) + 24), br = L.point((pad.right || 0) + 24, (pad.bottom || 0) + 24);
    // A vast empire under a half-open sheet would fit only at a world view (zoom ~2): never go
    // below a readable zoom — frame the capital there instead, in the part the sheet leaves open.
    var floor = window.innerWidth <= 640 ? 5 : 4;
    var z = this.map.getBoundsZoom(b, false, tl.add(br));
    if (z < floor && this._eraFocus) {
      this.map.flyTo(this._openCenter(this._eraFocus, floor, pad), floor, { duration: 0.9 });
      return;
    }
    this.map.flyToBounds(b, { paddingTopLeft: tl, paddingBottomRight: br, maxZoom: 7, duration: 0.9 });
  },
  /** The map centre that, at zoom z, puts ll in the middle of the part pad leaves open
      (pad = { left, right, top, bottom } px covered by sheets / bars). */
  _openCenter: function(ll, z, pad) {
    pad = pad || {};
    var size = this.map.getSize();
    var cx = ((pad.left || 0) + 24 + size.x - (pad.right || 0) - 24) / 2;
    var cy = ((pad.top || 0) + 24 + size.y - (pad.bottom || 0) - 24) / 2;
    return this.map.unproject(this.map.project(ll, z).add(L.point(size.x / 2 - cx, size.y / 2 - cy)), z);
  },
  /** Bring a place into the open part of the map. zoom null keeps the zoom; opts.fly animates
      a zoom change; opts.onlyIfHidden leaves the map alone when the place is already in view. */
  showAt: function(lat, lng, zoom, pad, opts) {
    if (!this.map) return;
    opts = opts || {}; pad = pad || {};
    this.map.invalidateSize();
    var ll = window.toMapCoord(lat, lng), z = zoom == null ? this.map.getZoom() : zoom;
    if (opts.onlyIfHidden && z === this.map.getZoom()) {
      var p = this.map.latLngToContainerPoint(ll), size = this.map.getSize();
      if (p.x >= (pad.left || 0) + 16 && p.x <= size.x - (pad.right || 0) - 16 &&
          p.y >= (pad.top || 0) + 16 && p.y <= size.y - (pad.bottom || 0) - 16) return;
    }
    var at = this._openCenter(ll, z, pad);
    if (z !== this.map.getZoom() || opts.fly) this.map.flyTo(at, z, { duration: 0.8 });
    else this.map.panTo(at, { animate: true, duration: 0.45 });
  },
  clearEra: function(){
    if (this.territoryLayer) this.territoryLayer.clearLayers();
    if (this.eraLayer) this.eraLayer.clearLayers();
    this._eraPts = null;
    if (this._territoryCredit) { this.map.attributionControl.removeAttribution(this._territoryCredit); this._territoryCredit = null; }
  },
  setEventMarkers: function(events, onClickRelatedMuseum, relatedMuseumsByDate) {
    this.eventMarkersLayer.clearLayers();
    var self = this;
    function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    (events || []).forEach(function(evt){
      if (!evt.lat || !evt.lng) return;
      var coord = window.toMapCoord(evt.lat, evt.lng);
      var icon = L.divIcon({
        className: '',
        html: '<div class="event-marker"></div>',
        iconSize: [14,14],
        iconAnchor: [7,7],
      });
      var marker = L.marker(coord, { icon: icon }).addTo(self.eventMarkersLayer);
      var related = (relatedMuseumsByDate && relatedMuseumsByDate(evt)) || [];
      var relatedHtml = '';
      if (related.length > 0) {
        relatedHtml = '<div class="ev-rel-label">去附近看看</div>';
        related.forEach(function(r){
          var dist = r.km == null ? '' : '<span class="pm-km">' + (r.km < 1 ? '就在此地' : Math.round(r.km) + ' km') + '</span>';
          relatedHtml += '<div data-museum-id="' + escapeHtml(r.museumId) + '" class="popup-museum">' + (window.ICONS ? window.ICONS.pin : '') + escapeHtml(r.name) + dist + '</div>';
        });
      }
      var popup = '<div class="ev-pop"><div class="ev-date">' + escapeHtml(evt.date || '') + '</div><div class="ev-text">' + escapeHtml(evt.event || '') + '</div>' + relatedHtml + '</div>';
      marker.bindPopup(popup);
      marker.on('popupopen', function(e){
        var node = e.popup.getElement();
        if (!node) return;
        node.querySelectorAll('.popup-museum').forEach(function(el){
          el.addEventListener('click', function(){
            var id = el.getAttribute('data-museum-id');
            if (id) onClickRelatedMuseum(id);
          });
        });
      });
    });
  },
  flyTo: function(lat, lng, zoom) {
    var c = window.toMapCoord(lat, lng);
    this.map.flyTo(c, zoom || 6, { duration: 0.8 });
  }
};
`
