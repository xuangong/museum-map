# 中国历史博物馆地图 · 技术现代化 + 视觉重做 设计文档

**日期**：2026-04-30
**项目**：museum-map（在 `/Users/xian/projects/museum-map/` 当前根，legacy/ 保留作参考）
**目标**：把 legacy 单文件 HTML+JSON 的博物馆地图，迁到 copilot-api-gateway 同款现代技术栈（Bun + Elysia + Cloudflare Workers + D1 + Tailwind CDN + Alpine.js + 模块化 ui/），同时按 huashu-design 「宣纸博物」方向重做视觉。功能不丢失，为后续扩展铺路。

---

## 1. 现状（legacy）

- 单文件 `index.html`（~1860 行 HTML+CSS+JS 全在一起）
- `data.json`（7300+ 行）：64 个博物馆 + 20 个朝代 + meta
- Leaflet 地图、朝代时间轴、抽屉详情、AI 聊天面板（调云端 copilot-api-gateway）
- 视觉：深蓝赛博 `#1a1a2e + #f4a261`（属于 AI slop，需要替换）
- AI 聊天：legacy 已有，调云端部署的 copilot-api-gateway

---

## 2. 技术栈（与 copilot-api-gateway 完全对齐）

| 层 | 技术 |
|---|---|
| Runtime | Cloudflare Workers（wrangler） + Bun（本地） |
| Web 框架 | Elysia + @elysiajs/cors |
| 数据库 | D1（SQLite） |
| KV | binding `RATE` —— chat 限流计数器（每 IP / 全局每日配额），属安全基础设施，不是可选 |
| 前端 | 服务端渲染 HTML 字符串 + Tailwind CDN + Alpine.js + Leaflet |
| 构建 | 零构建，wrangler dev / deploy |
| 语言 | TypeScript（strict） |

---

## 3. 项目结构

```
museum-map/
├── package.json              # bun + elysia + wrangler，scripts 镜像 copilot-api-gateway
├── wrangler.toml             # 新 Worker：museum-map，新 D1：museum-map-db
├── tsconfig.json
├── README.md
├── migrations/
│   └── 0001_init.sql         # museums / dynasties / + 子表
├── scripts/
│   └── seed.ts               # 读 legacy/data.json 灌进 D1
├── src/
│   ├── index.ts              # Elysia app + 路由挂载
│   ├── local.ts              # 本地 bun 直跑入口
│   ├── config/
│   │   └── env.ts            # 环境变量类型
│   ├── lib/
│   │   ├── cdn.ts            # /cdn/* 代理 (tailwind/alpine/leaflet/leaflet.css)
│   │   └── html.ts           # html`` tag helper（escape）
│   ├── repo/
│   │   ├── museums.ts        # CRUD + 聚合
│   │   └── dynasties.ts
│   ├── services/
│   │   └── chat.ts           # 代理到云端 copilot-api-gateway /v1/messages（非流式 JSON，含字段白名单 + KV 限流配额）
│   ├── routes/
│   │   ├── index.ts          # 挂载所有路由
│   │   ├── home.ts           # GET /
│   │   ├── museums.ts        # /api/museums, /api/museums/:id
│   │   ├── dynasties.ts      # /api/dynasties, /api/dynasties/:id
│   │   └── chat.ts           # POST /api/chat
│   └── ui/
│       ├── layout.ts         # Layout({title, children})
│       ├── home.ts           # 首页骨架（地图 + 侧栏 + 时间轴 + 聊天）
│       ├── theme.ts          # 「宣纸博物」CSS variables 注入
│       ├── components/
│       │   ├── sidebar.ts
│       │   ├── dynasty-timeline.ts
│       │   ├── drawer.ts
│       │   └── chat-panel.ts
│       └── client/           # 浏览器端 JS 字符串（map init、Alpine 数据、抽屉交互）
│           ├── map.ts
│           ├── app.ts        # Alpine 主 store
│           └── chat.ts
├── tests/                    # bun test，详见 §10
│   ├── coords.test.ts        # WGS-84 → GCJ-02（已知点对照 + outOfChina 跳过）
│   ├── chat-guard.test.ts    # 字段白名单、payload/消息条数限制、错误脱敏
│   ├── rate-limit.test.ts    # 每 IP 每分钟/每天 + 全局每天，KV mock
│   ├── repo.test.ts          # repo 聚合：museums/dynasties 完整字段往返
│   ├── seed.test.ts          # seed 幂等（连跑两次结果一致）+ FK 删除顺序
│   └── routes.test.ts        # /api/museums、/api/dynasties 响应形状契约
└── legacy/                   # 保留，仅作参考，不部署
```

