# 多用户认证 — 设计文档

**日期**：2026-05-05
**状态**：approved (brainstorming)
**作者**：Claude (with @xian)

## 背景

当前系统是单租户：`visits` / `review_cache` / `dynasty_review_cache` 三张表都把 `user_id` 硬编码为字符串 `'me'`。所有访客共享同一份足迹和 AI 评价缓存，无法区分用户。

目标：改造成多用户系统，支持 Email+密码 与 Google OAuth 两种登录方式，每个用户拥有独立的足迹和评价。**未登录用户仍可浏览全站只读内容，并可在本地暂存打卡，登录后一键合并。**

## 范围与目标

### In scope
- `users` 表（含 admin 标志）+ `sessions` 表
- Email+密码注册/登录（scrypt 哈希）
- Google OAuth 2.0（Authorization Code Flow，HttpOnly state cookie）
- HttpOnly Cookie + 服务端 session（30 天滚动过期）
- 匿名打卡 → 登录后合并到账号
- 现有 `'me'` 数据迁移到首位 admin 账号
- 现有 `ADMIN_TOKEN` 鉴权下线，改用 `users.is_admin`
- 侧边栏「我的足迹」头部嵌入登录入口（折叠表单 + Google 按钮）
- 单元/集成测试覆盖核心流程

### Out of scope（后续迭代）
- 邮箱验证、忘记密码（用户可联系管理员重置；管理员可直接 D1 改 `password_hash` 或新增）
- 第三方登录（GitHub/微信/Apple 等）
- 用户资料页（修改 display_name / avatar / 密码）
- 多设备 session 管理 UI（"注销其他设备"）
- 团队/共享列表

## 数据模型

新建 migration `migrations/0010_users.sql`：

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                  -- ulid (lowercase)
  email TEXT NOT NULL UNIQUE,           -- 原始小写
  email_normalized TEXT NOT NULL,       -- gmail 去点/+ 别名归一化，便于 OAuth 与本地账号合并
  password_hash TEXT,                   -- NULL = 仅 OAuth 用户
  google_sub TEXT UNIQUE,               -- Google 'sub' claim，可空；可在已有账号上后追加（merge）
  display_name TEXT,
  avatar_url TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX idx_users_email_norm ON users(email_normalized);
CREATE INDEX idx_users_google ON users(google_sub);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,                  -- 32 字节随机 hex (= 64 字符)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent TEXT,
  ip TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

`visits` / `review_cache` / `dynasty_review_cache` 已经有 `user_id` 列，无需改 schema。FK 暂不加（避免外键级联风险，应用层保证）。

### 数据迁移

部署后通过手动 SQL 执行（不在自动 migration 内，以免在没有 admin 账号的环境上把 'me' 数据丢失）：

```sql
-- 步骤 1：管理员先注册自己（通过 UI），拿到 user_id（设为 X）
-- 步骤 2：执行
UPDATE visits SET user_id = 'X' WHERE user_id = 'me';
UPDATE review_cache SET user_id = 'X' WHERE user_id = 'me';
UPDATE dynasty_review_cache SET user_id = 'X' WHERE user_id = 'me';
UPDATE users SET is_admin = 1 WHERE id = 'X';
```

第一个注册的账号也可以由 `services/auth.ts` 的 `register()` 自动判定（`SELECT COUNT(*) FROM users` == 0 时设 is_admin=1），但 SQL 显式 UPDATE 更稳。两条路径都保留。

## 组件分层

```
src/
├── lib/
│   ├── crypto.ts              新：scrypt(password, salt) + timingSafeEqual
│   └── cookies.ts             新：parse Cookie 头 / serialize Set-Cookie
├── repo/
│   ├── users.ts               新：findById/findByEmail/findByGoogleSub/create/setPassword/setGoogleSub/touch/countAll
│   ├── sessions.ts            新：create/get(activeOnly)/touch/revoke/revokeAll(userId)/sweepExpired
│   └── visits.ts              改：所有方法去掉默认 'me'，userId 必填
├── services/
│   ├── auth.ts                新：register/login/oauthLoginGoogle/logout/mergeAnonymous，共享密码校验与 session 创建
│   └── google-oauth.ts        新：buildAuthUrl(state) → string；exchangeCode(code) → {sub,email,name,picture}
├── routes/
│   ├── auth.ts                新：见下文路由表
│   └── visits.ts              改：从 ctx.user 取 userId，未登录回 401
├── middleware/
│   └── session.ts             新：解析 cookie → ctx.user / ctx.session
├── ui/
│   ├── components/sidebar.ts  改：未登录显示 "登录/注册" 折叠表单 + Google 按钮；已登录显示 email/退出
│   └── client/auth.ts         新：window.MuseumAuth = { syncMe, login, register, logout, googleStart, mergeLocal }
└── index.ts                   改：app.use(sessionMiddleware)；新增 secrets GOOGLE_CLIENT_ID/SECRET
```

### `lib/crypto.ts`

