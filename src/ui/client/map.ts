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
      this.map.on('click', function(e){ if (self._mapClick) self._mapClick(e.latlng); });
    }
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
    this.map.flyToBounds(b, {
      paddingTopLeft: [(pad.left || 0) + 24, (pad.top || 0) + 24],
      paddingBottomRight: [(pad.right || 0) + 24, (pad.bottom || 0) + 24],
      maxZoom: 7, duration: 0.9,
    });
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
        relatedHtml = '<div class="ev-rel-label">相关博物馆</div>';
        related.forEach(function(r){
          relatedHtml += '<div data-museum-id="' + escapeHtml(r.museumId) + '" class="popup-museum">' + (window.ICONS ? window.ICONS.pin : '') + escapeHtml(r.name) + '</div>';
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