---

## 4. D1 Schema（`migrations/0001_init.sql`）

> 注：D1（SQLite）默认 `foreign_keys = OFF`。所有 `REFERENCES ... ON DELETE` 在 schema 中声明，运行时由 `services/*` 在 `db.prepare("PRAGMA foreign_keys = ON").run()` 后再操作；seed SQL 文件首行也加 `PRAGMA foreign_keys = ON;`。

```sql
-- 博物馆
CREATE TABLE museums (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  location TEXT,
  level TEXT,
  core_period TEXT,
  specialty TEXT,
  dynasty_coverage TEXT,
  timeline TEXT
);

CREATE TABLE museum_treasures (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_halls (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_artifacts (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  period TEXT,           -- 实测：441 行中 340 行有此字段（legacy 后期补的），保留
  description TEXT,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_dynasty_connections (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  dynasty TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY(museum_id, order_index)
);

CREATE TABLE museum_sources (
  museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY(museum_id, order_index)
);

-- 朝代
CREATE TABLE dynasties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  period TEXT,
  center_lat REAL,
  center_lng REAL,
  overview TEXT,
  order_index INTEGER NOT NULL
);

-- culture 在 legacy 是 [{category, description}] 数组（20 个朝代全部如此），
-- 用单独子表保留结构，不压缩成 TEXT
CREATE TABLE dynasty_culture (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE TABLE dynasty_events (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  date TEXT NOT NULL,
  event TEXT NOT NULL,
  lat REAL,
  lng REAL,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE TABLE dynasty_recommended_museums (
  dynasty_id TEXT NOT NULL REFERENCES dynasties(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  museum_id TEXT REFERENCES museums(id) ON DELETE SET NULL,  -- 可空但有 FK，防止跳转静默失效
  name TEXT NOT NULL,
  location TEXT,
  reason TEXT,
  PRIMARY KEY(dynasty_id, order_index)
);

CREATE INDEX idx_museums_coords ON museums(lat, lng);
CREATE INDEX idx_dynasty_events_dynasty ON dynasty_events(dynasty_id);
CREATE INDEX idx_dynasty_recommended_dynasty ON dynasty_recommended_museums(dynasty_id);
```

---

## 5. API 路由

| 方法 | 路径 | 返回 | 说明 |
|---|---|---|---|
| GET | `/` | HTML | 首页（地图 + 侧栏 + 朝代时间轴 + 抽屉 + 聊天面板挂载点） |
| GET | `/api/museums` | JSON `[{id,name,lat,lng,level,corePeriod,dynastyCoverage}]` | 地图 marker / 侧栏列表（含子标题数据） |
| GET | `/api/museums/:id` | JSON 完整对象（含子表 treasures、halls、artifacts[含 period]、dynastyConnections、sources） | 抽屉详情 |
| GET | `/api/dynasties` | JSON 完整列表（含 events、recommendedMuseums、culture[来自 dynasty_culture 子表]） | 时间轴 + 朝代抽屉 |
| GET | `/api/dynasties/:id` | JSON 单个 | 单朝代详情 |
| POST | `/api/chat` | JSON | 服务端代理到云端 copilot-api-gateway 的 `/v1/messages`（Anthropic 风格，与 legacy 完全相同的契约），注入 `x-api-key`。**MVP 与 legacy 一致采用非流式**。受字段白名单 + 速率/配额限制保护，详见下文「chat 转发实现」与 §6 验收 |
| GET | `/cdn/tailwind.js` 等 | JS/CSS | CDN 代理（复用 copilot-api-gateway 的 `lib/cdn.ts` 模式） |

