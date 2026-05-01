export const APP_SCRIPT = `
window.museumApp = function() {
  return {
    museums: [],
    dynasties: [],
    search: '',
    currentDynastyId: null,
    selectedMuseumId: null,
    drawer: { open: false, loading: false, error: false, title: '', subtitle: '', sections: [], _loadFn: null },
    chat: { open: false, messages: [], input: '', loading: false },

    init() {
      var bs = document.getElementById('bootstrap-data');
      if (!bs) { console.error('bootstrap-data missing'); return; }
      var data = JSON.parse(bs.textContent);
      this.museums = data.museums;
      this.dynasties = data.dynasties;

      window.MuseumMap.init(35.0, 105.0);
      var self = this;
      this.refreshMarkers();
    },

    refreshMarkers() {
      var self = this;
      var d = this.currentDynasty();
      if (d) {
        // Filter mode: only recommended museums + event markers
        var museums = this.recommendedMuseums(d);
        window.MuseumMap.setMarkers(museums, function(id){ self.openMuseum(id); }, { recommended: true });
        window.MuseumMap.setEventMarkers(d.events || [], function(id){ self.openMuseum(id); }, function(){
          return (d.recommendedMuseums || []).filter(function(r){ return r.museumId; }).slice(0, 3);
        });
      } else {
        // All mode
        window.MuseumMap.setMarkers(this.museums, function(id){ self.openMuseum(id); });
        window.MuseumMap.clearEvents();
      }
    },

    currentDynasty() {
      if (!this.currentDynastyId) return null;
      return this.dynasties.find(function(x){ return x.id === this.currentDynastyId; }.bind(this)) || null;
    },

    recommendedMuseums(dynasty) {
      var ids = (dynasty.recommendedMuseums || [])
        .map(function(r){ return r.museumId; })
        .filter(function(id){ return id; });
      var byId = {};
      this.museums.forEach(function(m){ byId[m.id] = m; });
      var out = [];
      ids.forEach(function(id){ if (byId[id]) out.push(byId[id]); });
      return out;
    },

    get filteredMuseums() {
      var base;
      var d = this.currentDynasty();
      if (d) {
        base = this.recommendedMuseums(d);
      } else {
        base = this.museums;
      }
      var q = (this.search || '').trim().toLowerCase();
      if (!q) return base;
      return base.filter(function(m){
        return (m.name || '').toLowerCase().indexOf(q) >= 0
            || (m.corePeriod || '').toLowerCase().indexOf(q) >= 0;
      });
    },

    selectDynasty(id) {
      this.currentDynastyId = id;
      var d = this.currentDynasty();
      if (!d) return;
      this.refreshMarkers();
      if (d.center && d.center.lat && d.center.lng) {
        window.MuseumMap.flyTo(d.center.lat, d.center.lng, 5);
      }
      this.openDynastyDrawer(d);
    },

    clearDynastyFilter() {
      this.currentDynastyId = null;
      this.refreshMarkers();
      if (this.drawer.open && this.drawer.kind === 'dynasty') this.closeDrawer();
    },

    openDynastyDrawer(d) {
      this.drawer = {
        open: true, loading: false, error: false, kind: 'dynasty',
        title: d.name,
        subtitle: d.period || '',
        sections: this.buildDynastySections(d),
        _loadFn: () => this.openDynastyDrawer(d),
      };
    },

    buildDynastySections(d) {
      var self = this;
      var sections = [];
      function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
      if (d.overview) sections.push({ title: 'Overview · 概述', html: '<p>' + escapeHtml(d.overview) + '</p>' });
      if (d.culture && d.culture.length) {
        sections.push({ title: 'Culture · 文化', html: d.culture.map(function(c){
          return '<div style="margin-bottom:14px;"><div style="font-family:var(--display-cn);font-weight:600;font-size:15px;margin-bottom:4px;">' + escapeHtml(c.category) + '</div><div style="font-size:14px;color:var(--ink-mid);">' + escapeHtml(c.description || '') + '</div></div>';
        }).join('') });
      }
      if (d.events && d.events.length) {
        sections.push({ title: 'Chronicle · 大事记', html: d.events.map(function(e){
          return '<div class="event-row"><div class="date">' + escapeHtml(e.date || '') + '</div><div class="text">' + escapeHtml(e.event || '') + '</div></div>';
        }).join('') });
      }
      if (d.recommendedMuseums && d.recommendedMuseums.length) {
        sections.push({ title: 'Featured Museums · 推荐博物馆', html: d.recommendedMuseums.map(function(r, i){
          var attrs = r.museumId ? ' data-museum-id="' + escapeHtml(r.museumId) + '" class="rec-card dynasty-rec"' : ' class="rec-card" style="cursor:default;"';
          return '<div' + attrs + '><span class="num">' + (i+1).toString().padStart(2,'0') + '</span><div><div class="name">' + escapeHtml(r.name) + '</div><div class="loc">' + escapeHtml(r.location || '') + '</div><div class="reason">' + escapeHtml(r.reason || '') + '</div></div></div>';
        }).join('') });
      }
      return sections;
    },

    async openMuseum(id) {
      this.selectedMuseumId = id;
      this.drawer = { open: true, loading: true, error: false, kind: 'museum', title: '', subtitle: '', sections: [], _loadFn: () => this.openMuseum(id) };
      var head = this.museums.find(function(x){ return x.id === id; });
      if (head) {
        this.drawer.title = head.name;
        this.drawer.subtitle = head.corePeriod || '';
      }
      try {
        var res = await fetch('/api/museums/' + encodeURIComponent(id));
        if (!res.ok) throw new Error('http ' + res.status);
        var m = await res.json();
        this.drawer.title = m.name;
        this.drawer.subtitle = (m.location || '') + (m.level ? ' · ' + m.level : '');
        this.drawer.sections = this.buildMuseumSections(m);
        this.drawer.loading = false;
      } catch (e) {
        this.drawer.loading = false;
        this.drawer.error = true;
      }
    },

    reloadDrawer() {
      if (this.drawer._loadFn) this.drawer._loadFn();
    },

    closeDrawer() {
      this.drawer.open = false;
      this.selectedMuseumId = null;
    },

    onDrawerClick(e) {
      var el = e.target.closest && e.target.closest('.dynasty-rec');
      if (!el) return;
      var id = el.getAttribute('data-museum-id');
      if (id) this.openMuseum(id);
    },

    buildMuseumSections(m) {
      var sections = [];
      function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
      if (m.specialty) sections.push({ title: 'Specialty · 特色', html: '<p>' + escapeHtml(m.specialty) + '</p>' });
      if (m.dynastyCoverage) sections.push({ title: 'Coverage · 年代覆盖', html: '<p>' + escapeHtml(m.dynastyCoverage) + '</p>' });
      if (m.treasures && m.treasures.length) {
        sections.push({ title: 'Treasures · 镇馆之宝', html: '<ul>' + m.treasures.map(function(t){ return '<li>' + escapeHtml(t) + '</li>'; }).join('') + '</ul>' });
      }
      if (m.halls && m.halls.length) {
        sections.push({ title: 'Halls · 展厅', html: '<p>' + m.halls.map(escapeHtml).join('、') + '</p>' });
      }
      if (m.artifacts && m.artifacts.length) {
        sections.push({ title: 'Artifacts · 文物', html: m.artifacts.map(function(a){
          return '<div class="artifact"><div><span class="artifact-name">' + escapeHtml(a.name) + '</span>' + (a.period ? '<span class="artifact-period">' + escapeHtml(a.period) + '</span>' : '') + '</div><div class="artifact-desc">' + escapeHtml(a.description || '') + '</div></div>';
        }).join('') });
      }
      if (m.dynastyConnections && m.dynastyConnections.length) {
        sections.push({ title: 'Dynastic Ties · 朝代关联', html: m.dynastyConnections.map(function(c){
          return '<div style="margin-bottom:10px;"><span style="font-family:var(--display-cn);font-weight:600;color:var(--vermilion);">' + escapeHtml(c.dynasty) + '</span> · <span style="color:var(--ink-mid);">' + escapeHtml(c.description || '') + '</span></div>';
        }).join('') });
      }
      if (m.sources && m.sources.length) {
        sections.push({ title: 'Sources · 信源', html: m.sources.map(function(s){
          var url = /^https?:\\/\\//.test(s) ? s : null;
          return url ? '<a href="' + url + '" target="_blank" rel="noopener" class="source-link">' + escapeHtml(url) + '</a>' : '<div class="source-link" style="cursor:default;color:var(--ink-mid);border-bottom-color:var(--rule-soft);">' + escapeHtml(s) + '</div>';
        }).join('') });
      }
      return sections;
    },

    escape(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); },

    async sendChat() {
      var text = (this.chat.input || '').trim();
      if (!text || this.chat.loading) return;
      this.chat.messages.push({ role: 'user', content: text });
      this.chat.input = '';
      this.chat.loading = true;
      try {
        var reply = await window.MuseumChat.send(this.chat.messages.slice(-10));
        this.chat.messages.push({ role: 'assistant', content: reply });
      } catch (e) {
        this.chat.messages.push({ role: 'assistant', content: '（出错：' + (e.message || 'unknown') + '）' });
      } finally {
        this.chat.loading = false;
      }
    },
  };
};
`
