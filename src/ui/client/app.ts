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
      if (d.overview) sections.push({ title: '概述', html: '<div style="line-height:1.7;">' + escapeHtml(d.overview) + '</div>' });
      if (d.culture && d.culture.length) {
        sections.push({ title: '文化', html: d.culture.map(function(c){
          return '<div style="margin-bottom:8px;"><b>' + escapeHtml(c.category) + '</b>：' + escapeHtml(c.description || '') + '</div>';
        }).join('') });
      }
      if (d.events && d.events.length) {
        sections.push({ title: '历史事件', html: d.events.map(function(e){
          return '<div style="margin-bottom:6px;"><span style="color:var(--accent);">' + escapeHtml(e.date || '') + '</span> · ' + escapeHtml(e.event || '') + '</div>';
        }).join('') });
      }
      if (d.recommendedMuseums && d.recommendedMuseums.length) {
        sections.push({ title: '推荐博物馆', html: d.recommendedMuseums.map(function(r){
          var clickable = r.museumId ? ' data-museum-id="' + escapeHtml(r.museumId) + '" class="dynasty-rec" style="cursor:pointer;color:var(--accent);"' : ' style="color:var(--ink-soft);"';
          return '<div style="margin-bottom:8px;"><div' + clickable + '>📍 ' + escapeHtml(r.name) + '</div><div style="font-size:12px;color:var(--ink-mute);margin-top:2px;">' + escapeHtml(r.location || '') + '</div><div style="font-size:13px;margin-top:2px;">' + escapeHtml(r.reason || '') + '</div></div>';
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
      if (m.specialty) sections.push({ title: '特色', html: escapeHtml(m.specialty) });
      if (m.dynastyCoverage) sections.push({ title: '年代覆盖', html: escapeHtml(m.dynastyCoverage) });
      if (m.treasures && m.treasures.length) {
        sections.push({ title: '镇馆之宝', html: '<ul style="margin:0;padding-left:20px;">' + m.treasures.map(function(t){ return '<li>' + escapeHtml(t) + '</li>'; }).join('') + '</ul>' });
      }
      if (m.halls && m.halls.length) {
        sections.push({ title: '展厅', html: m.halls.map(escapeHtml).join('、') });
      }
      if (m.artifacts && m.artifacts.length) {
        sections.push({ title: '文物', html: m.artifacts.map(function(a){
          return '<div style="margin-bottom:10px;"><div class="museum-name" style="font-size:14px;">' + escapeHtml(a.name) + (a.period ? ' <span style="font-size:11px;color:var(--ink-mute);">' + escapeHtml(a.period) + '</span>' : '') + '</div><div style="font-size:13px;color:var(--ink-soft);">' + escapeHtml(a.description || '') + '</div></div>';
        }).join('') });
      }
      if (m.dynastyConnections && m.dynastyConnections.length) {
        sections.push({ title: '朝代关联', html: m.dynastyConnections.map(function(c){
          return '<div style="margin-bottom:6px;"><b>' + escapeHtml(c.dynasty) + '</b>：' + escapeHtml(c.description || '') + '</div>';
        }).join('') });
      }
      if (m.sources && m.sources.length) {
        sections.push({ title: '信源', html: m.sources.map(function(s){
          var url = /^https?:\\/\\//.test(s) ? s : null;
          return url ? '<a href="' + url + '" target="_blank" rel="noopener" style="color:var(--accent);">' + escapeHtml(url) + '</a>' : '<div>' + escapeHtml(s) + '</div>';
        }).join('<br>') });
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