**chat 转发实现**：
- legacy 实测调用：`POST https://token.xianliao.de5.net/v1/messages`，header `x-api-key`，body `{model, max_tokens, system, messages}`，**非流式** `response.json()` 取 `data.content[0].text`
- 安全问题：legacy 把 API key 明文硬编码在前端（`legacy/index.html:1774`）。新版**必须**改成服务端代理：浏览器 `POST /api/chat`（无 key），Worker 注入 `x-api-key: ${COPILOT_GATEWAY_KEY}` 转发到上游
- 上游 URL：`COPILOT_GATEWAY_URL`（默认 `https://token.xianliao.de5.net`）
- **不是盲转发**——`services/chat.ts` 必须实施以下保护，再转发到上游：

  | 措施 | 规则 |
  |---|---|
  | **字段白名单** | 只透传 `system`、`messages`；`model` 在服务端固定为 `claude-haiku-4.5`（与 legacy 一致），`max_tokens` 服务端固定为 `1024`，`stream` 强制 false。前端传的其他字段一律丢弃 |
  | **payload 大小** | `messages` 总 JSON ≤ 32 KB；`system` ≤ 8 KB；超出 413 |
  | **消息条数** | `messages.length` ≤ 12（legacy 已自截 10），超出 400 |
  | **每 IP 速率** | KV 计数器，每 IP 每分钟 ≤ 10 次、每天 ≤ 100 次（用 `cf.connectingIp`），超出 429。需新增 `[[kv_namespaces]] binding = "RATE"` |
  | **每日全局配额** | KV 全局计数器，每天 ≤ 5000 次，超出 503，防止单日额度被刷爆 |
  | **CORS** | 仅允许同源（生产域名）；本地 dev 放开 |
  | **错误隔离** | 上游错误吞掉 detail，对外仅返回 `{error: "upstream_error"}`，避免泄露 key 提示信息 |

- 速率/配额配置以 `vars` 暴露（`RATE_PER_MIN`、`RATE_PER_DAY`、`GLOBAL_PER_DAY`），便于调整无需改代码

---

## 6. 视觉设计 · 「宣纸博物」方向

### 6.1 设计哲学（来自 huashu-design）

- 反 AI slop：不用紫渐变、不用赛博深蓝、不用 emoji 装饰、不用圆角+左 border accent
- 一个有温度的底色 + **单一** accent 贯穿全场
- 字体：衬线 display + 系统中文，不用 Inter/Roboto
- 节制：少容器、少 border、少装饰 icon
- 一处「值得截图」的签名细节

### 6.2 设计 Token（`src/ui/theme.ts` 注入到 `:root`）

```css
:root {
  /* 底色 */
  --bg:        #F5F1E8;  /* 宣纸米 */
  --bg-soft:   #EFE9DA;  /* 卡纸暖白 */
  --bg-elev:  #FBF8F0;   /* 抽屉/面板浮起色 */

  /* 文字 */
  --ink:       #1C1A17;  /* 松烟墨 */
  --ink-soft:  #3D3833;
  --ink-mute:  #847A6E;

  /* 单一 accent */
  --accent:    #C04A1A;  /* 赤土橙 */
  --accent-soft: #E8B89A;

  /* 边线 */
  --rule:      #D9D2C2;
  --rule-soft: #E8E2D2;

  /* 字 */
  --font-display: "Source Serif 4", "Songti SC", "STSong", serif;
  --font-cn:      "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif;
  --font-body:    -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;

  /* 节奏 */
  --rule-thin: 0.5px solid var(--rule);
  --rule-strong: 1px solid var(--ink);
}
```

字体：`Source Serif 4`（Google Fonts）+ `Noto Serif SC`（Google Fonts）+ 系统 sans。

### 6.3 关键组件视觉

- **顶部朝代时间轴**：宣纸底，朝代名宋体，当前朝代下方一根赤土橙细线（不是色块），左右拖拽，无圆角无阴影
- **左侧博物馆列表**：宋体名 + 极小 sans 副标（`corePeriod` 字段，由 `/api/museums` 的 list payload 提供），项目之间一根 0.5px `--rule` 细线，无卡片化
- **地图**：marker 是手写朱印风（小圆 + 印章质感），选中态加赤土橙描边。**底图与坐标系契约**：
  - 数据存 D1 的 `(lat, lng)` **统一为 WGS-84**（与 legacy `data.json` 数值口径一致）
  - 瓦片源延续 legacy 的高德 GCJ-02：`https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`，`subdomains: '1234'`，`maxZoom: 18`
  - **必须在前端做 WGS-84 → GCJ-02 转换后再投到 Leaflet**（直接搬 legacy `legacy/index.html:1122-1158` 那段 `wgs84ToGcj02` 实现到 `src/ui/client/coords.ts`，所有 `marker / center / event point` 走统一 `toMapCoord(lat,lng)` 入口）
  - 不在中国境内的点（`outOfChina` 判定）跳过转换，与 legacy 一致
  - 视觉调整通过 `tileLayer` 的 CSS filter（`filter: grayscale(0.4) sepia(0.15) brightness(1.05)`）做暖米色化，**不替换瓦片源**——避免引入新瓦片源后坐标系再次错配
