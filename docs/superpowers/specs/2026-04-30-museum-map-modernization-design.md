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
| KV | 暂不需要（后续配置/缓存可加） |
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
│   │   └── chat.ts           # 转发到云端 copilot-api-gateway（流式 SSE 透传）
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
├── tests/                    # bun test
│   ├── repo.test.ts
│   └── routes.test.ts
└── legacy/                   # 保留，仅作参考，不部署
```

---

## 4. D1 Schema（`migrations/0001_init.sql`）

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
  museum_id TEXT,
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
| GET | `/api/museums/:id` | JSON 完整对象（含所有子表聚合，含 artifacts.period、culture 数组） | 抽屉详情 |
| GET | `/api/dynasties` | JSON 完整列表（含 events、recommendedMuseums、culture） | 时间轴 + 朝代抽屉 |
| GET | `/api/dynasties/:id` | JSON 单个 | 单朝代详情 |
| POST | `/api/chat` | JSON | 服务端代理到云端 copilot-api-gateway 的 `/v1/messages`（Anthropic 风格，与 legacy 完全相同的契约），透传请求体，注入 `x-api-key`。**MVP 与 legacy 一致采用非流式**，后续如需 SSE 另立扩展 |
| GET | `/cdn/tailwind.js` 等 | JS/CSS | CDN 代理（复用 copilot-api-gateway 的 `lib/cdn.ts` 模式） |

**chat 转发实现**：
- legacy 实测调用：`POST https://token.xianliao.de5.net/v1/messages`，header `x-api-key`，body `{model, max_tokens, system, messages}`，**非流式** `response.json()` 取 `data.content[0].text`
- 安全问题：legacy 把 API key 明文硬编码在前端（`legacy/index.html:1774`）。新版**必须**改成服务端代理：浏览器 `POST /api/chat`（无 key），Worker 注入 `x-api-key: ${COPILOT_GATEWAY_KEY}` 转发到上游
- 上游 URL：`COPILOT_GATEWAY_URL`（默认 `https://token.xianliao.de5.net`）
- 请求/响应**完全透传**（保持 Anthropic `/v1/messages` 契约不变），前端代码迁移成本最小
- `model`、`max_tokens`、`system`、`messages` 全部由前端传入，服务端只加 key 和 URL，不重写 body

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
- **地图**：自定义 Leaflet tile（米色底 + 灰墨等高线，关闭默认 OSM 蓝），marker 是手写朱印风（小圆 + 印章质感），选中态加赤土橙描边
- **抽屉**：从右侧/底部滑入，背景 `--bg-elev`，头部一行宋体大字博物馆名 + 灰色 sans 地点，下方等距区段（年代覆盖 / 镇馆之宝 / 展厅 / 文物 / 朝代关联 / 信源），段间用 0.5px `--rule` 隔开，**无 emoji、无 icon、无圆角卡**
- **AI 聊天面板**：底部全屏滑入，遮罩 `rgba(28,26,23,0.4)`，输入框是一根细线，无圆角胶囊；消息分两栏（用户右、AI 左），用一行小字标 "你 / 模型"
- **签名细节**：朝代切换时，时间轴下的赤土细线有 0.4s ease 滑动；地图选中 marker 时印章有极轻 scale-in；这两处做到 120%

### 6.4 真图策略

legacy 完全无图。新版按 huashu-design「真图诚实性测试」：
- **博物馆 hero 图**：先不强制加（避免 stock photo slop）。后续按需从 Wikimedia Commons 找各馆建筑图 / 镇馆之宝图，单独建 `migrations/0002_museum_images.sql` 加表
- **本期 MVP**：保持无图，靠排版+留白；只在抽屉里给"信源"中的官网链接做明显视觉锚点

---

## 7. 数据迁移

`scripts/seed.ts`：
1. 读 `legacy/data.json`
2. 按 schema 拆分为主表 + 子表行（含 artifacts.period、dynasty_culture）
3. 输出一个事务化的 SQL 文件，通过 `wrangler d1 execute --file` 提交（target=local|remote 见 §8.2）
4. 朝代 `order_index` 按数组顺序赋值，保留时间轴顺序
5. 幂等：前置 `DELETE FROM` 各表

执行：`bun run seed`（默认 local）/ `bun run seed --target=remote`

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

[vars]
# COPILOT_GATEWAY_URL via secret
# COPILOT_GATEWAY_KEY via secret
```

Secrets：
- `COPILOT_GATEWAY_URL`（如 `https://token.xianliao.de5.net`）
- `COPILOT_GATEWAY_KEY`（API key，从 legacy 硬编码迁出）

### 8.2 本地开发模式（参照 copilot-api-gateway 双模式）

copilot-api-gateway 同时提供 `wrangler dev`（贴近生产）和 `bun run src/local.ts`（直跑、热重载、可连远程 D1）两种入口。本项目复刻：

| 模式 | 命令 | DB 来源 |
|---|---|---|
| `wrangler dev` | `bun run dev` | wrangler 管理的本地 SQLite（位于 `.wrangler/state/v3/d1/`），由 `wrangler d1 migrations apply museum-map-db --local` 初始化 |
| `bun run local` | `bun run src/local.ts` | 通过 D1 HTTP API 连**远程** D1 数据库（与 copilot-api-gateway 的 `local.ts` 一致），需要 `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_TOKEN`、`D1_DATABASE_ID` 环境变量；`local.ts` 在启动时构造一个实现 `D1Database` 接口的 HTTP 适配器，注入给 Elysia |

`scripts/seed.ts` 接收 `--target=local|remote`：
- `--target=local`（默认）：调用 `wrangler d1 execute museum-map-db --local --command="..."` 批量执行 INSERT
- `--target=remote`：调用 `wrangler d1 execute museum-map-db --remote --command="..."`
- 通过 transaction（`wrangler d1 execute --file`）单次提交，幂等（前置 `DELETE FROM`）

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
- AI 聊天能流式打字
- 视觉对照 legacy：用户能直观感受到"温润宣纸"vs"赛博深蓝"的差异
- `wrangler dev` / `wrangler deploy` 都能跑
- `bun test` 通过

---

## 11. 不在本次范围

- 后台管理（增删改博物馆/朝代）→ 数据扩展时另立 spec
- 用户登录 / 收藏 → 另立
- 博物馆 hero 图 / 文物图采集 → 另立 spec（涉及 Wikimedia 抓取流程）
- 实用信息、视频、wiki 同步等 legacy commit 历史里出现的扩展字段 → 另立
- 国际化 i18n → 另立
