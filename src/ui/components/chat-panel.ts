export const QUICK_QUESTIONS = [
  "推荐看青铜器的博物馆",
  "唐代有哪些重要事件？",
  "北京有哪些值得去的博物馆？",
  "讲讲宋代的文化",
]

export function ChatPanel(): string {
  return `<div class="chat-overlay" :class="chat.open ? 'open' : ''" @click="chat.open = false"></div>
<div class="chat-panel" :class="(chat.open ? 'open ' : '') + (chat.fullscreen ? 'fullscreen' : '')">
  <div class="chat-head">
    <div>
      <span class="title">历史顾问</span>
      <span class="subtitle">A historian, on call.</span>
    </div>
    <div style="display:flex;gap:6px;align-items:center;">
      <button @click="chat.fullscreen = !chat.fullscreen" :title="chat.fullscreen ? '退出全屏' : '全屏阅读'" style="border:none;background:transparent;line-height:1;cursor:pointer;color:var(--ink);padding:4px 8px;display:inline-flex;align-items:center;justify-content:center;">
        <svg x-show="!chat.fullscreen" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/>
        </svg>
        <svg x-show="chat.fullscreen" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4"/>
        </svg>
      </button>
      <button @click="chat.open = false" style="border:none;background:transparent;font-family:var(--display);font-size:24px;line-height:1;cursor:pointer;color:var(--ink);">×</button>
    </div>
  </div>
  <div class="chat-body" @click="onChatBodyClick($event)">
    <div x-show="chat.messages.length === 0" style="font-family:var(--display);font-style:italic;color:var(--ink-mute);text-align:center;padding:40px 0;">
      Ask anything about Chinese history, dynasties, or museums.
    </div>
    <template x-for="(msg, i) in chat.messages" :key="i">
      <div class="chat-msg" :class="msg.role">
        <div class="who" x-text="msg.role === 'user' ? 'You · 你' : 'Consultant · 顾问'"></div>
        <div class="text" x-show="msg.role === 'user'" x-text="msg.content"></div>
        <div class="text md" x-show="msg.role !== 'user'" x-html="window.MuseumChat.renderMarkdown(msg.content)"></div>
      </div>
    </template>
    <div x-show="chat.loading" class="chat-loading">…thinking</div>
  </div>
  <div class="chat-chips">
    ${QUICK_QUESTIONS.map((q) => `<span class="chip" @click="chat.input='${q.replace(/'/g, "\\'")}'">${q}</span>`).join("")}
  </div>
  <div class="chat-input-row" style="position:relative;">
    <div class="cmd-palette" x-show="chat.palette.open" @click.outside="chat.palette.open = false" style="position:absolute;left:12px;right:12px;bottom:calc(100% + 6px);background:var(--paper);border:1px solid var(--rule);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.08);max-height:240px;overflow-y:auto;z-index:10;">
      <template x-for="(c, i) in filteredCommands" :key="i">
        <div @click="pickCommand(c)" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--rule-soft);">
          <div style="font-family:var(--mono);font-weight:600;color:var(--vermilion);" x-text="c.label"></div>
          <div style="font-size:12px;color:var(--ink-mute);" x-text="c.desc"></div>
        </div>
      </template>
      <div x-show="filteredCommands.length === 0" style="padding:10px 12px;color:var(--ink-mute);font-size:13px;">无匹配命令</div>
    </div>
    <input class="chat-input" data-chat-input x-model="chat.input" @input="onChatInput()" @keydown.enter="chat.palette.open = false; sendChat()" @keydown.escape="chat.palette.open = false" placeholder="问我任何问题，或输入 / 唤起命令…" />
    <button class="chat-send" @click="sendChat()" :disabled="chat.loading">Send</button>
  </div>
</div>
<button class="chat-fab shake-fab" @click="shakeForMuseum()" :disabled="visits.shaking" title="摇一摇，随机推荐一座没去过的博物馆">
  <span class="icon shake-icon" :class="visits.shaking ? 'spinning' : ''">🎲</span>
  <span x-show="!visits.shaking">摇一摇</span>
  <span x-show="visits.shaking">…</span>
  <span class="shake-mute" @click.stop="toggleShakeMute()" :title="visits.muted ? '点击开启音效' : '点击静音'">
    <span x-text="visits.muted ? '🔇' : '🔊'"></span>
  </span>
</button>
<button class="chat-fab" @click="chat.open = true">
  <span class="icon"></span>问 AI
</button>`
}