- **抽屉**：从右侧/底部滑入，背景 `--bg-elev`，头部一行宋体大字博物馆名 + 灰色 sans 地点，下方等距区段（年代覆盖 / 镇馆之宝 / 展厅 / 文物 / 朝代关联 / 信源），段间用 0.5px `--rule` 隔开，**无 emoji、无 icon、无圆角卡**
- **AI 聊天面板**：底部全屏滑入，遮罩 `rgba(28,26,23,0.4)`，输入框是一根细线，无圆角胶囊；消息分两栏（用户右、AI 左），用一行小字标 "你 / 模型"
- **签名细节**：朝代切换时，时间轴下的赤土细线有 0.4s ease 滑动；地图选中 marker 时印章有极轻 scale-in；这两处做到 120%

### 6.4 真图策略

legacy 完全无图。新版按 huashu-design「真图诚实性测试」：
- **博物馆 hero 图**：先不强制加（避免 stock photo slop）。后续按需从 Wikimedia Commons 找各馆建筑图 / 镇馆之宝图，单独建 `migrations/0002_museum_images.sql` 加表
- **本期 MVP**：保持无图，靠排版+留白；只在抽屉里给"信源"中的官网链接做明显视觉锚点

---

## 7. 数据迁移

`scripts/seed.ts`（**统一走 `--file` 路径**，不拼命令字符串）：
1. 读 `legacy/data.json`
2. 按 schema 拆分为主表 + 子表行（含 artifacts.period、dynasty_culture）
3. 生成一个临时 SQL 文件 `.tmp/seed.sql`，内容形如：
   ```sql
   BEGIN;
   DELETE FROM museum_sources; DELETE FROM museum_dynasty_connections;
   DELETE FROM museum_artifacts; DELETE FROM museum_halls;
   DELETE FROM museum_treasures; DELETE FROM museums;
   DELETE FROM dynasty_recommended_museums; DELETE FROM dynasty_events;
   DELETE FROM dynasty_culture; DELETE FROM dynasties;
   INSERT INTO museums (...) VALUES (...);
   ...
   COMMIT;
   ```
4. 执行：
   - `--target=local`（默认）：`wrangler d1 execute museum-map-db --local --file=.tmp/seed.sql`
   - `--target=remote`：`wrangler d1 execute museum-map-db --remote --file=.tmp/seed.sql`
5. 朝代 `order_index` 按数组顺序赋值，保留时间轴顺序
6. 幂等：前置 `DELETE FROM` 各表（按外键依赖反向顺序）

---

## 8. 配置 / 部署

### 8.1 wrangler / Workers（生产 + `wrangler dev`）

`wrangler.toml`：
```toml
name = "museum-map"
main = "src/index.ts"
compatibility_date = "2025-06-01"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

[[d1_databases]]
binding = "DB"
database_name = "museum-map-db"
database_id = "<by wrangler d1 create>"
migrations_dir = "migrations"

# 用于 chat 限流计数器（评审 #1 要求）
[[kv_namespaces]]
binding = "RATE"
id = "<by wrangler kv namespace create RATE>"

[vars]
RATE_PER_MIN = "10"
RATE_PER_DAY = "100"
GLOBAL_PER_DAY = "5000"
# COPILOT_GATEWAY_URL via secret
# COPILOT_GATEWAY_KEY via secret
```

Secrets：
- `COPILOT_GATEWAY_URL`（如 `https://token.xianliao.de5.net`）
- `COPILOT_GATEWAY_KEY`（API key，从 legacy 硬编码迁出）

