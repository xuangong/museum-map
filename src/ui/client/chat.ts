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
    // Inline code
    s = s.replace(/\`([^\`\\n]+)\`/g, '<code>$1</code>');
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