Workers 用 `node:crypto`（nodejs_compat 已开启）的 `scryptSync` + `randomBytes(16)` 做 salt。哈希格式：`scrypt$<salt-base64>$<hash-base64>`，便于未来切换算法。

```ts
export function hashPassword(plain: string): string
export function verifyPassword(plain: string, stored: string): boolean
export function generateToken(byteLen: number): string  // hex
```

### `middleware/session.ts`

Elysia 风格 `derive`：
```ts
app.derive(async ({ request }) => {
  const sid = parseCookie(request.headers.get("cookie"))["sid"]
  if (!sid) return { user: null, session: null }
  const session = await sessionsRepo.get(sid)  // 已过期返回 null
  if (!session) return { user: null, session: null }
  const user = await usersRepo.findById(session.user_id)
  await sessionsRepo.touch(sid)  // 异步即可，但简单起见同步
  return { user, session }
})
```

`requireUser(ctx)` / `requireAdmin(ctx)` helper 抛 401/403。

### `services/google-oauth.ts`

```ts
const SCOPES = "openid email profile"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

export function buildAuthUrl(opts: { clientId, redirectUri, state }): string
export async function exchangeCode(opts: { code, clientId, secret, redirectUri, fetcher? }):
  Promise<{ sub: string; email: string; emailVerified: boolean; name?: string; picture?: string }>
```

回调 URL：`https://museummap.xianliao.de5.net/auth/google/callback`

### 路由

| Method | Path | 描述 |
|---|---|---|
| POST | `/auth/register` | `{email, password, displayName?}` → set cookie + 200 `{user}` |
| POST | `/auth/login` | `{email, password}` → set cookie + 200 `{user}` |
| POST | `/auth/logout` | revoke session + clear cookie + 204 |
| GET  | `/auth/me` | 200 `{user}` 或 200 `{user: null}` |
| GET  | `/auth/google/start` | 写 state cookie，302 到 Google |
| GET  | `/auth/google/callback` | 校验 state，code→user，set sid cookie，302 到 `/?...#return` |
| POST | `/auth/merge-anonymous` | `{visits: [{museumId, visitedAt, note?}]}` → 401 if 未登录；INSERT OR IGNORE，返回 `{merged}` |

所有路由都受现有 `RATE` KV 限流：`/auth/register` `/auth/login` 5/IP/分钟。

### 客户端 `ui/client/auth.ts`

```ts
window.MuseumAuth = {
  user: null,                              // 启动时由 syncMe 填
  syncMe(): Promise<User|null>,            // 调 /auth/me
  register(email, password): Promise<User>,
  login(email, password): Promise<User>,
  googleStart(): void,                     // window.location = /auth/google/start
  logout(): Promise<void>,
  mergeLocal(): Promise<void>,             // 读 localStorage["anon-visits"] → POST → 清本地
  isAuthenticated(): boolean,
}
```

匿名打卡：现有 `app.ts` 中 `visits.checkIn(id)` 改为：登录态走 API；匿名走 `localStorage["anon-visits"]`。后台/UI 都使用相同的 visits 数组源（`MuseumAuth.user ? remote : local`）。

### UI（侧边栏头部）

未登录：
```
┌──────────────────────────────┐
│ ✦ 我的足迹（3）              │  ← 显示 localStorage 计数
│ ─ 登录后保存到云端 ─        │
│ [ Email           ]          │
│ [ 密码            ]          │
│ [登录]   [注册]              │
│ ─ 或 ─                       │
│ [ G  Google 登录 ]           │
└──────────────────────────────┘
```

已登录：
```
┌──────────────────────────────┐
│ ✦ 我的足迹（5）              │
│  zhang@example.com  [退出]   │
└──────────────────────────────┘
```

错误提示用现有 `toast`（`x-text="toast"`）。

## 数据流（关键场景）

### 1) 匿名打卡 → 登录合并
1. 未登录点「打卡」→ 写 `localStorage["anon-visits"] = [{museumId, visitedAt}, ...]`，更新 UI 状态
2. 用户登录任意通道 → `MuseumAuth.login` resolves → 自动调 `mergeLocal()` → POST `/auth/merge-anonymous {visits: [...]}` → 服务端逐条 `INSERT OR IGNORE INTO visits(user_id, museum_id, visited_at) VALUES (?, ?, ?)`
3. 客户端 `localStorage.removeItem("anon-visits")`，刷新足迹

### 2) Google OAuth
1. 点 Google 按钮 → `window.location.href = "/auth/google/start"`
2. 服务端 `start`：
   - 生成 `state = randomHex(16)`
   - `Set-Cookie: oauth_state=<state>; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/auth`
   - 302 到 `https://accounts.google.com/o/oauth2/v2/auth?...&state=<state>`
3. 用户授权 → Google 302 回 `/auth/google/callback?code=&state=`
4. 服务端 `callback`：
   - 校验 `state` cookie 与 query 一致
   - `exchangeCode(code)` → `{sub, email, ...}`
   - `usersRepo.findByGoogleSub(sub)` → 命中则登录；否则 `findByEmail(emailNormalized)`：
     - 命中：补 `google_sub`（账号合并）
     - 未命中：`create(...)`（password_hash=null）
   - 创建 session，`Set-Cookie: sid=...`
   - 302 回 `/`（首页 onload 自动 mergeLocal）