### 8.2 本地开发模式（参照 copilot-api-gateway 双模式）

copilot-api-gateway 同时提供 `wrangler dev`（贴近生产）和 `bun --hot run src/local.ts`（直跑、热重载、可连远程 D1）两种入口。本项目复刻：

| 模式 | 命令 | DB 来源 | KV(RATE) | chat 可用？ | seed 命令 |
|---|---|---|---|---|---|
| `wrangler dev`（**默认推荐**，本地闭环，**chat 在此模式可用**） | `bun run dev` | wrangler 本地 SQLite（`.wrangler/state/v3/d1/`） | wrangler 本地 KV（自动） | ✅ 全功能 | `bun run seed`（默认 `--target=local`） |
| `bun run local`（连远程 D1，热重载，仅用于读库 + UI 迭代） | `bun --hot run src/local.ts` | D1 HTTP API 连远程 | 远程 KV REST API（轻量适配） | ⚠️ 受限 | `bun run seed --target=remote` |

**`bun run local` 模式下的 chat 策略**（评审 #1）：
- `local.ts` 启动时显式注入两个抽象 `Bindings`：
  - `DB`：D1 HTTP 适配器（实现 `prepare().bind().all/run/first`）
  - `RATE`：KV REST API 适配器（实现 `get/put` 即够，TTL 用 `expiration_ttl`）
- chat 限流的 `cf.connectingIp` 在 Bun 模式下不可用 → `local.ts` 用 `request.headers["x-forwarded-for"] ?? "127.0.0.1"` 兜底，由统一的 `getClientIp(ctx)` helper 决定来源（Worker 模式读 `cf.connectingIp`，Bun 模式读 header）。**路由层不直接访问 `cf.*` 或 `process.env`**，全部通过 `ctx.bindings` + `getClientIp` 抽象，保证 100% 同源
- 默认本地开发 IP 取 `127.0.0.1`，限流仍生效（防止本地误调用打爆远程额度）
- 若开发者只想跑读库 + UI 不想配 KV，可在 `.env.local` 设 `DISABLE_CHAT=1`，`/api/chat` 返回 503 + 明确文案"chat disabled in this mode, use \`bun run dev\` instead"

**热重载**（评审 #3）：`bun run local` 实际命令为 `bun --hot run src/local.ts`（不是 `bun run src/local.ts`），与 copilot-api-gateway `local:watch` 一致

**避免「seed 完看不到数据」的坑**（前一轮反馈）：
- `bun run dev` 的 `predev` 钩子自动执行 `wrangler d1 migrations apply --local`，并在首次空库时打印红字提示 `本地 D1 为空，请先跑 \`bun run seed\``
- `bun run local` 启动时调用一次 `SELECT count(*) FROM museums`，若为 0 提示使用 `bun run seed --target=remote`
- 两套 DB **完全分离**，`README.md` 顶部加速查表

`local.ts` 在启动时构造 D1 + KV 适配器，注入给 Elysia 的 ctx，使路由层代码与 wrangler 模式 100% 同源。

`package.json` scripts（镜像 copilot-api-gateway）：
- `dev`：wrangler dev
- `local`：bun run src/local.ts
- `deploy`：wrangler deploy
- `seed`：bun run scripts/seed.ts
- `test`：bun test
- `typecheck`：bunx tsc --noEmit

---

## 9. 功能保留对照

| legacy 功能 | 新版位置 |
|---|---|
| Leaflet 地图 + marker | `ui/client/map.ts`（自定义 tile + 朱印 marker） |
| 朝代时间轴拖拽切换 | `ui/components/dynasty-timeline.ts` + Alpine `x-data` |
| 博物馆列表 + 搜索 | `ui/components/sidebar.ts` |
| 博物馆详情抽屉（snap 吸顶吸底） | `ui/components/drawer.ts` + `client/app.ts` |
| 朝代详情抽屉 | 同上 |
| AI 聊天面板（全屏底部 + 遮罩 + 滑入） | `ui/components/chat-panel.ts` + `routes/chat.ts` |
| 信源链接新开 tab | 模板 `target="_blank" rel="noopener"` |
| 朝代联动（点朝代→地图飞到中心） | `client/app.ts` event bus |
| `data.json` 内容 | D1 + `/api/*` |

