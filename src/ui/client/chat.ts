export const CHAT_SCRIPT = `
window.MuseumChat = {
  send: async function(messages) {
    var res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: messages, system: '你是中国历史顾问，回答简短、引用具体朝代或博物馆。' }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function(){return {};});
      throw new Error(err.error || ('http ' + res.status));
    }
    var data = await res.json();
    if (data && Array.isArray(data.content) && data.content[0] && data.content[0].text) {
      return data.content[0].text;
    }
    return JSON.stringify(data);
  },

  runImport: async function(query, token, onLine) {
    var res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ query: query }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function(){return {};});
      var e = new Error(err.error || ('http ' + res.status));
      e.status = res.status;
      throw e;
    }
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    while (true) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var lines = buf.split('\\n');
      buf = lines.pop() || '';
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        try {
          var ev = JSON.parse(line);
          onLine(ev.message || JSON.stringify(ev));
        } catch (_) {
          onLine(line);
        }
      }
    }
    if (buf.trim()) {
      try { onLine(JSON.parse(buf).message || buf); } catch (_) { onLine(buf); }
    }
  },

  listPending: async function(token) {
    var res = await fetch('/api/pending', { headers: { 'x-admin-token': token } });
    if (!res.ok) {
      var err = await res.json().catch(function(){return {};});
      var e = new Error(err.error || ('http ' + res.status));
      e.status = res.status;
      throw e;
    }
    return await res.json();
  },

  reviewPending: async function(id, token) {
    var res = await fetch('/api/pending/' + encodeURIComponent(id), { headers: { 'x-admin-token': token } });
    if (!res.ok) {
      var err = await res.json().catch(function(){return {};});
      var e = new Error(err.error || ('http ' + res.status));
      e.status = res.status;
      throw e;
    }
    return await res.json();
  },

  approvePending: async function(id, token) {
    var res = await fetch('/api/pending/' + encodeURIComponent(id) + '/approve', {
      method: 'POST', headers: { 'x-admin-token': token, 'content-type': 'application/json' }, body: '{}',
    });
    if (!res.ok) { var err = await res.json().catch(function(){return {};}); var e = new Error(err.error || ('http ' + res.status)); e.status = res.status; throw e; }
    return await res.json();
  },

  rejectPending: async function(id, token) {
    var res = await fetch('/api/pending/' + encodeURIComponent(id) + '/reject', {
      method: 'POST', headers: { 'x-admin-token': token, 'content-type': 'application/json' }, body: '{}',
    });
    if (!res.ok) { var err = await res.json().catch(function(){return {};}); var e = new Error(err.error || ('http ' + res.status)); e.status = res.status; throw e; }
    return await res.json();
  },

  deletePending: async function(id, token) {
    var res = await fetch('/api/pending/' + encodeURIComponent(id), {
      method: 'DELETE', headers: { 'x-admin-token': token },
    });
    if (!res.ok) { var err = await res.json().catch(function(){return {};}); var e = new Error(err.error || ('http ' + res.status)); e.status = res.status; throw e; }
    return await res.json();
  },

  unpublishMuseum: async function(id, token) {
    var res = await fetch('/api/museums/' + encodeURIComponent(id) + '/unpublish', {
      method: 'POST', headers: { 'x-admin-token': token, 'content-type': 'application/json' }, body: '{}',
    });
    if (!res.ok) { var err = await res.json().catch(function(){return {};}); var e = new Error(err.error || ('http ' + res.status)); e.status = res.status; throw e; }
    return await res.json();
  },

  formatReview: function(d) {
    var p = d.payload || {};
    var r = d.review || {};
    var prov = d.provenance || {};
    var emoji = r.verdict === 'excellent' ? '🟢' : r.verdict === 'good' ? '🟢' : r.verdict === 'acceptable' ? '🟡' : r.verdict === 'reject' ? '🔴' : '🟠';
    function host(u){ try { return new URL(u).host.replace(/^www\\./,''); } catch(_) { return u || ''; } }
    function sb(url){ return url ? ' \`[' + host(url) + ']\`' : ''; }
    var lines = [];
    lines.push('### ' + emoji + ' ' + (p.name || d.query) + ' — ' + r.overall + '/100 (' + r.verdict + ')');
    lines.push('');
    lines.push('**评分** · 完整度 ' + r.completeness + ' · 丰富度 ' + r.richness + ' · 信源 ' + r.sourceAuthority);
    lines.push('');
    if (r.comment) { lines.push('> ' + r.comment); lines.push(''); }
    lines.push('**基本信息**');
    lines.push('- 等级：' + (p.level || '—') + sb(prov.level));
    lines.push('- 地址：' + (p.location || '—') + sb(prov.location));
    lines.push('- 坐标：' + (p.lat != null ? p.lat + ', ' + p.lng : '—') + sb(prov.lat || prov.lng));
    lines.push('- 核心年代：' + (p.corePeriod || '—') + sb(prov.corePeriod));
    lines.push('- 朝代覆盖：' + (p.dynastyCoverage || '—') + sb(prov.dynastyCoverage));
    lines.push('');
    lines.push('**展厅 (' + (p.halls || []).length + ')**');
    (p.halls || []).forEach(function(h, i){ lines.push('- ' + h + sb((prov.halls || [])[i])); });
    lines.push('');
    lines.push('**镇馆之宝 (' + (p.treasures || []).length + ')**');
    (p.treasures || []).forEach(function(t, i){ lines.push('- ' + t + sb((prov.treasures || [])[i])); });
    lines.push('');
    lines.push('**代表文物 (' + (p.artifacts || []).length + ')**');
    (p.artifacts || []).forEach(function(a, i){ lines.push('- **' + a.name + '** ' + (a.period ? '（' + a.period + '）' : '') + (a.description ? ' — ' + a.description : '') + sb((prov.artifacts || [])[i])); });
    lines.push('');
    lines.push('**朝代关联 (' + (p.dynastyConnections || []).length + ')**');
    (p.dynastyConnections || []).forEach(function(c, i){ lines.push('- **' + c.dynasty + '** — ' + (c.description || '') + sb((prov.dynastyConnections || [])[i])); });
    lines.push('');
    lines.push('**信源** · 官方/政府/协会 ' + (r.officialSources || []).length + ' · 弱信源 ' + (r.weakSources || []).length);
    (p.sources || []).forEach(function(u){ lines.push('- ' + u); });
    if ((r.missing || []).length) {
      lines.push('');
      lines.push('**缺失字段**：' + r.missing.join('、'));
    }
    if ((r.weakSourcedFields || []).length) {
      lines.push('');
      lines.push('⚠️ **弱信源字段**：' + r.weakSourcedFields.join('、') + '（建议人工复核）');
    }
    lines.push('');
    lines.push('---');
    lines.push('**操作**：\`/approve ' + d.id + '\` · \`/reject ' + d.id + '\` · \`/delete ' + d.id + '\`');
    return lines.join('\\n');
  },

  renderMarkdown: function(src) {
    if (!src) return '';
    function esc(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    var s = esc(src);
    // Fenced code blocks
    s = s.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, function(_, code) {
      return '<pre><code>' + code.replace(/^\\n/, '') + '</code></pre>';
    });
    // Inline code (slash commands become clickable)
    s = s.replace(/\`([^\`\\n]+)\`/g, function(_, code) {
      var isCmd = /^\\s*\\//.test(code);
      if (isCmd) return '<code class="cmd" data-cmd="' + code.replace(/"/g, '&quot;') + '" title="点击填入输入框">' + code + '</code>';
      return '<code>' + code + '</code>';
    });
    // Headings (### ## #)
    s = s.replace(/^###\\s+(.+)$/gm, '<h3>$1</h3>');
    s = s.replace(/^##\\s+(.+)$/gm, '<h2>$1</h2>');
    s = s.replace(/^#\\s+(.+)$/gm, '<h1>$1</h1>');
    // Blockquote
    s = s.replace(/^&gt;\\s?(.+)$/gm, '<blockquote>$1</blockquote>');
    // Bold + italic
    s = s.replace(/\\*\\*([^*\\n]+)\\*\\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\\*([^*\\n]+)\\*/g, '$1<em>$2</em>');
    // Links [text](url)
    s = s.replace(/\\[([^\\]]+)\\]\\((https?:[^)\\s]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Lists: group consecutive lines starting with "- " or "* " or "1."
    var lines = s.split('\\n');
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (/^\\s*(?:[-*])\\s+/.test(line)) {
        var ul = ['<ul>'];
        while (i < lines.length && /^\\s*(?:[-*])\\s+/.test(lines[i])) {
          ul.push('<li>' + lines[i].replace(/^\\s*(?:[-*])\\s+/, '') + '</li>');
          i++;
        }
        ul.push('</ul>');
        out.push(ul.join(''));
      } else if (/^\\s*\\d+\\.\\s+/.test(line)) {
        var ol = ['<ol>'];
        while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) {
          ol.push('<li>' + lines[i].replace(/^\\s*\\d+\\.\\s+/, '') + '</li>');
          i++;
        }
        ol.push('</ol>');
        out.push(ol.join(''));
      } else {
        out.push(line);
        i++;
      }
    }
    s = out.join('\\n');
    // Paragraphs from blank-line separated blocks (skip block-level tags)
    var blocks = s.split(/\\n{2,}/);
    s = blocks.map(function(b) {
      var t = b.trim();
      if (!t) return '';
      if (/^<(?:h[1-6]|ul|ol|pre|blockquote)/.test(t)) return t;
      return '<p>' + t.replace(/\\n/g, '<br>') + '</p>';
    }).join('');
    return s;
  }
};
`
