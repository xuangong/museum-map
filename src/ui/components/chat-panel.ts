export const QUICK_QUESTIONS = [
  "推荐看青铜器的博物馆",
  "唐代有哪些重要事件？",
  "北京有哪些值得去的博物馆？",
]

export function ChatPanel(): string {
  return `<div class="chat-overlay" :class="chat.open ? 'open' : ''" @click="chat.open = false"></div>
<div class="chat-panel" :class="chat.open ? 'open' : ''">
  <div style="padding:14px 20px;border-bottom:0.5px solid var(--rule);display:flex;justify-content:space-between;align-items:center;">
    <h3 class="display" style="margin:0;font-size:16px;">历史顾问</h3>
    <button @click="chat.open = false" style="border:none;background:transparent;font-size:20px;cursor:pointer;">×</button>
  </div>
  <div style="flex:1;overflow-y:auto;padding:16px 20px;">
    <template x-for="(msg, i) in chat.messages" :key="i">
      <div :style="msg.role === 'user' ? 'text-align:right;margin:10px 0;' : 'text-align:left;margin:10px 0;'">
        <div style="font-size:11px;color:var(--ink-mute);" x-text="msg.role === 'user' ? '你' : '模型'"></div>
        <div style="display:inline-block;max-width:80%;padding:8px 12px;border:0.5px solid var(--rule);margin-top:2px;text-align:left;white-space:pre-wrap;" x-text="msg.content"></div>
      </div>
    </template>
    <div x-show="chat.loading" style="color:var(--ink-mute);font-size:13px;">…</div>
  </div>
  <div style="padding:8px 20px;border-top:0.5px solid var(--rule);">
    ${QUICK_QUESTIONS.map((q) => `<span class="chip" @click="chat.input='${q.replace(/'/g, "\\'")}'">${q}</span>`).join("")}
  </div>
  <div style="padding:14px 20px;display:flex;gap:12px;border-top:0.5px solid var(--rule);">
    <input class="chat-input" x-model="chat.input" @keydown.enter="sendChat()" placeholder="问我任何问题…" />
    <button @click="sendChat()" :disabled="chat.loading" style="border:none;background:transparent;color:var(--accent);font-family:var(--font-cn);cursor:pointer;font-size:15px;">发送</button>
  </div>
</div>
<button @click="chat.open = true" class="display"
  style="position:fixed;bottom:24px;right:24px;background:var(--accent);color:var(--bg);border:none;padding:12px 20px;cursor:pointer;font-size:14px;z-index:1400;">
  问 AI
</button>`
}