---

## 10. 验收标准

- 64 个博物馆全部出现在地图和列表
- 20 个朝代时间轴可拖拽，点击切换抽屉
- 任意博物馆抽屉显示完整字段（含 artifacts、dynastyConnections、sources 等）
- AI 聊天能完整往返一次问答（与 legacy 一致采用非流式，对话渲染整段消息；流式打字另立扩展 spec）
- 视觉对照 legacy：用户能直观感受到"温润宣纸"vs"赛博深蓝"的差异
- `wrangler dev` / `wrangler deploy` 都能跑
- `bun test` 通过 §10.1 列出的所有具体测试点

### 10.1 必须存在的测试点（评审 #5）

测试缺失会让本期高风险逻辑无声回归，下列**每一条都必须有对应 `it()`**：

**`tests/coords.test.ts`** — WGS-84 → GCJ-02
- 至少 3 组中国境内已知点（北京 / 西安 / 杭州）的转换结果，与 legacy `wgs84ToGcj02` 输出**逐位对齐**（防止公式抄错）
- `outOfChina` 边界：lng=72.0 / 137.9、lat=0.8 / 55.9 各方向各 1 个点，断言**返回原坐标**不转换
- `toMapCoord` 入口对中国境外点（如东京 35.68, 139.69）返回原值

**`tests/chat-guard.test.ts`** — chat 字段白名单 + payload 限制 + 错误脱敏
- 前端传 `model: "claude-opus-4"` → 服务端转发的 body 里 `model === "claude-haiku-4.5"`（被覆盖）
- 前端传 `max_tokens: 99999` → 转发的 body 里 `max_tokens === 1024`
- 前端传 `stream: true` → 转发的 body 里 `stream === false`
- 前端传 `tools`、`metadata` 等额外字段 → 不出现在转发 body 中
- `messages` JSON > 32KB → 413
- `system` > 8KB → 413
- `messages.length > 12` → 400
- 上游 401/500 → 对外仅返回 `{error: "upstream_error"}`，断言响应 body 不包含 key 子串、不包含 upstream URL

**`tests/rate-limit.test.ts`** — KV 限流（用 in-memory KV mock）
- 同一 IP 1 分钟内第 11 次请求 → 429
- 同一 IP 当天第 101 次 → 429
- 全局当天第 5001 次 → 503
- TTL 到期后计数器重置
- `getClientIp(ctx)` 在 Worker 模式优先 `cf.connectingIp`，Bun 模式回退 `x-forwarded-for`，都没有时返回 `"127.0.0.1"`

**`tests/seed.test.ts`** — seed 幂等 + 外键
- 连跑两次 `seed.ts`，两次后 `SELECT count(*)` 各表数量一致
- 删除一个 museum 时（启用 PRAGMA foreign_keys=ON），其所有子表行被级联删除；`dynasty_recommended_museums.museum_id` 被 SET NULL（不级联删除朝代推荐项）
- seed 后 `museums` 表行数 = 64，`dynasties` 表行数 = 20，`museum_artifacts` 行数 = 441（含 340 行有 period）

**`tests/repo.test.ts`** — 聚合往返
- `museumsRepo.get("guobo")` 返回的对象与 legacy `data.json` 里 `guobo` 条目**字段对字段**等价（含 artifacts 顺序、period 字段、sources 顺序）
- `dynastiesRepo.list()` 返回 20 项，`order_index` 严格递增；`culture` 是 `[{category,description}]` 数组而非字符串

**`tests/routes.test.ts`** — 路由响应形状
- `GET /api/museums` 列表项含 `corePeriod` 和 `dynastyCoverage` 字段（与侧栏 UI 契约一致）
- `GET /api/museums/:id` 响应 schema 用 inline JSON snapshot 守住
- `GET /api/dynasties` 响应中 `culture` 是数组结构

---

## 11. 不在本次范围

- 后台管理（增删改博物馆/朝代）→ 数据扩展时另立 spec
- 用户登录 / 收藏 → 另立
- 博物馆 hero 图 / 文物图采集 → 另立 spec（涉及 Wikimedia 抓取流程）
- 实用信息、视频、wiki 同步等 legacy commit 历史里出现的扩展字段 → 另立
- 国际化 i18n → 另立
