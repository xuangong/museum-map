export const MAP_SCRIPT = `
window.MuseumMap = {
  map: null,
  markersLayer: null,
  eventMarkersLayer: null,
  init: function(centerLat, centerLng) {
    this.map = L.map('map', {
      center: window.toMapCoord(centerLat, centerLng),
      zoom: 5,
      zoomControl: true,
    });
    L.tileLayer('/tile/{s}/{z}/{x}/{y}', {
      attribution: '© 高德地图', maxZoom: 18, subdomains: '1234',
      crossOrigin: 'anonymous'
    }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.eventMarkersLayer = L.layerGroup().addTo(this.map);
  },
  setMarkers: function(museums, onClick, opts) {
    this.markersLayer.clearLayers();
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
      var size = 14;
      if (weightById && weightById[m.id]) {
        var w = weightById[m.id];
        cls += w >= 5 ? ' w-curated' : (w >= 2 ? ' w-tier1' : ' w-other');
        size = w >= 5 ? 18 : (w >= 2 ? 14 : 10);
      }
      var icon = L.divIcon({ className: '', html: '<div class="' + cls + '"></div>', iconSize: [size, size] });
      var marker = L.marker(coord, { icon: icon }).addTo(self.markersLayer);
      marker.on('click', function(){ onClick(m.id); });
    });
  },
  clearEvents: function(){
    if (this.eventMarkersLayer) this.eventMarkersLayer.clearLayers();
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
        relatedHtml = '<div style="margin-top:6px;font-size:11px;color:var(--ink-mute);">相关博物馆：</div>';
        related.forEach(function(r){
          relatedHtml += '<div data-museum-id="' + escapeHtml(r.museumId) + '" class="popup-museum" style="margin-top:4px;cursor:pointer;color:var(--accent);font-size:12px;">📍 ' + escapeHtml(r.name) + '</div>';
        });
      }
      var popup = '<div style="min-width:200px;font-family:var(--font-cn);"><div style="font-weight:600;color:var(--accent);">' + escapeHtml(evt.date || '') + '</div><div style="font-size:13px;margin-top:4px;">' + escapeHtml(evt.event || '') + '</div>' + relatedHtml + '</div>';
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
