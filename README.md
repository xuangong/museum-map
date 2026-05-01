# museum-map

中国历史博物馆地图（Bun + Elysia + Cloudflare Workers + D1）。

## 快速开始（推荐：wrangler dev 模式，全功能）

```bash
bun install
bunx wrangler d1 create museum-map-db        # 把返回的 database_id 填进 wrangler.toml
bunx wrangler kv namespace create RATE       # 同上，填 id 进 [[kv_namespaces]]
bunx wrangler secret put COPILOT_GATEWAY_URL
bunx wrangler secret put COPILOT_GATEWAY_KEY
bun run seed                                 # 灌 64 馆 + 20 朝代到本地 D1
bun run dev                                  # http://localhost:4242
```

## 第二种：bun --hot 直跑（连远程 D1，热重载，仅适合改 UI）

```bash
cp .env.local.example .env.local             # 填 CLOUDFLARE_*、D1_DATABASE_ID、KV_RATE_NAMESPACE_ID
bun run local                                # http://localhost:4242
```

| 模式 | 命令 | DB | KV | chat |
|---|---|---|---|---|
| dev（推荐） | `bun run dev` | 本地 SQLite | 本地 | ✅ 全功能 |
| local | `bun run local` | 远程 D1（REST） | 远程 KV（REST） | ⚠️ 受限（缺 gateway 时 503） |

两套数据库**完全分离**：本地 seed 不影响远程，反之亦然。

## 部署

```bash
bun run seed -- --target=remote              # 仅首次/数据更新时
bunx wrangler deploy
```

## 测试

```bash
bun test                                     # repo / routes / coords / chat-guard / rate-limit / seed
bun run typecheck
```

## 项目结构

```
src/
├── index.ts            createApp + Workers fetch handler
├── local.ts            bun --hot 入口（D1/KV REST 适配器）
├── lib/                cdn 代理、html 模板、getClientIp、rateLimit
├── repo/               museums + dynasties 聚合
├── services/chat.ts    chat 字段白名单 + 转发 + 错误脱敏
├── routes/             home + museums + dynasties + chat
└── ui/                 layout + theme + components + client/{coords,map,app,chat}
```

设计文档：`docs/superpowers/specs/2026-04-30-museum-map-modernization-design.md`
实施计划：`docs/superpowers/plans/2026-04-30-museum-map-0[1-5]-*.md`
