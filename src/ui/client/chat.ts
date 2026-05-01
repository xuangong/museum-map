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
  }
};
`
