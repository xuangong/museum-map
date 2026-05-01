export const MAP_SCRIPT = `
window.MuseumMap = {
  map: null,
  markersLayer: null,
  init: function(centerLat, centerLng) {
    this.map = L.map('map', {
      center: window.toMapCoord(centerLat, centerLng),
      zoom: 5,
      zoomControl: true,
    });
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      attribution: '© 高德地图', maxZoom: 18, subdomains: '1234'
    }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
  },
  setMarkers: function(museums, onClick) {
    this.markersLayer.clearLayers();
    var self = this;
    museums.forEach(function(m){
      var coord = window.toMapCoord(m.lat, m.lng);
      var icon = L.divIcon({ className: '', html: '<div class="museum-marker"></div>', iconSize: [14,14] });
      var marker = L.marker(coord, { icon: icon }).addTo(self.markersLayer);
      marker.on('click', function(){ onClick(m.id); });
    });
  },
  flyTo: function(lat, lng, zoom) {
    var c = window.toMapCoord(lat, lng);
    this.map.flyTo(c, zoom || 6, { duration: 0.8 });
  }
};
`
