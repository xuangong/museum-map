import { icon } from "../icons"

export const QUICK_QUESTIONS = [
  "沿着都城迁徙，推荐一条时间之旅",
  "我在西安有两天，怎么逛博物馆？",
  "推荐看青铜器的博物馆",
  "唐代的长安有多大？",
]

export function ChatPanel(): string {
  return `<div class="chat-overlay" :class="chat.open && !chat.mini ? 'open' : ''" @click="chat.open = false"></div>
<div class="chat-panel" :class="(chat.open ? 'open ' : '') + (chat.fullscreen ? 'fullscreen' : '') + (chat.mini && !chat.fullscreen ? ' mini' : '')" role="dialog" aria-label="AI 讲解员">
  <button type="button" class="chat-grabber" @click="sheetTap('chat')" @touchstart.passive="chatDragStart($event)" @touchmove="chatDragMove($event)" @touchend="chatDragEnd()" @touchcancel="chatDragEnd()" :aria-label="chat.mini ? '展开讲解员' : '收起讲解员'"></button>
  <header class="chat-head" @touchstart.passive="chatDragStart($event)" @touchmove="chatDragMove($event)" @touchend="chatDragEnd()" @touchcancel="chatDragEnd()">
    <div class="chat-id" @click="chat.mini && !justDragged() && (chat.mini = false)">
      <span class="chat-avatar">${icon("sparkle", 20)}</span>
      <div>
        <div class="chat-title">AI 讲解员</div>
        <div class="chat-sub">历史 · 馆藏 · 时间之旅与路线之旅</div>
      </div>
    </div>
    <div class="chat-tools">
      <div class="ai-pick" @click.outside="ai.open = false">
        <button class="icon-btn ai-tune" :class="ai.open ? 'on' : ''" @click="ai.open = !ai.open" :title="aiTip()" :aria-label="'模型与思考强度：' + aiTip()" :aria-expanded="ai.open">${icon("tune", 17)}</button>
        <div class="ai-pop" x-show="ai.open" x-cloak>
          <template x-for="g in aiFamilies()" :key="g.family">
            <div class="ai-group">
              <div class="ai-fam" x-text="g.family"></div>
              <template x-for="m in g.models" :key="m.id">
                <button type="button" class="ai-row" :class="ai.model === m.id ? 'on' : ''" @click="aiPick(m.id)">
                  <span x-text="m.label"></span><span class="ai-ck" x-show="ai.model === m.id">${icon("check", 14)}</span>
                </button>
              </template>
            </div>
          </template>
          <div class="ai-fam">思考强度</div>
          <div class="ai-efforts">
            <template x-for="e in aiEfforts()" :key="e">
              <button type="button" class="ai-eff" :class="ai.effort === e ? 'on' : ''" @click="aiSetEffort(e)" x-text="e"></button>
            </template>
          </div>
        </div>
      </div>
      <button class="icon-btn" @click="chat.fullscreen = !chat.fullscreen" :title="chat.fullscreen ? '退出全屏' : '全屏阅读'">
        <span x-show="!chat.fullscreen">${icon("expand", 17)}</span><span x-show="chat.fullscreen">${icon("collapse", 17)}</span>
      </button>
      <button class="icon-btn" @click="chat.open = false" aria-label="关闭">${icon("close", 18)}</button>
    </div>
  </header>
  <div class="chat-body" @click="onChatBodyClick($event)">
    <div class="chat-empty" x-show="chat.messages.length === 0">
      ${icon("sparkle", 30)}
      <div>问我任何关于朝代、文物与博物馆的问题。<br>也可以让我帮你排一条时间之旅或路线之旅。</div>
    </div>
    <template x-for="(msg, i) in chat.messages" :key="i">
      <div class="chat-msg" :class="msg.role" x-show="msg.role === 'user' || msg.content">
        <div class="who" x-text="msg.role === 'user' ? '你' : '讲解员'"></div>
        <div class="text" x-show="msg.role === 'user'" x-text="msg.content"></div>
        <div class="text md-rich" x-show="msg.role !== 'user'" x-html="renderChatMsg(msg.content)"></div>
        <button type="button" class="mention-btn" x-show="msg.role !== 'user' && msg.mentions && msg.mentions.length" x-cloak @click="showMentionsOnMap(msg.mentions)">${icon("pin", 14)}<span x-text="'在地图上看这 ' + (msg.mentions || []).length + ' 座'"></span></button>
      </div>
    </template>
    <div x-show="chat.loading && (chat.progress || !(chat.messages.length && chat.messages[chat.messages.length - 1].content))" class="chat-loading"><span class="dots"><i></i><i></i><i></i></span><span x-text="chat.progress || '讲解员正在思考'"></span></div>
  </div>
  <div class="chat-chips">
    ${QUICK_QUESTIONS.map((q) => `<button class="chip" @click="chat.input='${q.replace(/'/g, "\\'")}'">${q}</button>`).join("")}
  </div>
  <div class="chat-input-row">
    <div class="cmd-palette" x-show="chat.palette.open" x-cloak @click.outside="chat.palette.open = false">
      <template x-for="(c, i) in filteredCommands" :key="i">
        <div class="cmd-item" @click="pickCommand(c)">
          <div class="cmd-label" x-text="c.label"></div>
          <div class="cmd-desc" x-text="c.desc"></div>
        </div>
      </template>
      <div class="cmd-empty" x-show="filteredCommands.length === 0">无匹配命令</div>
    </div>
    <input class="chat-input" data-chat-input x-model="chat.input" @input="onChatInput()" @keydown.enter="chat.palette.open = false; sendChat()" @keydown.escape="chat.palette.open = false" placeholder="问讲解员任何问题…" />
    <button class="chat-send" @click="sendChat()" :disabled="chat.loading" aria-label="发送">${icon("arrowUp", 20)}</button>
  </div>
</div>
<nav class="dock" x-show="!drawer.open" aria-label="快捷操作">
  <button class="dock-btn dock-index" @click="tocOpen = true">${icon("index", 18)}<span>索引</span></button>
  <button class="dock-btn dock-shake" @click="shakeForMuseum()" :disabled="visits.shaking" title="随机去一座博物馆（手机可直接摇一摇）">
    <span :class="visits.shaking ? 'spin-wrap spinning' : 'spin-wrap'">${icon("dice", 18)}</span><span>摇一摇</span>
  </button>
  <button class="dock-btn dock-ai" @click="chat.open = true; chat.mini = false; tuckHere()">${icon("sparkle", 18)}<span>AI 讲解</span></button>
</nav>`
}
