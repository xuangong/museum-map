export const APP_SCRIPT = `
window.museumApp = function() {
  return {
    museums: [],
    dynasties: [],
    search: '',
    currentDynastyId: null,
    selectedMuseumId: null,
    drawer: { open: false, loading: false, error: false, title: '', subtitle: '', sections: [], _loadFn: null },
    chat: { open: false, messages: [], input: '', loading: false, palette: { open: false, query: '' } },
    tocOpen: false,

    init() {
      var bs = document.getElementById('bootstrap-data');
      if (!bs) { console.error('bootstrap-data missing'); return; }
      var data = JSON.parse(bs.textContent);
      this.museums = data.museums;
      this.dynasties = data.dynasties;

      window.MuseumMap.init(35.0, 105.0);
      var self = this;
      this.refreshMarkers();

      // First-visit welcome message in chat
      if (!window.localStorage.getItem('museumChatWelcomed')) {
        this.chat.messages.push({
          role: 'assistant',
          content: '👋 你好！这里可以问中国历史与博物馆，也支持斜杠命令：\\n\\n- \`/import <博物馆名>\` 派 agent 抓数据并暂存\\n- \`/pending\` 查看暂存列表\\n- \`/review <id>\` AI 评分并预览\\n- \`/approve|reject|delete <id>\` 处理暂存\\n\\n💡 输入 \`/\` 唤出命令面板。',
        });
        window.localStorage.setItem('museumChatWelcomed', '1');
      }
    },

    commands: [
      { cmd: '/import ', label: '/import <博物馆名>', desc: '派 agent 抓取并暂存' },
      { cmd: '/pending', label: '/pending', desc: '查看暂存列表' },
      { cmd: '/review ', label: '/review <id>', desc: 'AI 评分 + 预览' },
      { cmd: '/approve ', label: '/approve <id>', desc: '通过暂存并发布到正库' },
      { cmd: '/reject ', label: '/reject <id>', desc: '拒绝暂存（不影响正库）' },
      { cmd: '/delete ', label: '/delete <id>', desc: '删除暂存记录（不影响正库）' },
      { cmd: '/unpublish ', label: '/unpublish <id>', desc: '从正库下架（不影响 pending）' },
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
      this.tocOpen = false;
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
      this.tocOpen = false;
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
      this.chat.input = '';
      this.chat.loading = true;
      try {
        if (text === '/help') {
          this.chat.messages.push({ role: 'assistant', content: '可用命令：\\n- /import <博物馆名称>：导入新博物馆\\n- /pending：查看暂存列表\\n- /review <id>：AI 评分某条暂存记录\\n- /approve <id>：通过暂存并**发布到正库**\\n- /reject <id>：拒绝暂存（不影响正库）\\n- /delete <id>：删除暂存记录（不影响正库）\\n- /unpublish <id>：从正库下架（不影响 pending）' });
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