### 3) Email+密码
- `register`：唯一性检查 → `hashPassword(password)` → `users.create(...)` → 若是首位用户自动 `is_admin=1` → 创建 session
- `login`：`findByEmail` → `verifyPassword` → 创建 session
- 错误统一返回 `{error: "invalid_credentials"}`，不区分"用户不存在"和"密码错"，避免账号枚举

## 安全要点

| 项 | 决策 |
|---|---|
| Cookie | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` |
| CSRF | `SameSite=Lax` + 写操作校验 `Origin` 头匹配 `host`（GET 安全，OAuth 回跳是 GET 不影响） |
| 密码 | scrypt N=16384/r=8/p=1，salt 16 字节随机 |
| Session ID | 32 字节随机 hex（256 bit 熵） |
| OAuth state | 32 字节随机 hex，10 分钟过期一次性 cookie |
| 限流 | `/auth/register`、`/auth/login` 5/IP/分钟（复用 RATE KV） |
| 错误信息 | 登录/注册返回统一错误，避免账号枚举 |
| 日志 | 不记录密码或 session id；user_id + IP + UA 可记 |

## Admin 路由迁移

现有用 `ADMIN_TOKEN` header 的路由（`src/routes/import.ts` 等）：
- 移除 token 校验，改用 `requireAdmin(ctx)`
- ADMIN_TOKEN secret 不再读取（保留 secret 不删，避免运维误删）
- 部署后第一个注册的账号自动是 admin（或手动 `UPDATE users SET is_admin=1` 给现有账号）

## 测试

新增：

| 文件 | 覆盖 |
|---|---|
| `tests/users-repo.test.ts` | findByEmail / findByGoogleSub / create / setPassword / 唯一约束 |
| `tests/sessions-repo.test.ts` | create / get（含过期）/ touch / revoke / sweepExpired |
| `tests/crypto.test.ts` | hashPassword 不固定、verifyPassword 通过、错误密码失败、timing-safe |
| `tests/auth-service.test.ts` | register（首位 admin）/ login / logout / mergeAnonymous |
| `tests/google-oauth.test.ts` | buildAuthUrl 包含必要参数；exchangeCode 用 fakeFetcher 走通 |
| `tests/auth-routes.test.ts` | register → me → logout → me=null；merge-anonymous 401；CSRF Origin 拒绝 |

修改：
- `tests/visits-routes.test.ts`：未登录 401；登录后正常

## 环境变量

新 secrets（`bunx wrangler secret put`）：
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OAUTH_REDIRECT_URI`（默认 `https://museummap.xianliao.de5.net/auth/google/callback`，本地用 `http://localhost:4242/auth/google/callback`）

无新 KV / D1 binding。

## 验证步骤

1. `bunx wrangler d1 execute museum-map-db --local --file=migrations/0010_users.sql`
2. `bun test` 全绿（含新测试）
3. `bun run typecheck`
4. `bun run dev` → 浏览器：
   - 注册新账号 → 应自动登录，侧边栏显示 email
   - 打卡 → `/auth/me` 显示 visits 计数
   - 退出 → 重新匿名打卡 → 登录 → 自动合并
   - Google 登录（用真实 client，本地需要 ngrok 或 OAuth allow http://localhost）
5. 部署：
   - 设 secrets：`bunx wrangler secret put GOOGLE_CLIENT_ID/SECRET/OAUTH_REDIRECT_URI`
   - `bunx wrangler d1 execute museum-map-db --remote --file=migrations/0010_users.sql`
   - `bunx wrangler deploy`
   - 第一次注册自己 → SQL 迁移 `'me'` 数据：
     ```sql
     UPDATE visits SET user_id='<my_id>' WHERE user_id='me';
     UPDATE review_cache SET user_id='<my_id>' WHERE user_id='me';
     UPDATE dynasty_review_cache SET user_id='<my_id>' WHERE user_id='me';
     ```
6. 备份新表：`bun run snapshot` 后扩展 `scripts/snapshot.ts` 把 users/sessions 也输出？
   → **决定：snapshot 不导出 users/sessions**（密码 hash 与 session token 是敏感数据，避免进 git）。备份策略另行讨论。

## 回滚

- 代码：`git revert`，旧 ADMIN_TOKEN 路由仍在 secret 里可重启用
- 数据：`migrations/0010_users.sql` 是纯 ADD（CREATE TABLE）；DROP TABLE users, sessions 即可清除
- 已迁移的 visits 数据：`UPDATE visits SET user_id='me' WHERE user_id IN (SELECT id FROM users)` 即可恢复

## 后续（明确推迟）

- 邮箱验证 + 忘记密码（需要邮件服务，下个 phase）
- 用户资料页（改密码、改昵称、改头像）
- 注销其他设备
- 多账号合并（同一邮箱地址注册了两次的情况，目前 UNIQUE 约束已禁止）
