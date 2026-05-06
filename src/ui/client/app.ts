export const APP_SCRIPT = `
// Module-scope cache for visitedDynasties — outside Alpine reactive proxy.
// Putting these on \`this\` makes Alpine track every read inside x-for/:class,
// and writing them inside the same effect blanks the timeline ("自循环失效").
var __vdCache = null, __vdCacheKey = '', __vdCacheIds = {}, __vdDepth = {};
window.museumApp = function() {
  return {
    museums: [],
    dynasties: [],
    search: '',
    levelFilter: 'all',
    levelTiers: [
      { id: 'all', label: '全部' },
      { id: 'tier1', label: '一级馆' },
      { id: 'tier2', label: '二级馆' },
      { id: 'heritage-site', label: '世遗/国保' },
    ],
    currentDynastyId: null,
    selectedMuseumId: null,
    drawer: { open: false, loading: false, error: false, title: '', subtitle: '', sections: [], _loadFn: null },
    chat: { open: false, messages: [], input: '', loading: false, fullscreen: false, palette: { open: false, query: '' } },
    tocOpen: false,
    shakeOpen: false,
    captionShown: false,
    _captionTimer: null,
    visits: { ids: [], byId: {}, footprintMode: false, review: '', reviewLoading: false, exporting: false, chatDirty: false, chatStartIdx: -1, reviewStale: false, reviewGeneratedAt: 0, shaking: false, muted: true },
    dynastyReviews: {},
    me: null,
    authForm: { email: '', password: '', loading: false, error: '' },
    inviteCode: '',
    authOpen: false,
    nameForm: { editing: false, value: '', loading: false, error: '' },
    viewingProfile: null,
    isReadOnly: false,
    toast: '',
    _toastTimer: null,
    _suppressHashChange: false,
    _scrollByHash: {},

    init() {
      var bs = document.getElementById('bootstrap-data');
      if (!bs) { console.error('bootstrap-data missing'); return; }
      var data = JSON.parse(bs.textContent);
      this.museums = data.museums;
      this.dynasties = data.dynasties;
      if (data.viewingProfile) {
        this.viewingProfile = data.viewingProfile;
        this.isReadOnly = true;
        var drs = (data.viewingProfile.dynastyReviews) || [];
        for (var i = 0; i < drs.length; i++) {
          var dr = drs[i];
          this.dynastyReviews[dr.dynastyId] = {
            summary: dr.summary || '',
            loading: false,
            exporting: false,
            stale: false,
            relevantVisitCount: dr.count || 0,
            totalRelevant: dr.count || 0,
            generatedAt: dr.generatedAt || 0,
          };
        }
      }

      // Surface any uncaught error very visibly — helps debug the timeline-blank issue.
      window.addEventListener('error', function(e){
        console.error('[museum-map] window error:', e.message, e.error);
      });
      window.addEventListener('unhandledrejection', function(e){
        console.error('[museum-map] unhandled rejection:', e.reason);
      });

      window.MuseumMap.init(35.0, 105.0);
      var self = this;

      // Capture invite code from URL (?invite=xxx) and strip from address bar
      try {
        var u0 = new URL(window.location.href);
        var inv = u0.searchParams.get('invite');
        if (inv) {
          this.inviteCode = inv;
          this.authOpen = true;
          u0.searchParams.delete('invite');
          window.history.replaceState({}, '', u0.toString());
        }
      } catch(_) {}

      // OAuth callback cleanup
      if (window.location.search.indexOf('logged_in=1') >= 0) {
        try {
          var url = new URL(window.location.href);
          url.searchParams.delete('logged_in');
          window.history.replaceState({}, '', url.toString());
        } catch(_) {}
      }

      (window.MuseumAuth ? window.MuseumAuth.syncMe() : Promise.resolve(null)).then(function(){
        self.me = window.MuseumAuth ? window.MuseumAuth.user : null;
        return self.loadVisits();
      }).then(function(){
        self.refreshMarkers();
        if (!self.isReadOnly) self.loadCachedReview();
        self.applyHashRoute();
      });

      window.addEventListener('hashchange', function(){ self.applyHashRoute(); });

      // Sidebar (TOC) resize handle — desktop only
      this.initTocResize();

      // First-visit welcome message in chat
      if (!window.localStorage.getItem('museumChatWelcomed')) {
        this.chat.messages.push({
          role: 'assistant',
          content: '👋 你好！这里可以问中国历史与博物馆，也支持斜杠命令：\\n\\n- \`/import <博物馆名>\` 派 agent 抓数据并暂存\\n- \`/pending\` 查看暂存列表\\n- \`/review <id>\` AI 评分并预览\\n- \`/approve|reject|delete <id>\` 处理暂存\\n\\n💡 输入 \`/\` 唤出命令面板。',
        });
        window.localStorage.setItem('museumChatWelcomed', '1');
      }

      // Track virtual keyboard via visualViewport so chat panel resizes above the keyboard.
      if (window.visualViewport) {
        var root = document.documentElement;
        var update = function() {
          var vv = window.visualViewport;
          // The viewport's top offset (when keyboard pushes content) and visible height.
          root.style.setProperty('--vv-top', vv.offsetTop + 'px');
          root.style.setProperty('--vv-h', vv.height + 'px');
          var bottomInset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
          root.style.setProperty('--kb-inset', bottomInset + 'px');
        };
        window.visualViewport.addEventListener('resize', update);
        window.visualViewport.addEventListener('scroll', update);
        update();
      }

      // Lock body scroll while chat panel is open (prevents iOS from scrolling the page
      // away when the soft keyboard appears).
      var self2 = this;
      this.$watch && this.$watch('chat.open', function(open){
        document.body.classList.toggle('chat-locked', !!open);
        if (open) {
          // jump panel to bottom of content
          setTimeout(function(){
            var b = document.querySelector('.chat-body');
            if (b) b.scrollTop = b.scrollHeight;
          }, 50);
        }
      });

      this.initShakeDetector();
      try {
        var savedMute = window.localStorage.getItem('shakeMuted');
        if (savedMute !== null) this.visits.muted = savedMute === '1';
      } catch(_) {}

      // Imperative timeline binding — bypass Alpine reactive :class/x-text on
      // dynasty items so the labels can never disappear if Alpine throws.
      var self3 = this;
      var nav = document.querySelector('[data-timeline]');
      if (nav) {
        nav.addEventListener('click', function(ev){
          var el = ev.target;
          while (el && el !== nav && !(el.dataset && el.dataset.mmClick)) el = el.parentNode;
          if (!el || el === nav) return;
          var v = el.dataset.mmClick || '';
          if (v === 'dyn:__all__') self3.clearDynastyFilter();
          else if (v.indexOf('dyn:') === 0) self3.selectDynasty(v.slice(4));
        });
      }
      var syncTimeline = function() {
        try {
          if (!nav) return;
          var items = nav.querySelectorAll('.timeline-item[data-dyn-id]');
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var id = it.getAttribute('data-dyn-id');
            it.className = 'timeline-item ' + self3.timelineItemClass(id);
          }
          var allEl = nav.querySelector('.timeline-item.all');
          if (allEl) allEl.className = 'timeline-item all' + (self3.currentDynastyId ? '' : ' active');
          var aName = nav.querySelector('[data-tl-all-name]');
          if (aName) aName.textContent = self3.visits.footprintMode ? '足迹朝代' : 'All / 全';
          var aPeriod = nav.querySelector('[data-tl-all-period]');
          if (aPeriod) {
            aPeriod.textContent = self3.visits.footprintMode
              ? (self3.visitedDynasties().length + ' dynasties')
              : (self3.museums.length + ' museums');
          }
        } catch(e) { console.warn('[museum-map] syncTimeline', e); }
      };
      this._syncTimeline = syncTimeline;
      syncTimeline();
      this.$watch && this.$watch('currentDynastyId', syncTimeline);
      this.$watch && this.$watch('visits.ids', syncTimeline);
      this.$watch && this.$watch('visits.footprintMode', syncTimeline);
      this.$watch && this.$watch('museums', syncTimeline);
      // Belt-and-braces: re-sync after any drawer close or hash route change.
      window.addEventListener('hashchange', function(){ setTimeout(syncTimeline, 0); });
    },

    commands: [
      { cmd: '/import ', label: '/import <博物馆名>', desc: '派 agent 抓取并暂存' },
      { cmd: '/pending', label: '/pending', desc: '查看暂存列表' },
      { cmd: '/review ', label: '/review <id>', desc: 'AI 评分 + 预览' },
      { cmd: '/approve ', label: '/approve <id>', desc: '通过暂存并发布到正库' },
      { cmd: '/reject ', label: '/reject <id>', desc: '拒绝暂存（不影响正库）' },
      { cmd: '/delete ', label: '/delete <id>', desc: '删除暂存记录（不影响正库）' },
      { cmd: '/unpublish ', label: '/unpublish <id>', desc: '从正库下架（不影响 pending）' },
      { cmd: '/enrich-images ', label: '/enrich-images <id>', desc: '为文物补图（Wikidata/Wikimedia）' },
      { cmd: '/help', label: '/help', desc: '查看命令帮助' },
    ],

    onChatInput() {
      var v = this.chat.input || '';
      if (v.charAt(0) === '/' && v.indexOf(' ') < 0) {
        this.chat.palette.open = true;
        this.chat.palette.query = v;
      } else {
        this.chat.palette.open = false;
      }
    },

    get filteredCommands() {
      var q = (this.chat.palette.query || '').toLowerCase();
      return this.commands.filter(function(c){ return c.cmd.indexOf(q) === 0 || c.label.toLowerCase().indexOf(q) >= 0; });
    },

    pickCommand(c) {
      this.chat.input = c.cmd;
      this.chat.palette.open = false;
      var el = document.querySelector('[data-chat-input]');
      if (el) el.focus();
    },

    onChatBodyClick(e) {
      var t = e.target;
      if (t && t.classList && t.classList.contains('cmd') && t.dataset && t.dataset.cmd) {
        this.chat.input = t.dataset.cmd;
        var el = document.querySelector('[data-chat-input]');
        if (el) el.focus();
      }
    },

    refreshMarkers() {
      var self = this;
      var d = this.currentDynasty();
      if (this.visits.footprintMode) {
        var visited = this.visitedMuseums();
        window.MuseumMap.setMarkers(visited, function(id){ self.openMuseum(id); }, { recommended: true, isVisited: function(){ return true; } });
        window.MuseumMap.clearEvents();
      } else if (d) {
        // Filter mode: only recommended museums + event markers
        var museums = this.recommendedMuseums(d);
        var weightById = this.dynastyMuseumWeights(d);
        window.MuseumMap.setMarkers(museums, function(id){ self.openMuseum(id); }, { recommended: true, weightById: weightById, isVisited: function(id){ return self.isVisited(id); } });
        window.MuseumMap.setEventMarkers(d.events || [], function(id){ self.openMuseum(id); }, function(){
          return (d.recommendedMuseums || []).filter(function(r){ return r.museumId; }).slice(0, 3);
        });
      } else {
        // All mode
        var weightAll = {};
        this.museums.forEach(function(m){
          var tiers = m.tiers || [];
          weightAll[m.id] = (tiers.indexOf('tier1') >= 0 || tiers.indexOf('heritage-site') >= 0) ? 2 : 1;
        });
        window.MuseumMap.setMarkers(this.museums, function(id){ self.openMuseum(id); }, { isVisited: function(id){ return self.isVisited(id); }, weightById: weightAll });
        window.MuseumMap.clearEvents();
      }
    },

    visitedMuseums() {
      var byId = {};
      this.museums.forEach(function(m){ byId[m.id] = m; });
      var out = [];
      this.visits.ids.forEach(function(id){ if (byId[id]) out.push(byId[id]); });
      return out;
    },

    dynastyShortName(d) {
      try {
        var n = (d && d.name) || '';
        var i = n.search(/[（(]/);
        return i >= 0 ? n.slice(0, i).trim() : n.trim();
      } catch(e) { console.warn('[museum-map] dynastyShortName', e); return ''; }
    },

    dynastyShortPeriod(d) {
      try {
        var p = (d && d.period) || '';
        return p.replace(/约公元/g, '').replace(/公元/g, '').replace(/年/g, '').replace(/—/g, '–');
      } catch(e) { console.warn('[museum-map] dynastyShortPeriod', e); return ''; }
    },

    /** Compose timeline-item :class safely. Accepts dynasty id (server-rendered timeline). */
    timelineItemClass(id) {
      try {
        var d = this.dynasties.find(function(x){ return x.id === id; });
        if (!d) return '';
        var active = (this.currentDynastyId === d.id) ? 'active ' : '';
        if (this.visits && this.visits.footprintMode) {
          return active + (this.isDynastyVisited(d) ? 'footprint' : 'footprint hidden');
        }
        if (this.isDynastyVisited(d)) return active + 'has-visit depth-' + this.dynastyDepth(d);
        return active.trim();
      } catch(e) { console.warn('[museum-map] timelineItemClass', e); return ''; }
    },

    /** Dynasties whose recommendedMuseums or relatedMuseums include any museum the user has visited.
     * Also computes a quality-weighted depth score per dynasty: 已访权重 / 总权重.
     * Weights: curated=5, related&tier1=2, related&heritage-site=2, related other=1.
     * 10 tiers by ratio: tier = ceil(ratio * 10), clamped 1..10. */
    visitedDynasties() {
      var key = this.visits.ids.join(',') + '|' + this.museums.length + '|' + this.dynasties.length;
      if (__vdCache && __vdCacheKey === key) return __vdCache;
      var visitedIds = {};
      this.visits.ids.forEach(function(id){ visitedIds[id] = true; });
      var museumsById = {};
      this.museums.forEach(function(m){ museumsById[m.id] = m; });
      function relatedWeight(mid){
        var m = museumsById[mid];
        var tiers = (m && m.tiers) || [];
        if (tiers.indexOf('tier1') >= 0 || tiers.indexOf('heritage-site') >= 0) return 2;
        return 1;
      }
      var hits = [];
      var hitIds = {};
      var depthById = {};
      this.dynasties.forEach(function(d){
        var totalW = 0, hitW = 0, anyHit = false;
        (d.recommendedMuseums || []).forEach(function(r){
          if (!r.museumId) return;
          totalW += 5;
          if (visitedIds[r.museumId]) { hitW += 5; anyHit = true; }
        });
        (d.relatedMuseums || []).forEach(function(r){
          if (!r.museumId) return;
          var w = relatedWeight(r.museumId);
          totalW += w;
          if (visitedIds[r.museumId]) { hitW += w; anyHit = true; }
        });
        if (anyHit) {
          hits.push(d);
          hitIds[d.id] = true;
          var ratio = totalW > 0 ? hitW / totalW : 0;
          // 10 tiers: 1=just hit (>0), 10=>=90%
          var tier = Math.min(10, Math.max(1, Math.ceil(ratio * 10)));
          depthById[d.id] = { ratio: ratio, tier: tier, hitW: hitW, totalW: totalW };
        }
      });
      __vdCacheKey = key;
      __vdCache = hits;
      __vdCacheIds = hitIds;
      __vdDepth = depthById;
      return hits;
    },

    /** 0 (none) | 1..10 (deeper) */
    dynastyDepth(d) {
      this.visitedDynasties();
      var info = __vdDepth && __vdDepth[d.id];
      return info ? info.tier : 0;
    },

    isDynastyVisited(d) {
      this.visitedDynasties();
      return !!(__vdCacheIds && __vdCacheIds[d.id]);
    },

    currentDynasty() {
      if (!this.currentDynastyId) return null;
      return this.dynasties.find(function(x){ return x.id === this.currentDynastyId; }.bind(this)) || null;
    },

    get tocVisible() {
      return (typeof window !== 'undefined') && window.matchMedia
        && window.matchMedia('(min-width: 920px)').matches;
    },

    showDynastyPeriod() {
      var d = this.currentDynasty();
      return !!(d && d.period);
    },

    dynastyTitle() {
      var d = this.currentDynasty();
      if (!d) return '';
      var n = d.name || '';
      var p = d.period || '';
      // If name contains the period in parens (e.g. "两晋（公元265年—420年）"),
      // strip the parenthesized portion — the period is shown as subtitle.
      if (p && n.indexOf(p) >= 0) {
        return n.replace(/[（(][^)）]*[)）]\s*$/, '').trim() || n;
      }
      return n;
    },

    recommendedMuseums(dynasty) {
      var ids = (dynasty.recommendedMuseums || [])
        .map(function(r){ return r.museumId; })
        .filter(function(id){ return id; });
      (dynasty.relatedMuseums || []).forEach(function(r){
        if (r.museumId && ids.indexOf(r.museumId) < 0) ids.push(r.museumId);
      });
      var byId = {};
      this.museums.forEach(function(m){ byId[m.id] = m; });
      var out = [];
      ids.forEach(function(id){ if (byId[id]) out.push(byId[id]); });
      return out;
    },

    /** Per-museum weight for a given dynasty: curated=5, tier1/heritage=2, else=1. */
    dynastyMuseumWeights(dynasty) {
      var museumsById = {};
      this.museums.forEach(function(m){ museumsById[m.id] = m; });
      var w = {};
      (dynasty.recommendedMuseums || []).forEach(function(r){
        if (r.museumId) w[r.museumId] = 5;
      });
      (dynasty.relatedMuseums || []).forEach(function(r){
        if (!r.museumId || w[r.museumId]) return;
        var m = museumsById[r.museumId];
        var tiers = (m && m.tiers) || [];
        w[r.museumId] = (tiers.indexOf('tier1') >= 0 || tiers.indexOf('heritage-site') >= 0) ? 2 : 1;
      });
      return w;
    },

    get filteredMuseums() {
      var base;
      if (this.visits.footprintMode) {
        base = this.visitedMuseums();
      } else {
        var d = this.currentDynasty();
        if (d) {
          base = this.recommendedMuseums(d);
        } else {
          base = this.museums;
        }
      }
      var lf = this.levelFilter;
      if (lf && lf !== 'all') {
        base = base.filter(function(m){ return (m.tiers || []).indexOf(lf) >= 0; });
      }
      var q = (this.search || '').trim().toLowerCase();
      if (!q) return base;
      // Strip spaces from pinyin queries so "gu gong" matches "gugong"
      var qNoSpace = q.replace(/\\s+/g, '');
      return base.filter(function(m){
        if ((m.name || '').toLowerCase().indexOf(q) >= 0) return true;
        if ((m.corePeriod || '').toLowerCase().indexOf(q) >= 0) return true;
        // Pinyin annotations are SSR-injected; absent for old clients = no-op
        if (m.pinyin && m.pinyin.indexOf(qNoSpace) >= 0) return true;
        if (m.pinyinInitials && m.pinyinInitials.indexOf(qNoSpace) >= 0) return true;
        return false;
      });
    },

    tierCount(tierId) {
      var pool;
      if (this.visits.footprintMode) {
        pool = this.visitedMuseums();
      } else {
        var d = this.currentDynasty();
        if (d) pool = this.recommendedMuseums(d);
        else pool = this.museums;
      }
      if (tierId === 'all') return pool.length;
      var n = 0;
      for (var i = 0; i < pool.length; i++) {
        if ((pool[i].tiers || []).indexOf(tierId) >= 0) n++;
      }
      return n;
    },

    selectDynasty(id) {
      this.currentDynastyId = id;
      this.tocOpen = false;
      var d = this.currentDynasty();
      if (!d) return;
      this.refreshMarkers();
      if (d.center && d.center.lat && d.center.lng) {
        window.MuseumMap.flyTo(d.center.lat, d.center.lng, 5);
      }
      this.openDynastyDrawer(d);
      this.flashCaption();
    },

    flashCaption() {
      this.captionShown = true;
      if (this._captionTimer) { clearTimeout(this._captionTimer); }
      var self = this;
      this._captionTimer = setTimeout(function(){ self.captionShown = false; }, 3000);
    },

    clearDynastyFilter() {
      this.currentDynastyId = null;
      this.captionShown = false;
      if (this._captionTimer) { clearTimeout(this._captionTimer); this._captionTimer = null; }
      this.refreshMarkers();
      if (this.drawer.open && this.drawer.kind === 'dynasty') this.closeDrawer();
    },

    openDynastyDrawer(d) {
      // If name contains the period in parens (e.g. "两晋（公元265年—420年）"),
      // strip the parens portion from the title so subtitle shows the period.
      var name = d.name || '';
      var period = d.period || '';
      var title = (period && name.indexOf(period) >= 0)
        ? (name.replace(/[（(][^)）]*[)）]\s*$/, '').trim() || name)
        : name;
      this.drawer = {
        open: true, loading: false, error: false, kind: 'dynasty',
        title: title,
        subtitle: period,
        dynastyId: d.id,
        sections: this.buildDynastySections(d),
        _loadFn: () => this.openDynastyDrawer(d),
      };
      this.setHashRoute({ kind: 'dynasty', id: d.id });
      // Auto-fetch cached dynasty review (no LLM call)
      this.fetchDynastyReview(d.id);
    },

    buildDynastySections(d) {
      var self = this;
      var sections = [];
      function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
      function md(s){ try { return window.MuseumChat.renderMarkdown(String(s||'')); } catch(e){ return '<p>' + escapeHtml(s) + '</p>'; } }
      // Sidebar (TOC) is permanently visible on desktop (>= 920px) and shows
      // dynasty.overview already — skip the duplicate "Overview · 概述" section.
      var tocVisible = (typeof window !== 'undefined') && window.matchMedia
        && window.matchMedia('(min-width: 920px)').matches;
      if (d.overview && !tocVisible) sections.push({ title: 'Overview · 概述', html: '<div class="md">' + md(d.overview) + '</div>' });
      if (d.culture && d.culture.length) {
        sections.push({ title: 'Culture · 文化', html: d.culture.map(function(c){
          return '<div style="margin-bottom:14px;"><div style="font-family:var(--display-cn);font-weight:600;font-size:15px;margin-bottom:4px;">' + escapeHtml(c.category) + '</div><div class="md" style="font-size:14px;color:var(--ink-mid);">' + md(c.description || '') + '</div></div>';
        }).join('') });
      }
      if (d.events && d.events.length) {
        sections.push({ title: 'Chronicle · 大事记', html: d.events.map(function(e){
          return '<div class="event-row"><div class="date">' + escapeHtml(e.date || '') + '</div><div class="text md">' + md(e.event || '') + '</div></div>';
        }).join('') });
      }
      if (d.recommendedMuseums && d.recommendedMuseums.length) {
        var visitedMap = this.visits.byId || {};
        sections.push({ title: 'Featured Museums · 推荐博物馆', html: d.recommendedMuseums.map(function(r, i){
          var attrs = r.museumId ? ' data-museum-id="' + escapeHtml(r.museumId) + '" class="rec-card dynasty-rec"' : ' class="rec-card" style="cursor:default;"';
          var check = (r.museumId && visitedMap[r.museumId]) ? '<span class="rec-visited" title="已打卡">✓</span>' : '';
          return '<div' + attrs + '><span class="num">' + (i+1).toString().padStart(2,'0') + '</span><div><div class="name">' + escapeHtml(r.name) + check + '</div><div class="loc">' + escapeHtml(r.location || '') + '</div><div class="reason md">' + md(r.reason || '') + '</div></div></div>';
        }).join('') });
      }
      if (d.relatedMuseums && d.relatedMuseums.length) {
        var visitedMap2 = this.visits.byId || {};
        sections.push({ title: 'Also Relevant · 也有相关展品', html: d.relatedMuseums.map(function(r, i){
          var check = visitedMap2[r.museumId] ? '<span class="rec-visited" title="已打卡">✓</span>' : '';
          return '<div data-museum-id="' + escapeHtml(r.museumId) + '" class="rec-card dynasty-rec"><span class="num">' + (i+1).toString().padStart(2,'0') + '</span><div><div class="name">' + escapeHtml(r.name) + check + '</div><div class="loc">' + escapeHtml(r.location || '') + '</div><div class="reason md">' + md(r.reason || '') + '</div></div></div>';
        }).join('') });
      }
      return sections;
    },

    async openMuseum(id) {
      this.selectedMuseumId = id;
      this.tocOpen = false;
      this.drawer = { open: true, loading: true, error: false, kind: 'museum', title: '', subtitle: '', sections: [], _loadFn: () => this.openMuseum(id) };
      this.setHashRoute({ kind: 'museum', id: id });
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
      // Just clear drawer + hash. Avoid history.back() because it triggers
      // a cascade (hashchange → applyHashRoute → selectDynasty/clearDynastyFilter)
      // that can leave the timeline in a weird state on certain machines.
      this.drawer.open = false;
      this.selectedMuseumId = null;
      this.setHashRoute(null);
      // Defensive re-sync of timeline DOM after drawer close.
      var nav = document.querySelector('[data-timeline]');
      if (nav && this._syncTimeline) setTimeout(this._syncTimeline, 0);
    },

    // ─── URL hash routing for shareable deep links ───
    setHashRoute(route) {
      // route: null | { kind: 'museum'|'dynasty', id: string }
      var target = '';
      if (route && route.id) {
        var prefix = route.kind === 'dynasty' ? 'd' : 'm';
        target = '#/' + prefix + '/' + encodeURIComponent(route.id);
      }
      if (location.hash === target) return; // no-op, also avoids feedback loops from applyHashRoute
      // Snapshot current drawer scroll BEFORE navigating away so we can restore on back.
      this._snapshotScroll(location.hash || '');
      this._suppressHashChange = true;
      try {
        if (target) {
          // Push a history entry tagged so closeDrawer can detect "this is ours".
          // Using replaceState first to anchor the pre-route state with no marker,
          // then pushState the new route. But to keep behavior simple and avoid
          // breaking initial hash-deep-link, only push when there is no existing route.
          var hadOurRoute = !!(history.state && history.state.kind === 'mm-route');
          if (hadOurRoute) {
            // Replace so we don't keep stacking entries when navigating dynasty→dynasty.
            history.replaceState({ kind: 'mm-route' }, '', target);
          } else {
            history.pushState({ kind: 'mm-route' }, '', target);
          }
        } else if (location.hash) {
          history.pushState(null, '', location.pathname + location.search);
        }
      } catch(_) {}
      var self = this;
      setTimeout(function(){ self._suppressHashChange = false; }, 0);
    },

    _snapshotScroll(hash) {
      if (!hash) return;
      var el = document.querySelector('.drawer');
      if (el) this._scrollByHash[hash] = el.scrollTop;
    },

    _restoreScroll(hash) {
      var top = this._scrollByHash[hash];
      // Run after Alpine renders the new sections.
      var attempts = 0;
      var self = this;
      function tryRestore() {
        var el = document.querySelector('.drawer');
        if (el) {
          el.scrollTop = (typeof top === 'number') ? top : 0;
          return;
        }
        if (++attempts < 10) requestAnimationFrame(tryRestore);
      }
      requestAnimationFrame(tryRestore);
    },

    initTocResize() {
      var handle = document.getElementById('toc-resize');
      var stage = document.querySelector('.stage');
      if (!handle || !stage) return;
      var MIN = 240, MAX = 640, KEY = 'museumMapTocWidth';
      var saved = parseInt(window.localStorage.getItem(KEY) || '', 10);
      if (saved && saved >= MIN && saved <= MAX) {
        document.documentElement.style.setProperty('--toc-w', saved + 'px');
      }
      var dragging = false;
      function onMove(e){
        if (!dragging) return;
        var x = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
        var rect = stage.getBoundingClientRect();
        var w = Math.max(MIN, Math.min(MAX, x - rect.left));
        document.documentElement.style.setProperty('--toc-w', w + 'px');
        try { window.dispatchEvent(new Event('resize')); } catch(_) {}
      }
      function onUp(){
        if (!dragging) return;
        dragging = false;
        handle.classList.remove('dragging');
        document.body.classList.remove('toc-resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        var cur = getComputedStyle(document.documentElement).getPropertyValue('--toc-w').trim();
        var n = parseInt(cur, 10);
        if (n) window.localStorage.setItem(KEY, String(n));
      }
      function onDown(e){
        if (window.matchMedia && window.matchMedia('(max-width: 920px)').matches) return;
        dragging = true;
        handle.classList.add('dragging');
        document.body.classList.add('toc-resizing');
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
        e.preventDefault();
      }
      handle.addEventListener('mousedown', onDown);
      handle.addEventListener('touchstart', onDown, { passive: false });
      handle.addEventListener('dblclick', function(){
        document.documentElement.style.removeProperty('--toc-w');
        window.localStorage.removeItem(KEY);
        try { window.dispatchEvent(new Event('resize')); } catch(_) {}
      });
    },

    applyHashRoute() {
      if (this._suppressHashChange) return;
      var h = location.hash || '';
      var m = h.match(/^#\\/(d|m)\\/(.+)$/);
      if (!m) {
        if (this.drawer.open) {
          this.drawer.open = false;
          this.selectedMuseumId = null;
        }
        return;
      }
      var kind = m[1], id = decodeURIComponent(m[2]);
      var self = this;
      if (kind === 'd') {
        var dyn = this.dynasties.find(function(x){ return x.id === id; });
        if (dyn) {
          this.selectDynasty(id);
          this._restoreScroll(h);
        }
      } else if (kind === 'm') {
        this.openMuseum(id).then(function(){ self._restoreScroll(h); });
      }
    },

    async shareCurrent() {
      if (!this.drawer.open) return;
      var route, title, desc;
      if (this.drawer.kind === 'dynasty' && this.drawer.dynastyId) {
        route = { kind: 'dynasty', id: this.drawer.dynastyId };
        title = '中國博物館地圖 · ' + this.drawer.title;
        desc = '看看 ' + this.drawer.title + ' 朝代的相关博物馆';
      } else if (this.drawer.kind === 'museum' && this.selectedMuseumId) {
        route = { kind: 'museum', id: this.selectedMuseumId };
        title = '中國博物館地圖 · ' + this.drawer.title;
        desc = this.drawer.title + (this.drawer.subtitle ? ' · ' + this.drawer.subtitle : '');
      } else {
        return;
      }
      var url = location.origin + location.pathname + '#/' + (route.kind === 'dynasty' ? 'd' : 'm') + '/' + encodeURIComponent(route.id);
      try {
        if (navigator.share) {
          await navigator.share({ title: title, text: desc, url: url });
          return;
        }
      } catch(_) {}
      try {
        await navigator.clipboard.writeText(url);
        this.flashToast('链接已复制');
      } catch(_) {
        prompt('复制下面的链接分享：', url);
      }
    },

    flashToast(msg) {
      this.toast = msg;
      if (this._toastTimer) clearTimeout(this._toastTimer);
      var self = this;
      this._toastTimer = setTimeout(function(){ self.toast = ''; }, 1800);
    },

    async loadVisits() {
      if (this.isReadOnly && this.viewingProfile) {
        var pv = this.viewingProfile.visits || [];
        var pIds = pv.map(function(x){ return x.museumId; });
        var pById = {};
        pv.forEach(function(x){ pById[x.museumId] = x; });
        this.visits.ids = pIds;
        this.visits.byId = pById;
        if (this.viewingProfile.review && this.viewingProfile.review.summary) {
          this.visits.review = this.viewingProfile.review.summary;
          this.visits.reviewGeneratedAt = this.viewingProfile.review.generatedAt;
        }
        return;
      }
      if (window.MuseumAuth && window.MuseumAuth.isAuthenticated()) {
        try {
          var res = await fetch('/api/visits', { credentials: 'same-origin' });
          if (!res.ok) return;
          var j = await res.json();
          var ids = (j.items || []).map(function(x){ return x.museumId; });
          var byId = {};
          (j.items || []).forEach(function(x){ byId[x.museumId] = x; });
          this.visits.ids = ids;
          this.visits.byId = byId;
        } catch(_) {}
      } else {
        var anon = (window.MuseumAuth && window.MuseumAuth.anon.read()) || [];
        var ids2 = anon.map(function(v){ return v.museumId; });
        var byId2 = {};
        anon.forEach(function(v){ byId2[v.museumId] = { museumId: v.museumId, visitedAt: v.visitedAt, note: null }; });
        this.visits.ids = ids2;
        this.visits.byId = byId2;
      }
    },

    isVisited(id) {
      return !!this.visits.byId[id];
    },

    async toggleVisit(id) {
      if (this.isReadOnly) {
        this.flashToast('只读模式：点击右上角「退出」回到自己的视图');
        return;
      }
      var visited = this.isVisited(id);
      try {
        if (window.MuseumAuth && window.MuseumAuth.isAuthenticated()) {
          if (visited) {
            await fetch('/api/visits/' + encodeURIComponent(id), { method: 'DELETE', credentials: 'same-origin' });
          } else {
            await fetch('/api/visits/' + encodeURIComponent(id), { method: 'POST', credentials: 'same-origin', headers: {'content-type':'application/json'}, body: '{}' });
          }
        } else if (window.MuseumAuth) {
          if (visited) window.MuseumAuth.anon.remove(id);
          else window.MuseumAuth.anon.push(id, Date.now());
        }
        await this.loadVisits();
        this.refreshMarkers();
        if (this.visits.review) this.visits.reviewStale = true;
        // Mark all cached dynasty reviews as stale (their counts may have changed)
        var self = this;
        Object.keys(this.dynastyReviews).forEach(function(did){
          if (self.dynastyReviews[did].summary) self.dynastyReviews[did].stale = true;
        });
        // If the dynasty drawer is open, refetch its current count so display updates
        if (this.drawer.open && this.drawer.kind === 'dynasty' && this.drawer.dynastyId) {
          this.fetchDynastyReview(this.drawer.dynastyId);
        }
        // Refresh drawer so the toggle button label updates
        if (this.drawer.open && this.drawer.kind === 'museum' && this.selectedMuseumId === id) {
          this.openMuseum(id);
        }
      } catch(_) {}
    },

    async submitLogin() {
      if (this.authForm.loading) return;
      this.authForm.loading = true; this.authForm.error = '';
      try {
        await window.MuseumAuth.login(this.authForm.email, this.authForm.password);
        this.me = window.MuseumAuth.user;
        this.authForm.email = ''; this.authForm.password = '';
        await this.loadVisits(); this.refreshMarkers();
        this.flashToast('已登录');
      } catch(e) {
        this.authForm.error = (e && e.message) || '登录失败';
      } finally { this.authForm.loading = false; }
    },

    async submitRegister() {
      if (this.authForm.loading) return;
      this.authForm.loading = true; this.authForm.error = '';
      try {
        await window.MuseumAuth.register(this.authForm.email, this.authForm.password, this.inviteCode);
        this.me = window.MuseumAuth.user;
        this.authForm.email = ''; this.authForm.password = '';
        this.inviteCode = '';
        await this.loadVisits(); this.refreshMarkers();
        this.flashToast('已注册并登录');
      } catch(e) {
        var msg = (e && e.message) || '注册失败';
        if (msg === 'email_taken') msg = '邮箱已注册';
        if (msg === 'weak_password') msg = '密码至少 8 位';
        if (msg === 'invalid_email') msg = '邮箱格式不对';
        if (msg === 'invite_required') msg = '需要邀请码';
        if (msg === 'invite_invalid') msg = '邀请码无效';
        if (msg === 'invite_used') msg = '邀请码已被使用';
        if (msg === 'invite_expired') msg = '邀请码已过期';
        this.authForm.error = msg;
      } finally { this.authForm.loading = false; }
    },

    async createInvite() {
      if (!this.me || !this.me.isAdmin) return;
      try {
        var res = await fetch('/auth/invites', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expiresInDays: 30 }),
        });
        var j = await res.json();
        if (!res.ok) throw new Error(j.error || 'create_failed');
        var url = window.location.origin + '/?invite=' + encodeURIComponent(j.invite.code);
        try { await navigator.clipboard.writeText(url); this.flashToast('邀请链接已复制'); }
        catch(_) { window.prompt('复制邀请链接：', url); }
      } catch(e) {
        this.flashToast('生成失败：' + ((e && e.message) || ''));
      }
    },

    async copyShareLink() {
      if (!this.me || !this.me.handle) return;
      var url = window.location.origin + '/u/' + encodeURIComponent(this.me.handle);
      try { await navigator.clipboard.writeText(url); this.flashToast('公开主页链接已复制'); }
      catch(_) { window.prompt('复制公开主页链接：', url); }
    },

    async editHandle() {
      if (!this.me || !this.me.handle) return;
      if (this.me.handleChangedAt) {
        this.flashToast('链接只能修改一次，已改过');
        return;
      }
      var next = window.prompt(
        '自定义你的分享链接（/u/...）\\n\\n' +
        '⚠️ 警告：只能修改一次。修改后旧链接立即失效，已分享出去的链接将打不开。\\n\\n' +
        '允许：中文、英文、数字、连字符；2–24 字符。',
        this.me.handle
      );
      if (next == null) return;
      next = String(next).trim();
      if (!next || next === this.me.handle) return;
      try {
        var res = await fetch('/auth/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ handle: next }),
        });
        var j = await res.json();
        if (!res.ok) {
          var msg = j.error === 'handle_taken' ? '该链接已被占用'
            : j.error === 'handle_already_changed' ? '链接只能修改一次，已改过'
            : j.error === 'invalid_handle' ? '链接格式不合法（2–24 字符，中英数字/连字符）'
            : ('修改失败：' + (j.error || res.status));
          this.flashToast(msg);
          return;
        }
        this.me = j.user;
        if (window.MuseumAuth) window.MuseumAuth.user = j.user;
        this.flashToast('已更新，新链接：/u/' + this.me.handle);
      } catch(_) {
        this.flashToast('网络错误');
      }
    },

    async togglePlazaVisibility() {
      if (!this.me) return;
      var next = !this.me.showOnPlaza;
      try {
        var res = await fetch('/auth/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ showOnPlaza: next }),
        });
        var j = await res.json();
        if (!res.ok) { this.flashToast('更新失败'); return; }
        this.me = j.user;
        if (window.MuseumAuth) window.MuseumAuth.user = j.user;
        this.flashToast(next ? '已在广场显示' : '已从广场隐藏');
      } catch(_) {
        this.flashToast('网络错误');
      }
    },

    async doLogout() {
      await window.MuseumAuth.logout();
      this.me = null;
      await this.loadVisits(); this.refreshMarkers();
      this.flashToast('已退出');
    },

    doGoogleLogin() { window.MuseumAuth.googleStart(); },

    startEditName() {
      this.nameForm.value = (this.me && (this.me.displayName || '')) || '';
      this.nameForm.error = '';
      this.nameForm.editing = true;
    },

    cancelEditName() {
      this.nameForm.editing = false;
      this.nameForm.error = '';
    },

    async submitDisplayName() {
      if (this.nameForm.loading) return;
      this.nameForm.loading = true; this.nameForm.error = '';
      try {
        var u = await window.MuseumAuth.setDisplayName(this.nameForm.value);
        this.me = u;
        this.nameForm.editing = false;
        this.flashToast('已更新昵称');
      } catch(e) {
        this.nameForm.error = (e && e.message) || '更新失败';
      } finally { this.nameForm.loading = false; }
    },

    toggleFootprint() {
      this.visits.footprintMode = !this.visits.footprintMode;
      if (this.visits.footprintMode) {
        this.currentDynastyId = null;
      }
      this.refreshMarkers();
    },

    toggleShakeMute() {
      this.visits.muted = !this.visits.muted;
      try { window.localStorage.setItem('shakeMuted', this.visits.muted ? '1' : '0'); } catch(_) {}
      // Brief preview when un-muting so user knows it works
      if (!this.visits.muted) this.playRevealSound();
    },

    shakeForMuseum(opts) {
      if (this.visits.shaking) return;
      // First tap on iOS unlocks devicemotion (needs user gesture)
      if (this._motionNeedsPermission && this._enableMotion) {
        this._enableMotion();
        this._motionNeedsPermission = false;
      }
      var unvisited = this.museums.filter(function(m){ return m && m.lat && m.lng; })
        .filter(function(m){ return !this.visits.byId[m.id]; }.bind(this));
      if (unvisited.length === 0) {
        alert('🎉 你已经打卡了所有博物馆！');
        return;
      }
      this.visits.shaking = true;
      var pick = unvisited[Math.floor(Math.random() * unvisited.length)];
      var self = this;
      var fast = !!(opts && opts.fast);
      var dur = fast ? 100 : 600;
      if (!this.visits.muted) this.playShakeSound(dur);
      setTimeout(function(){
        self.visits.shaking = false;
        if (!self.visits.muted) self.playRevealSound();
        if (window.MuseumMap && window.MuseumMap.flyTo) {
          window.MuseumMap.flyTo(pick.lat, pick.lng, 7);
        }
        self.openMuseum(pick.id);
        if (navigator.vibrate) { try { navigator.vibrate([30, 40, 30]); } catch(_) {} }
      }, dur);
    },

    _audioCtx() {
      if (this._ac) return this._ac;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this._ac = new AC(); } catch(_) { return null; }
      return this._ac;
    },

    _ensureAudio(then) {
      var ac = this._audioCtx(); if (!ac) return;
      if (ac.state === 'suspended' && ac.resume) {
        var p = ac.resume();
        if (p && p.then) { p.then(then).catch(then); return; }
      }
      then();
    },

    playShakeSound(durationMs) {
      var self = this;
      this._ensureAudio(function(){
        var ac = self._ac; if (!ac) return;
        var dur = Math.max(0.08, durationMs / 1000);
        var bufSize = Math.floor(ac.sampleRate * dur);
        var buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < bufSize; i++) {
          var t = i / bufSize;
          var grain = (Math.sin(t * 60) > 0.4) ? (Math.random() * 2 - 1) : (Math.random() * 0.4 - 0.2);
          data[i] = grain * (1 - t * 0.6);
        }
        var src = ac.createBufferSource(); src.buffer = buf;
        var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.4;
        var g = ac.createGain(); g.gain.value = 0.22;
        src.connect(bp); bp.connect(g); g.connect(ac.destination);
        src.start();
        src.stop(ac.currentTime + dur);
      });
    },

    playRevealSound() {
      var self = this;
      this._ensureAudio(function(){
        var ac = self._ac; if (!ac) return;
        var t0 = ac.currentTime;
        [
          { f: 1046.5, when: 0,    dur: 0.35 },
          { f: 1567.98, when: 0.09, dur: 0.45 },
        ].forEach(function(n){
          var osc = ac.createOscillator(); osc.type = 'sine'; osc.frequency.value = n.f;
          var g = ac.createGain();
          g.gain.setValueAtTime(0.0001, t0 + n.when);
          g.gain.exponentialRampToValueAtTime(0.28, t0 + n.when + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.when + n.dur);
          osc.connect(g); g.connect(ac.destination);
          osc.start(t0 + n.when);
          osc.stop(t0 + n.when + n.dur + 0.02);
        });
      });
    },

    initShakeDetector() {
      if (typeof window === 'undefined' || !window.DeviceMotionEvent) return;
      var self = this;
      var lastShake = 0;
      var lastX = null, lastY = null, lastZ = null;
      var THRESHOLD = 18; // m/s^2 delta
      function onMotion(e) {
        var a = e.accelerationIncludingGravity || e.acceleration;
        if (!a || a.x == null) return;
        if (lastX != null) {
          var dx = Math.abs(a.x - lastX);
          var dy = Math.abs(a.y - lastY);
          var dz = Math.abs(a.z - lastZ);
          if (dx + dy + dz > THRESHOLD) {
            var now = Date.now();
            if (now - lastShake > 1500 && !self.visits.shaking && !self.drawer.open) {
              lastShake = now;
              self.shakeForMuseum({ fast: true });
            }
          }
        }
        lastX = a.x; lastY = a.y; lastZ = a.z;
      }
      // iOS 13+ requires permission gesture
      var DM = window.DeviceMotionEvent;
      if (typeof DM.requestPermission === 'function') {
        // Defer permission request until first user interaction (FAB tap will explicitly request).
        this._motionNeedsPermission = true;
        this._enableMotion = function() {
          DM.requestPermission().then(function(state){
            if (state === 'granted') window.addEventListener('devicemotion', onMotion);
          }).catch(function(){});
        };
      } else {
        window.addEventListener('devicemotion', onMotion);
      }
    },

    async loadCachedReview() {
      try {
        var res = await fetch('/api/visits/review');
        if (!res.ok) return;
        var j = await res.json();
        if (j && j.summary) {
          this.visits.review = j.summary;
          this.visits.reviewStale = !!j.stale;
          this.visits.reviewGeneratedAt = j.generatedAt || 0;
        }
      } catch(_) {}
    },

    /** Reactive accessor used in drawer template. Returns the per-dynasty review state. */
    dynastyReviewState(id) {
      if (!id) return { summary: '', loading: false, exporting: false, stale: false, relevantVisitCount: 0, totalRelevant: 0 };
      if (!this.dynastyReviews[id]) {
        this.dynastyReviews[id] = { summary: '', loading: false, exporting: false, stale: false, relevantVisitCount: 0, totalRelevant: 0, generatedAt: 0 };
      }
      return this.dynastyReviews[id];
    },

    async fetchDynastyReview(id) {
      if (this.isReadOnly) return; // already injected from viewingProfile.dynastyReviews
      var s = this.dynastyReviewState(id);
      try {
        var res = await fetch('/api/dynasties/' + encodeURIComponent(id) + '/review');
        if (!res.ok) return;
        var j = await res.json();
        s.summary = j.summary || '';
        s.relevantVisitCount = (j.currentCount != null) ? j.currentCount : (j.count || 0);
        s.totalRelevant = j.totalRelevant || 0;
        s.stale = !!j.stale;
        s.generatedAt = j.generatedAt || 0;
      } catch(_) {}
    },

    async loadDynastyReview(id) {
      var s = this.dynastyReviewState(id);
      if (s.loading || s.relevantVisitCount === 0) return;
      s.loading = true;
      try {
        var res = await fetch('/api/dynasties/' + encodeURIComponent(id) + '/review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          var err = await res.json().catch(function(){return {};});
          s.summary = '（生成失败：' + (err.error || ('http ' + res.status)) + '）';
        } else {
          var j = await res.json();
          s.summary = j.summary || '（暂无足迹）';
          s.stale = false;
          s.generatedAt = Date.now();
          if (j.totalRelevant != null) s.totalRelevant = j.totalRelevant;
          if (j.count != null) s.relevantVisitCount = j.count;
        }
      } catch(e) {
        s.summary = '（出错：' + (e.message || 'unknown') + '）';
      } finally {
        s.loading = false;
      }
    },

    async loadFootprintReview() {
      if (this.visits.reviewLoading) return;
      this.visits.reviewLoading = true;
      var chatHistory = [];
      if (this.visits.chatStartIdx >= 0 && this.chat.messages.length > this.visits.chatStartIdx) {
        chatHistory = this.chat.messages.slice(this.visits.chatStartIdx).map(function(m){
          return { role: m.role, content: m.content };
        });
      }
      try {
        var res = await fetch('/api/visits/review', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chatHistory: chatHistory }),
        });
        if (!res.ok) {
          var err = await res.json().catch(function(){return {};});
          this.visits.review = '（生成失败：' + (err.error || ('http ' + res.status)) + '）';
        } else {
          var j = await res.json();
          this.visits.review = j.summary || '（暂无足迹）';
          this.visits.chatDirty = false;
          this.visits.reviewStale = false;
          this.visits.reviewGeneratedAt = Date.now();
        }
      } catch (e) {
        this.visits.review = '（出错：' + (e.message || 'unknown') + '）';
      } finally {
        this.visits.reviewLoading = false;
      }
    },

    buildFootprintPoster() {
      var self = this;
      function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      var visited = this.visitedMuseums();
      var dyns = this.visitedDynasties();
      var now = new Date();
      var dateStr = now.getFullYear() + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + String(now.getDate()).padStart(2,'0');
      var reviewHtml = (window.MuseumChat && window.MuseumChat.renderMarkdown)
        ? window.MuseumChat.renderMarkdown(this.visits.review || '')
        : esc(this.visits.review || '');

      var dynChips = dyns.map(function(d){
        return '<span style="display:inline-block;font-family:\\'Noto Serif SC\\',serif;font-size:13px;color:#B73E18;border:0.5px solid #B73E18;padding:3px 10px;margin:0 6px 6px 0;border-radius:1px;">' + esc(self.dynastyShortName(d)) + '</span>';
      }).join('');

      var cards = visited.map(function(m, i){
        var idx = String(i+1).padStart(2,'0');
        var visit = self.visits.byId[m.id] || {};
        var when = visit.visitedAt ? new Date(visit.visitedAt).toLocaleDateString('zh-CN') : '';
        var connections = (m.dynastyConnections || []).slice(0, 3).map(function(c){
          return '<span style="color:#B73E18;font-weight:600;margin-right:6px;">' + esc(c.dynasty) + '</span>';
        }).join('');
        var treasures = (m.treasures || []).slice(0, 2);
        return '<div style="display:flex;gap:18px;padding:18px 0;border-bottom:0.5px solid #d8cfbb;">'
          + '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:11px;color:#B73E18;letter-spacing:0.1em;min-width:32px;padding-top:4px;">' + idx + '</div>'
          + '<div style="flex:1;min-width:0;">'
          +   '<div style="font-family:\\'Noto Serif SC\\',serif;font-size:18px;font-weight:600;color:#2a2520;margin-bottom:4px;">' + esc(m.name) + '</div>'
          +   '<div style="font-size:12px;color:#7a7268;margin-bottom:8px;">' + esc(m.location || '') + (m.level ? ' · ' + esc(m.level) : '') + (when ? ' · 打卡 ' + when : '') + '</div>'
          +   (m.corePeriod ? '<div style="font-size:13px;color:#5a544c;font-style:italic;margin-bottom:6px;">' + esc(m.corePeriod) + '</div>' : '')
          +   (connections ? '<div style="font-size:12px;margin-bottom:6px;">' + connections + '</div>' : '')
          +   (treasures.length ? '<div style="font-size:12px;color:#5a544c;">镇馆：' + treasures.map(esc).join(' · ') + '</div>' : '')
          + '</div>'
        + '</div>';
      }).join('');

      return ''
        + '<div style="border-bottom:1px solid #2a2520;padding-bottom:24px;margin-bottom:24px;">'
        +   '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#B73E18;margin-bottom:12px;">Vol. FP · My Footprints · ' + dateStr + '</div>'
        +   '<div style="font-family:\\'Noto Serif SC\\',serif;font-size:42px;font-weight:700;color:#2a2520;line-height:1.1;margin-bottom:8px;">我的博物馆足迹</div>'
        +   '<div style="font-family:\\'Source Serif 4\\',serif;font-style:italic;color:#7a7268;font-size:15px;">An atlas of personal pilgrimage · ' + visited.length + ' institutions across ' + dyns.length + ' dynasties</div>'
        + '</div>'
        + (dynChips ? '<div style="margin-bottom:24px;">' + dynChips + '</div>' : '')
        + (this.visits.review ? '<div style="background:#f0e9d8;border-left:3px solid #B73E18;padding:20px 24px;margin-bottom:32px;font-family:\\'Source Serif 4\\',\\'Noto Serif SC\\',serif;font-size:14px;line-height:1.7;color:#2a2520;">'
            + '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#B73E18;margin-bottom:10px;">AI Review · 品味画像</div>'
            + '<div class="md-export">' + reviewHtml + '</div>'
            + '</div>' : '')
        + '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#7a7268;margin-bottom:8px;">Index · 已访博物馆</div>'
        + '<div>' + cards + '</div>'
        + (function(){
            var shareUrl = location.origin + location.pathname;
            var qrDataUrl = self.makeQrDataUrl(shareUrl);
            return '<div style="margin-top:32px;padding-top:18px;border-top:0.5px solid #d8cfbb;display:flex;align-items:center;gap:18px;">'
              + (qrDataUrl ? '<img src="' + qrDataUrl + '" alt="QR" style="width:88px;height:88px;display:block;flex-shrink:0;image-rendering:pixelated;"/>' : '')
              + '<div style="flex:1;font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.2em;color:#7a7268;">'
              +   '<div style="text-transform:uppercase;">Scan · 扫码访问</div>'
              +   '<div style="margin-top:6px;font-size:11px;letter-spacing:0;color:#5a544c;text-transform:none;font-family:\\'Source Serif 4\\',serif;font-style:italic;">中國博物館地圖</div>'
              +   '<div style="margin-top:4px;font-size:9px;letter-spacing:0.05em;color:#9a9285;text-transform:none;word-break:break-all;">' + esc(shareUrl) + '</div>'
              + '</div>'
              + '</div>';
          })();
    },

    continueChatFromFootprint() {
      var visited = this.visitedMuseums();
      var names = visited.map(function(m){ return '**' + m.name + '**'; }).join('、');
      var dyns = this.visitedDynasties().map(function(d){ return d.name; }).join('、');
      var header = '### 💬 接续聊天 · 你的足迹\\n\\n共 **' + visited.length + '** 座' + (dyns ? '，覆盖朝代：' + dyns : '') + '。' + (names ? '\\n\\n已打卡：' + names : '');
      var review = (this.visits.review || '').trim();
      var prompt = '\\n\\n---\\n\\n你想深入哪个方向？例如：\\n- 想看更多 **某朝代/某文物类别** 的博物馆\\n- 安排一条**跨城路线**（说出你所在城市）\\n- 针对某座推荐馆，告诉你**必看展厅与镇馆之宝**\\n- 再补 **3 座小众但有特色** 的备选';
      var combined = header + (review ? '\\n\\n' + review : '') + prompt;
      this.chat.messages.push({ role: 'assistant', content: combined });
      this.visits.chatStartIdx = this.chat.messages.length; // turns AFTER this seed are the new context
      this.visits.chatDirty = false;
      // Close other overlays so the chat panel isn't covered
      this.tocOpen = false;
      this.drawer.open = false;
      this.chat.open = true;
      this.chat.input = '';
      var self = this;
      setTimeout(function(){
        var el = document.querySelector('[data-chat-input]');
        if (el) el.focus();
        var body = document.querySelector('.chat-body');
        if (body) body.scrollTop = body.scrollHeight;
      }, 120);
    },

    async captureMapImage(dynasty) {
      // Capture leaflet map container, fit to dynasty's relevant museum points
      // so they fill ~90% of the visible area (5% padding each side).
      if (typeof window.html2canvas !== 'function') return null;
      var el = document.getElementById('map');
      if (!el || !window.MuseumMap || !window.MuseumMap.map) return null;
      var map = window.MuseumMap.map;
      var prevView = { center: map.getCenter(), zoom: map.getZoom() };
      var prevSnap = map.options.zoomSnap;
      try {
        // Force size recalc — drawer may have just closed and CSS transition may not be done.
        map.invalidateSize(false);
        await new Promise(function(r){ setTimeout(r, 250); });
        map.invalidateSize(false);
        await new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); });
        if (dynasty) {
          var pts = [];
          var museumById = {};
          this.museums.forEach(function(m){ museumById[m.id] = m; });
          var seen = {};
          (dynasty.recommendedMuseums || []).concat(dynasty.relatedMuseums || []).forEach(function(r){
            if (!r.museumId || seen[r.museumId]) return;
            seen[r.museumId] = true;
            var m = museumById[r.museumId];
            if (m && m.lat && m.lng) pts.push(window.toMapCoord(m.lat, m.lng));
          });
          if (pts.length > 0) {
            map.options.zoomSnap = 0;
            var size = map.getSize();
            if (pts.length === 1) {
              map.setView(pts[0], 8, { animate: false });
            } else {
              var llBounds = L.latLngBounds(pts.map(function(p){ return L.latLng(p[0], p[1]); }));
              var padX = Math.max(20, Math.round(size.x * 0.05));
              var padY = Math.max(20, Math.round(size.y * 0.05));
              map.fitBounds(llBounds, {
                paddingTopLeft: [padX, padY],
                paddingBottomRight: [padX, padY],
                animate: false,
                maxZoom: 13,
              });
            }
            // Let pane transforms settle.
            await new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); });
          }
        }
        // Wait for tiles to actually finish loading. Leaflet map "load" event is
        // for map init, not tiles — we need the tileLayer load event which fires
        // when there are no more pending tile requests.
        await new Promise(function(resolve){
          var done = false;
          var finish = function(){ if (done) return; done = true; resolve(); };
          var tileLayer = window.MuseumMap && window.MuseumMap.tileLayer;
          var timer = setTimeout(finish, 4000); // hard ceiling
          if (tileLayer && typeof tileLayer.isLoading === 'function' && !tileLayer.isLoading()) {
            // No pending tiles — give one rAF for paint, done.
            clearTimeout(timer);
            requestAnimationFrame(function(){ requestAnimationFrame(finish); });
            return;
          }
          if (tileLayer && tileLayer.once) {
            tileLayer.once('load', function(){
              clearTimeout(timer);
              // Two rAFs after tile load to ensure all tile <img> elements have painted.
              requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(finish, 100); }); });
            });
          } else {
            // Fallback: just wait the full ceiling.
          }
        });
        // Final invalidateSize right before capture in case anything shifted.
        map.invalidateSize(false);
        await new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(r); }); });
        var canvas = await window.html2canvas(el, {
          useCORS: true, allowTaint: false, backgroundColor: '#fefcf6', logging: false, scale: 1.5,
        });
        return canvas.toDataURL('image/png');
      } catch(e) {
        console.warn('map capture failed', e);
        return null;
      } finally {
        try { map.options.zoomSnap = prevSnap; } catch(_) {}
        try { map.setView(prevView.center, prevView.zoom, { animate: false }); } catch(_) {}
      }
    },

    buildDynastyPoster(dynasty, mapDataUrl) {
      var self = this;
      function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      var rev = this.dynastyReviewState(dynasty.id);
      var reviewHtml = (window.MuseumChat && window.MuseumChat.renderMarkdown)
        ? window.MuseumChat.renderMarkdown(rev.summary || '')
        : esc(rev.summary || '');
      var now = new Date();
      var dateStr = now.getFullYear() + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + String(now.getDate()).padStart(2,'0');

      // Visited museums of this dynasty (for index list)
      var visitedIds = this.visits.byId || {};
      var museumById = {};
      this.museums.forEach(function(m){ museumById[m.id] = m; });
      var allRel = (dynasty.recommendedMuseums || []).concat(dynasty.relatedMuseums || []);
      var seen = {};
      var visitedItems = [];
      allRel.forEach(function(r){
        if (!r.museumId || seen[r.museumId] || !visitedIds[r.museumId]) return;
        seen[r.museumId] = true;
        var m = museumById[r.museumId];
        if (m) visitedItems.push({ m: m, reason: r.reason || '' });
      });

      var cards = visitedItems.map(function(v, i){
        var m = v.m;
        var idx = String(i+1).padStart(2,'0');
        var visit = self.visits.byId[m.id] || {};
        var when = visit.visitedAt ? new Date(visit.visitedAt).toLocaleDateString('zh-CN') : '';
        return '<div style="display:flex;gap:18px;padding:16px 0;border-bottom:0.5px solid #d8cfbb;">'
          + '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:11px;color:#B73E18;letter-spacing:0.1em;min-width:32px;padding-top:4px;">' + idx + '</div>'
          + '<div style="flex:1;min-width:0;">'
          +   '<div style="font-family:\\'Noto Serif SC\\',serif;font-size:17px;font-weight:600;color:#2a2520;margin-bottom:3px;">' + esc(m.name) + '</div>'
          +   '<div style="font-size:12px;color:#7a7268;margin-bottom:4px;">' + esc(m.location || '') + (m.level ? ' · ' + esc(m.level) : '') + (when ? ' · 打卡 ' + when : '') + '</div>'
          +   (v.reason ? '<div style="font-size:13px;color:#5a544c;line-height:1.55;">' + esc(v.reason) + '</div>' : '')
          + '</div>'
        + '</div>';
      }).join('');

      var mapBlock = mapDataUrl
        ? '<div style="margin:24px 0 28px;border:0.5px solid #d8cfbb;background:#fff;"><img src="' + mapDataUrl + '" style="display:block;width:100%;height:auto;"/></div>'
        : '';

      var shareUrl = location.origin + location.pathname + '#/d/' + encodeURIComponent(dynasty.id);
      var qrDataUrl = this.makeQrDataUrl(shareUrl);

      return ''
        + '<div style="border-bottom:1px solid #2a2520;padding-bottom:24px;margin-bottom:24px;">'
        +   '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#B73E18;margin-bottom:12px;">Vol. D · Dynasty Review · ' + dateStr + '</div>'
        +   '<div style="font-family:\\'Noto Serif SC\\',serif;font-size:38px;font-weight:700;color:#2a2520;line-height:1.15;margin-bottom:8px;">' + esc(dynasty.name) + '</div>'
        +   (dynasty.period ? '<div style="font-family:\\'Source Serif 4\\',serif;font-style:italic;color:#7a7268;font-size:14px;">' + esc(dynasty.period) + '</div>' : '')
        +   '<div style="font-family:\\'Source Serif 4\\',serif;color:#5a544c;font-size:14px;margin-top:10px;">已踏访 <strong style="color:#B73E18;">' + rev.relevantVisitCount + '</strong> / ' + rev.totalRelevant + ' 座该朝代相关馆</div>'
        + '</div>'
        + mapBlock
        + (rev.summary ? '<div style="background:#f0e9d8;border-left:3px solid #B73E18;padding:20px 24px;margin-bottom:32px;font-family:\\'Source Serif 4\\',\\'Noto Serif SC\\',serif;font-size:14px;line-height:1.7;color:#2a2520;">'
            + '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#B73E18;margin-bottom:10px;">AI Review · 朝代评价</div>'
            + '<div class="md-export">' + reviewHtml + '</div>'
            + '</div>' : '')
        + (cards ? '<div style="font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#7a7268;margin-bottom:8px;">Index · 我已踏访</div><div>' + cards + '</div>' : '')
        + '<div style="margin-top:32px;padding-top:18px;border-top:0.5px solid #d8cfbb;display:flex;align-items:center;gap:18px;">'
        +   (qrDataUrl ? '<img src="' + qrDataUrl + '" alt="QR" style="width:88px;height:88px;display:block;flex-shrink:0;image-rendering:pixelated;"/>' : '')
        +   '<div style="flex:1;font-family:\\'JetBrains Mono\\',monospace;font-size:10px;letter-spacing:0.2em;color:#7a7268;">'
        +     '<div style="text-transform:uppercase;">Scan · 扫码访问</div>'
        +     '<div style="margin-top:6px;font-size:11px;letter-spacing:0;color:#5a544c;text-transform:none;font-family:\\'Source Serif 4\\',serif;font-style:italic;">中國博物館地圖</div>'
        +     '<div style="margin-top:4px;font-size:9px;letter-spacing:0.05em;color:#9a9285;text-transform:none;word-break:break-all;">' + esc(shareUrl) + '</div>'
        +   '</div>'
        + '</div>';
    },

    /** Generate a QR data URL using qrcode-generator. Returns '' on failure. */
    makeQrDataUrl(text) {
      try {
        if (typeof window.qrcode !== 'function') return '';
        // typeNumber=0 lets the library auto-pick the smallest version that fits.
        var qr = window.qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        // 4-pixel module, 2-module quiet zone for crisp scanning.
        return qr.createDataURL(4, 2);
      } catch (_) { return ''; }
    },

    async exportDynastyPoster(id) {
      var rev = this.dynastyReviewState(id);
      if (rev.exporting) return;
      if (typeof window.html2canvas !== 'function') { alert('html2canvas 未加载'); return; }
      var dynasty = this.dynasties.find(function(x){ return x.id === id; });
      if (!dynasty) { alert('朝代不存在'); return; }
      rev.exporting = true;
      var prevDrawerOpen = this.drawer.open;
      try {
        // Close drawer so map gets full width for fitBounds + screenshot.
        if (prevDrawerOpen) {
          this.drawer.open = false;
          await new Promise(function(r){ setTimeout(r, 600); }); // CSS transition + leaflet resize
          if (window.MuseumMap && window.MuseumMap.map) window.MuseumMap.map.invalidateSize(false);
          await new Promise(function(r){ setTimeout(r, 200); });
        }
        var mapDataUrl = await this.captureMapImage(dynasty);
        var poster = document.getElementById('dynasty-poster');
        if (!poster) { alert('poster 容器缺失'); return; }
        poster.innerHTML = this.buildDynastyPoster(dynasty, mapDataUrl);
        var style = document.createElement('style');
        style.textContent = '#dynasty-poster .md-export h1,#dynasty-poster .md-export h2,#dynasty-poster .md-export h3{font-family:"Noto Serif SC",serif;font-weight:700;color:#2a2520;margin:14px 0 6px;}#dynasty-poster .md-export h2{font-size:18px;}#dynasty-poster .md-export h3{font-size:15px;}#dynasty-poster .md-export p{margin:6px 0;}#dynasty-poster .md-export strong{color:#B73E18;}#dynasty-poster .md-export ul,#dynasty-poster .md-export ol{padding-left:22px;margin:6px 0;}#dynasty-poster .md-export li{margin:3px 0;}#dynasty-poster .md-export em{font-style:italic;color:#5a544c;}';
        poster.appendChild(style);
        await new Promise(function(r){ setTimeout(r, 60); });
        var canvas = await window.html2canvas(poster, { scale: 2, backgroundColor: '#fefcf6', useCORS: true, logging: false, windowWidth: 760 });
        var blob = await new Promise(function(r){ canvas.toBlob(r, 'image/png'); });
        if (!blob) { alert('导出失败'); return; }
        var now = new Date();
        var fname = 'dynasty-' + id + '-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '.png';
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
        poster.innerHTML = '';
      } catch (e) {
        alert('导出出错：' + (e.message || 'unknown'));
      } finally {
        rev.exporting = false;
        if (prevDrawerOpen) {
          this.drawer.open = true;
          if (window.MuseumMap && window.MuseumMap.map) {
            setTimeout(function(){ window.MuseumMap.map.invalidateSize(); }, 350);
          }
        }
      }
    },

    async exportFootprint() {
      if (this.visits.exporting) return;
      if (typeof window.html2canvas !== 'function') {
        alert('html2canvas 未加载');
        return;
      }
      this.visits.exporting = true;
      try {
        var poster = document.getElementById('footprint-poster');
        if (!poster) { alert('poster 容器缺失'); return; }
        poster.innerHTML = this.buildFootprintPoster();
        // Style markdown inside the export bubble
        var style = document.createElement('style');
        style.textContent = '#footprint-poster .md-export h1,#footprint-poster .md-export h2,#footprint-poster .md-export h3{font-family:"Noto Serif SC",serif;font-weight:700;color:#2a2520;margin:14px 0 6px;}#footprint-poster .md-export h2{font-size:18px;}#footprint-poster .md-export h3{font-size:15px;}#footprint-poster .md-export p{margin:6px 0;}#footprint-poster .md-export strong{color:#B73E18;}#footprint-poster .md-export ul,#footprint-poster .md-export ol{padding-left:22px;margin:6px 0;}#footprint-poster .md-export li{margin:3px 0;}#footprint-poster .md-export em{font-style:italic;color:#5a544c;}';
        poster.appendChild(style);
        // Wait a tick for layout
        await new Promise(function(r){ setTimeout(r, 60); });
        var canvas = await window.html2canvas(poster, {
          scale: 2,
          backgroundColor: '#fefcf6',
          useCORS: true,
          logging: false,
          windowWidth: 760,
        });
        var blob = await new Promise(function(r){ canvas.toBlob(r, 'image/png'); });
        if (!blob) { alert('导出失败'); return; }
        var now = new Date();
        var fname = 'footprint-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '.png';
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
        poster.innerHTML = '';
      } catch (e) {
        alert('导出出错：' + (e && e.message || 'unknown'));
      } finally {
        this.visits.exporting = false;
      }
    },

    onDrawerClick(e) {
      var visitBtn = e.target.closest && e.target.closest('.visit-toggle');
      if (visitBtn) {
        var vid = visitBtn.getAttribute('data-museum-id');
        if (vid) this.toggleVisit(vid);
        return;
      }
      var el = e.target.closest && e.target.closest('.dynasty-rec');
      if (!el) return;
      var id = el.getAttribute('data-museum-id');
      if (id) this.openMuseum(id);
    },

    buildMuseumSections(m) {
      var sections = [];
      function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
      var visited = !!this.visits.byId[m.id];
      var when = visited && this.visits.byId[m.id].visitedAt ? new Date(this.visits.byId[m.id].visitedAt).toLocaleDateString() : '';
      var label = visited ? '✓ 已打卡 · ' + when + '（点击撤销）' : '＋ 打卡 · 我去过';
      sections.push({
        title: 'Visit · 足迹',
        html: '<button class="visit-toggle" data-museum-id="' + escapeHtml(m.id) + '" style="font-family:var(--sans);font-size:11px;letter-spacing:0.18em;text-transform:uppercase;padding:10px 16px;border:0.5px solid ' + (visited ? 'var(--ink)' : 'var(--vermilion)') + ';background:' + (visited ? 'var(--ink)' : 'transparent') + ';color:' + (visited ? 'var(--paper)' : 'var(--vermilion)') + ';cursor:pointer;">' + label + '</button>',
      });
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
          var imgBlock = '';
          if (a.image) {
            var att = a.imageAttribution ? escapeHtml(a.imageAttribution) : '';
            var lic = a.imageLicense ? escapeHtml(a.imageLicense) : '';
            var caption = [att, lic].filter(Boolean).join(' · ');
            imgBlock = '<div class="artifact-image"><img src="' + escapeHtml(a.image) + '" alt="' + escapeHtml(a.name) + '" loading="lazy">' + (caption ? '<div class="artifact-image-caption">' + caption + '</div>' : '') + '</div>';
          }
          return '<div class="artifact">' + imgBlock + '<div><span class="artifact-name">' + escapeHtml(a.name) + '</span>' + (a.period ? '<span class="artifact-period">' + escapeHtml(a.period) + '</span>' : '') + '</div><div class="artifact-desc">' + escapeHtml(a.description || '') + '</div></div>';
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

    async ensureAdminToken() {
      var token = window.localStorage.getItem('museumAdminToken');
      if (!token) {
        token = window.prompt('管理员令牌 (Admin token)') || '';
        if (!token) return null;
        window.localStorage.setItem('museumAdminToken', token);
      }
      return token;
    },

    async sendChat() {
      var text = (this.chat.input || '').trim();
      if (!text || this.chat.loading) return;
      this.chat.messages.push({ role: 'user', content: text });
      if (this.visits.chatStartIdx >= 0) this.visits.chatDirty = true;
      this.chat.input = '';
      this.chat.loading = true;
      try {
        if (text === '/help') {
          this.chat.messages.push({ role: 'assistant', content: '可用命令：\\n- /import <博物馆名称>：导入新博物馆\\n- /pending：查看暂存列表\\n- /review <id>：AI 评分某条暂存记录\\n- /approve <id>：通过暂存并**发布到正库**\\n- /reject <id>：拒绝暂存（不影响正库）\\n- /delete <id>：删除暂存记录（不影响正库）\\n- /unpublish <id>：从正库下架（不影响 pending）\\n- /enrich-images <id>：为正库博物馆的文物补图（Wikidata + Wikimedia）' });
          return;
        }
        if (text.indexOf('/import ') === 0 || text === '/import') {
          var query = text.replace(/^\\/import\\s*/, '').trim();
          if (!query) {
            this.chat.messages.push({ role: 'assistant', content: '用法：/import <博物馆名称>' });
            return;
          }
          var token = await this.ensureAdminToken();
          if (!token) {
            this.chat.messages.push({ role: 'assistant', content: '已取消。' });
            return;
          }
          var idx = this.chat.messages.length;
          this.chat.messages.push({ role: 'assistant', content: '🤖 启动 agent…' });
          var self = this;
          try {
            await window.MuseumChat.runImport(query, token, function(line) {
              var prev = self.chat.messages[idx].content || '';
              self.chat.messages[idx].content = prev + '\\n' + line;
            });
          } catch (e) {
            if (e && e.status === 401) {
              window.localStorage.removeItem('museumAdminToken');
            }
            self.chat.messages[idx].content += '\\n（出错：' + (e.message || 'unknown') + '）';
          }
          return;
        }
        if (text === '/pending' || text.indexOf('/pending ') === 0) {
          var token2 = await this.ensureAdminToken();
          if (!token2) { this.chat.messages.push({ role: 'assistant', content: '已取消。' }); return; }
          try {
            var list = await window.MuseumChat.listPending(token2);
            if (!list.items.length) {
              this.chat.messages.push({ role: 'assistant', content: '📋 暂无暂存记录。' });
            } else {
              var lines = ['### 📋 暂存列表 (' + list.items.length + ')', ''];
              for (var i = 0; i < list.items.length; i++) {
                var it = list.items[i];
                var emoji = it.verdict === 'excellent' ? '🟢' : it.verdict === 'good' ? '🟢' : it.verdict === 'acceptable' ? '🟡' : it.verdict === 'reject' ? '🔴' : '🟠';
                lines.push('- ' + emoji + ' **' + it.name + '** (' + it.overall + '/100, ' + it.verdict + ') · ' + (it.status || 'pending'));
                lines.push('  - id: \`' + it.id + '\`  来源:' + it.sources + '  ' + (it.level || ''));
                lines.push('  - 操作：\`/review ' + it.id + '\` · \`/approve ' + it.id + '\` · \`/reject ' + it.id + '\` · \`/delete ' + it.id + '\`');
              }
              lines.push('');
              lines.push('提示：点击命令文本可手动复制，或输入 / 唤出命令面板。');
              this.chat.messages.push({ role: 'assistant', content: lines.join('\\n') });
            }
          } catch (e) {
            if (e && e.status === 401) window.localStorage.removeItem('museumAdminToken');
            this.chat.messages.push({ role: 'assistant', content: '（出错：' + (e.message || 'unknown') + '）' });
          }
          return;
        }
        if (text.indexOf('/review ') === 0 || text === '/review') {
          var id = text.replace(/^\\/review\\s*/, '').trim();
          if (!id) {
            this.chat.messages.push({ role: 'assistant', content: '用法：/review <id>（先用 /pending 查 id）' });
            return;
          }
          var token3 = await this.ensureAdminToken();
          if (!token3) { this.chat.messages.push({ role: 'assistant', content: '已取消。' }); return; }
          this.chat.messages.push({ role: 'assistant', content: '🔎 评估中…' });
          var lastIdx = this.chat.messages.length - 1;
          try {
            var detail = await window.MuseumChat.reviewPending(id, token3);
            this.chat.messages[lastIdx].content = window.MuseumChat.formatReview(detail);
          } catch (e) {
            if (e && e.status === 401) window.localStorage.removeItem('museumAdminToken');
            this.chat.messages[lastIdx].content = '（出错：' + (e.message || 'unknown') + '）';
          }
          return;
        }
        var actionMatch = text.match(/^\\/(approve|reject|delete|unpublish)\\s+(.+)$/);
        if (text.indexOf('/enrich-images ') === 0 || text === '/enrich-images') {
          var enrichId = text.replace(/^\\/enrich-images\\s*/, '').trim();
          if (!enrichId) {
            this.chat.messages.push({ role: 'assistant', content: '用法：/enrich-images <museum-id>' });
            return;
          }
          var tokenE = await this.ensureAdminToken();
          if (!tokenE) { this.chat.messages.push({ role: 'assistant', content: '已取消。' }); return; }
          var idxE = this.chat.messages.length;
          this.chat.messages.push({ role: 'assistant', content: '🖼️ 启动图片采编…' });
          var selfE = this;
          try {
            await window.MuseumChat.runEnrichImages(enrichId, tokenE, function(line) {
              var prev = selfE.chat.messages[idxE].content || '';
              selfE.chat.messages[idxE].content = prev + '\\n' + line;
            });
          } catch (e) {
            if (e && e.status === 401) window.localStorage.removeItem('museumAdminToken');
            selfE.chat.messages[idxE].content += '\\n（出错：' + (e.message || 'unknown') + '）';
          }
          return;
        }
        if (actionMatch) {
          var action = actionMatch[1];
          var actId = actionMatch[2].trim();
          var tokenA = await this.ensureAdminToken();
          if (!tokenA) { this.chat.messages.push({ role: 'assistant', content: '已取消。' }); return; }
          try {
            var fn = action === 'approve' ? window.MuseumChat.approvePending
                   : action === 'reject' ? window.MuseumChat.rejectPending
                   : action === 'delete' ? window.MuseumChat.deletePending
                   : window.MuseumChat.unpublishMuseum;
            await fn(actId, tokenA);
            var emojiA = action === 'approve' ? '✅' : action === 'reject' ? '🚫' : action === 'delete' ? '🗑️' : '📤';
            this.chat.messages.push({ role: 'assistant', content: emojiA + ' ' + action + ' ' + actId });
          } catch (e) {
            if (e && e.status === 401) window.localStorage.removeItem('museumAdminToken');
            this.chat.messages.push({ role: 'assistant', content: '（出错：' + (e.message || 'unknown') + '）' });
          }
          return;
        }
        var streamIdx = this.chat.messages.length;
        this.chat.messages.push({ role: 'assistant', content: '' });
        var self2 = this;
        try {
          await window.MuseumChat.sendStream(this.chat.messages.slice(0, streamIdx).slice(-10), function(delta){
            self2.chat.messages[streamIdx].content += delta;
            // keep scrolled to bottom while streaming
            var body = document.querySelector('.chat-body');
            if (body) body.scrollTop = body.scrollHeight;
          });
        } catch (e) {
          self2.chat.messages[streamIdx].content = (self2.chat.messages[streamIdx].content || '') + '\\n（出错：' + (e.message || 'unknown') + '）';
        }
      } catch (e) {
        this.chat.messages.push({ role: 'assistant', content: '（出错：' + (e.message || 'unknown') + '）' });
      } finally {
        this.chat.loading = false;
      }
    },
  };
};
`
