export const MAP_SCRIPT = `
window.MuseumMap = {
  map: null,
  tileLayer: null,
  markersLayer: null,
  eventMarkersLayer: null,
  routeLayer: null,
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
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.eventMarkersLayer = L.layerGroup().addTo(this.map);
    this.userLayer = L.layerGroup().addTo(this.map);
  },
  setMarkers: function(museums, onClick, opts) {
    this.markersLayer.clearLayers();
    this._markerById = {};
    var self = this;
    var baseRecommended = !!(opts && opts.recommended);
    var isVisited = (opts && typeof opts.isVisited === 'function') ? opts.isVisited : null;
    var weightById = (opts && opts.weightById) || null;
    museums.forEach(function(m){
      if (!m.lat || !m.lng) return;
      var coord = window.toMapCoord(m.lat, m.lng);
      var visited = isVisited ? isVisited(m.id) : false;
      var cls = 'museum-marker';
      if (baseRecommended) cls += ' recommended';
      if (visited) cls += ' visited';
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
  setUser: function(lat, lng) {
    this.userLayer.clearLayers();
    var c = window.toMapCoord(lat, lng);
    L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [16, 16] }), interactive: false, zIndexOffset: 900 }).addTo(this.userLayer);
    this.map.flyTo(c, 9, { duration: 0.8 });
  },
  clearEvents: function(){
    if (this.eventMarkersLayer) this.eventMarkersLayer.clearLayers();
  },
  /** A dynasty's approximate extent (parts = [{ n, r: [[[lng, lat]…]…] }]); styled by .territory in theme.ts. */
  setTerritory: function(parts) {
    this.clearTerritory();
    var self = this;
    (parts || []).forEach(function(part){
      var rings = part.r.map(function(ring){ return ring.map(function(p){ return window.toMapCoord(p[1], p[0]); }); });
      L.polygon(rings, { className: 'territory', weight: 1.4, interactive: false, smoothFactor: 1.5 }).addTo(self.territoryLayer);
    });
    if (parts && parts.length && !this._territoryCredit) {
      this._territoryCredit = '疆域示意：Cliopatria (Seshat) CC BY 4.0';
      this.map.attributionControl.addAttribution(this._territoryCredit);
    }
  },
  clearTerritory: function(){
    if (this.territoryLayer) this.territoryLayer.clearLayers();
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
