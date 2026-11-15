/** 集章 needs an account: the sheet a signed-out visitor sees on tapping 集章. Logging in
 *  here (or via Google, which reloads the page) lands the stamp they reached for. */
export function StampGate(opts: { googleEnabled?: boolean } = {}): string {
  const google = opts.googleEnabled
    ? `<button class="btn btn-ghost" @click="doGoogleLogin()">使用 Google 登录</button>`
    : ``
  return `<div class="ji-sheet" x-show="gate.open" x-cloak x-transition.opacity @click="gateClose()" @keydown.escape.window="gate.open && gateClose()">
  <div class="ji-card gate-card" role="dialog" aria-label="登录后集章" @click.stop>
    <div class="ji-kicker">集章</div>
    <h3>登录，在<span class="gate-name" x-text="'「' + gateName() + '」'"></span>盖下这一枚</h3>
    <p class="ji-note">章盖在你的集章册里，换手机、换浏览器都还在；成就和长卷也从这里攒起。</p>
    <label>邮箱<input type="email" x-model="authForm.email" autocomplete="email" inputmode="email"></label>
    <label>密码<input type="password" x-model="authForm.password" autocomplete="current-password" @keydown.enter="submitLogin()"></label>
    <div class="auth-error gate-error" x-show="authForm.error" x-text="authForm.error"></div>
    <div class="ji-actions">
      <button class="btn btn-primary" @click="submitLogin()" :disabled="authForm.loading" x-text="authForm.loading ? '登录中…' : '登录并集章'"></button>
      <button class="btn btn-ghost" x-show="inviteCode" @click="submitRegister()" :disabled="authForm.loading">用邀请码注册</button>
      ${google}
      <button class="btn btn-text" @click="gateClose()">先逛逛</button>
    </div>
    <p class="ji-note gate-foot" x-show="!inviteCode">还没有账号？注册目前需要邀请码。</p>
  </div>
</div>`
}
