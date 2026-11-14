# 寄 · 手卷分享 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken poster share with 「寄」: every share is a 手卷 page at `/s/:id` (曲 / 行 / 印 / 长卷) that replays the moment with verified narration, a classical colophon, the sender's seals, and viewers' 观款.

**Architecture:** A share is a frozen JSON snapshot in D1 (`share_scrolls`), created by `POST /api/scrolls`. `GET /s/:id` renders the whole scroll server-side (all text composed in `scroll-text.ts` / `scroll-narration.ts` from checked data), then a small client script mounts the existing 3D strata module read-only and replays the tune (same seed) or 溯洄, lighting up the matching narration via new strata callbacks. Viewers stamp 观款 through `POST /api/s/:id/guan`.

**Tech Stack:** Bun + Elysia on Cloudflare Workers, D1, KV (`RATE`), bun:test + miniflare, Three.js strata module served as a string (`STRATA_MODULE`).

**Spec:** `docs/superpowers/specs/寄.md` — read it first. Tone: literary, classical, never 亲子. User-facing text never says 「分享」.

## Codebase rules every task must follow

- Client code lives in JS **strings** (`STRATA_MODULE` in `src/ui/client/strata.ts`, scripts embedded in pages). Inside those template literals: **no backticks**, no unintended `${`, and regex escapes must be doubled (`\\d`) — or use `[0-9]`.
- Elysia handlers cast: `const c = ctx as unknown as Ctx` (see `src/routes/achievements.ts`).
- Route tests use Miniflare with the local D1 (see `tests/achievements-route.test.ts` → `makeEnv()`); migrations are applied to local D1 with `bunx wrangler d1 migrations apply museum-map-db --local`.
- Long strings in UI need `overflow-wrap:anywhere`. Inputs need `font-size:16px`.
- Run `bun test <file>` for a task's tests and `bun run typecheck` before committing. The full suite has 2 known failures in image-enricher tests; ignore those.
- Commit on the current branch (`worktree-redesign`). Never push. End commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- After `bun test`, local D1 is reseeded with legacy data; run `bun run restore -- --target=local --confirm` before any browser check.

## File map

| File | Role |
|---|---|
| `src/services/scroll-text.ts` (new) | Pure text: 干支, 汉字数字, era short names, 题跋, 签条, 引首 pick, season line, page title |
| `src/data/achievements.ts` (modify) | New `yinshou` field (4 chars) on every achievement |
| `migrations/0016_share_scrolls.sql` (new) | `share_scrolls`, `share_guan` |
| `src/repo/scrolls.ts` (new) | Create / get scroll; add / list 观款 |
| `src/lib/sensitive.ts` (new) | Tiny name/line filter |
| `src/services/scroll-narration.ts` (new) | 画心 notes per kind from dynasties, era voices, tunes, achievements |
| `src/routes/scrolls.ts` (new) | `POST /api/scrolls`, `GET /s/:id`, `GET/POST /api/s/:id/guan`, `GET /u/:handle/share` redirect |
| `src/ui/scroll-page.ts` (new) | The 手卷 page HTML + CSS + client script |
| `src/ui/client/strata.ts` (modify) | `guest` mode, `play()`, `voyage()`, callbacks, 寄此曲 / 寄此行 buttons via `cb.onSend` |
| `src/ui/components/ji.ts` (new) | 「封卷」 panel component |
| `src/ui/client/app.ts`, `src/ui/components/achievements.ts`, `src/ui/components/sidebar.ts`, `src/ui/components/drawer.ts`, `src/ui/profile.ts`, `src/ui/home.ts` (modify) | Entry points, wording |
| Delete: `src/routes/share.ts`, `src/ui/share-poster.ts`, `src/ui/poster-atoms.ts`, `src/services/share-poet.ts` | Old poster |

---

### Task 1: scroll-text — 干支, numerals, colophons, titles

**Files:**
- Create: `src/services/scroll-text.ts`
- Test: `tests/scroll-text.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scroll-text.test.ts
import { describe, it, expect } from "bun:test"
import {
  ganzhi, numZh, eraShort, seasonOf, SEASON_LINES, chinaNow, colophon, titleSlip, tuneYinshou, pageTitle, museumList,
} from "~/services/scroll-text"

describe("scroll-text", () => {
  it("干支", () => {
    expect(ganzhi(2024)).toBe("甲辰")
    expect(ganzhi(2025)).toBe("乙巳")
    expect(ganzhi(2026)).toBe("丙午")
    expect(ganzhi(1984)).toBe("甲子")
  })
  it("汉字数字", () => {
    expect(numZh(0)).toBe("零")
    expect(numZh(3)).toBe("三")
    expect(numZh(10)).toBe("十")
    expect(numZh(14)).toBe("十四")
    expect(numZh(20)).toBe("二十")
    expect(numZh(37)).toBe("三十七")
    expect(numZh(129)).toBe("一百二十九")
    expect(numZh(105)).toBe("一百零五")
  })
  it("era short names", () => {
    expect(eraShort("唐朝（公元618年—907年）")).toBe("唐")
    expect(eraShort("东周：春秋与战国（公元前770年—前221年）")).toBe("东周")
    expect(eraShort("远古与新石器时代（约公元前10000年—前2070年）")).toBe("新石器")
    expect(eraShort("五代十国（公元907年—960年）")).toBe("五代十国")
    expect(eraShort("西汉（公元前202年—公元9年）")).toBe("西汉")
  })
  it("season from 节气", () => {
    expect(seasonOf("立春")).toBe("春")
    expect(seasonOf("谷雨")).toBe("春")
    expect(seasonOf("大暑")).toBe("夏")
    expect(seasonOf("霜降")).toBe("秋")
    expect(seasonOf("立冬")).toBe("冬")
    expect(seasonOf("小寒")).toBe("冬")
    expect(SEASON_LINES.冬.text).toBe("晚来天欲雪，能饮一杯无")
    expect(SEASON_LINES.冬.src).toBe("白居易《问刘十九》")
  })
  it("chinaNow uses Beijing time", () => {
    // 2026-12-31 20:00 UTC is 2027-01-01 04:00 in Beijing
    const r = chinaNow(new Date(Date.UTC(2026, 11, 31, 20)))
    expect(r.ganzhi).toBe("丁未")
  })
  it("museum list shortens past three", () => {
    expect(museumList(["殷墟", "二里头"])).toBe("殷墟、二里头")
    expect(museumList(["殷墟", "二里头", "郑州", "偃师", "安阳"])).toBe("殷墟、二里头等五馆")
  })
  it("colophons", () => {
    const at = { ganzhi: "丙午", term: "立冬" }
    expect(colophon({ kind: "tune", ...at, name: "小明", museums: 14, eras: ["西汉", "唐", "宋"] }))
      .toBe("丙午年立冬，小明以十四馆之印，奏西汉、唐、宋三代之音。")
    expect(colophon({ kind: "tune", ...at, name: "小明", museums: 14, eras: Array(17).fill("唐") }))
      .toBe("丙午年立冬，小明以十四馆之印，奏十七代之音。")
    expect(colophon({ kind: "voyage", ...at, name: "小明", layers: 20 }))
      .toBe("丙午年立冬，小明溯洄而上，自今及于新石器，所过二十层。")
    expect(colophon({ kind: "seal", ...at, name: "小明", museumNames: ["殷墟", "二里头", "郑州"], achName: "三代之源" }))
      .toBe("丙午年立冬，小明集殷墟、二里头、郑州之印，得「三代之源」。")
    expect(colophon({ kind: "scroll", ...at, name: "小明", museums: 14, layers: 20 }))
      .toBe("丙午年立冬，小明集十四馆之印，叠为二十层。")
    expect(colophon({ kind: "voyage", ...at, name: "小明", layers: 0 }))
      .toBe("丙午年立冬，小明溯洄而上，自今及于新石器。")
  })
  it("title slips", () => {
    expect(titleSlip({ kind: "tune", eras: ["唐", "宋", "明"] })).toBe("唐宋明三代合奏")
    expect(titleSlip({ kind: "tune", eras: ["西汉", "唐", "宋"] })).toBe("西汉·唐·宋三代合奏")
    expect(titleSlip({ kind: "tune", eras: Array(17).fill("唐") })).toBe("十七代合奏")
    expect(titleSlip({ kind: "tune", eras: [] })).toBe("百代合奏")
    expect(titleSlip({ kind: "voyage" })).toBe("溯洄图卷")
    expect(titleSlip({ kind: "seal", achName: "三代之源" })).toBe("三代之源")
    expect(titleSlip({ kind: "scroll", name: "小明" })).toBe("小明的长卷")
  })
  it("tune 引首 is picked by seed from the 遗音 set", () => {
    expect(["百代遗音", "金石之声", "丝竹余韵", "弦上千年"]).toContain(tuneYinshou(12345))
    expect(tuneYinshou(0)).toBe("百代遗音")
    expect(tuneYinshou(5)).toBe("金石之声")
  })
  it("page title", () => {
    expect(pageTitle("小明", "汉唐遗音")).toBe("小明寄来一卷 ·《汉唐遗音》")
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun test tests/scroll-text.test.ts`
Expected: FAIL — cannot find module `~/services/scroll-text`.

- [ ] **Step 3: Implement**

```ts
// src/services/scroll-text.ts
// 寄 · 手卷的文字：干支、汉字数字、题跋、签条、引首、季节句。Design: docs/superpowers/specs/寄.md §4.
import { currentSolarTerm } from "~/services/solar-term"

const STEMS = "甲乙丙丁戊己庚辛壬癸"
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥"

export function ganzhi(year: number): string {
  const k = year - 4
  return STEMS[((k % 10) + 10) % 10]! + BRANCHES[((k % 12) + 12) % 12]!
}

const D = "零一二三四五六七八九"
export function numZh(n: number): string {
  n = Math.max(0, Math.floor(n))
  if (n < 10) return D[n]!
  if (n < 20) return "十" + (n % 10 ? D[n % 10] : "")
  if (n < 100) return D[Math.floor(n / 10)] + "十" + (n % 10 ? D[n % 10] : "")
  const h = Math.floor(n / 100), r = n % 100
  if (!r) return D[h] + "百"
  return D[h] + "百" + (r < 10 ? "零" + D[r] : r < 20 ? "一" + numZh(r) : numZh(r))
}

/** 「唐朝（公元618年—907年）」→「唐」; 远古与新石器时代 → 新石器. */
export function eraShort(name: string): string {
  let n = String(name || "")
  const i = n.search(/[（(]/)
  if (i >= 0) n = n.slice(0, i)
  n = n.replace(/^东周：.*/, "东周").trim()
  if (/新石器/.test(n)) return "新石器"
  if (n.length === 2 && n.endsWith("朝") && n !== "南朝" && n !== "北朝") n = n.slice(0, 1)
  return n
}

const SEASON_OF: Record<string, "春" | "夏" | "秋" | "冬"> = {
  立春: "春", 雨水: "春", 惊蛰: "春", 春分: "春", 清明: "春", 谷雨: "春",
  立夏: "夏", 小满: "夏", 芒种: "夏", 夏至: "夏", 小暑: "夏", 大暑: "夏",
  立秋: "秋", 处暑: "秋", 白露: "秋", 秋分: "秋", 寒露: "秋", 霜降: "秋",
  立冬: "冬", 小雪: "冬", 大雪: "冬", 冬至: "冬", 小寒: "冬", 大寒: "冬",
}
export function seasonOf(term: string): "春" | "夏" | "秋" | "冬" {
  return SEASON_OF[term] ?? "春"
}

export const SEASON_LINES = {
  春: { text: "江南无所有，聊赠一枝春", src: "陆凯《赠范晔》" },
  夏: { text: "感此怀故人，中宵劳梦想", src: "孟浩然《夏日南亭怀辛大》" },
  秋: { text: "海上生明月，天涯共此时", src: "张九龄《望月怀远》" },
  冬: { text: "晚来天欲雪，能饮一杯无", src: "白居易《问刘十九》" },
} as const

/** 干支 and 节气 for the moment the scroll is sealed, in Beijing time. */
export function chinaNow(now: Date = new Date()): { ganzhi: string; term: string } {
  const bj = new Date(now.getTime() + 8 * 3600 * 1000)
  const local = new Date(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate())
  return { ganzhi: ganzhi(bj.getUTCFullYear()), term: currentSolarTerm(local).name }
}

export function museumList(names: string[]): string {
  if (names.length <= 3) return names.join("、")
  return names.slice(0, 2).join("、") + "等" + numZh(names.length) + "馆"
}

export type ColophonInput =
  | { kind: "tune"; ganzhi: string; term: string; name: string; museums: number; eras: string[] }
  | { kind: "voyage"; ganzhi: string; term: string; name: string; layers: number }
  | { kind: "seal"; ganzhi: string; term: string; name: string; museumNames: string[]; achName: string }
  | { kind: "scroll"; ganzhi: string; term: string; name: string; museums: number; layers: number }

export function colophon(c: ColophonInput): string {
  const head = c.ganzhi + "年" + c.term + "，" + c.name
  if (c.kind === "tune") {
    const what = c.eras.length && c.eras.length <= 4 ? c.eras.join("、") + numZh(c.eras.length) + "代" : numZh(c.eras.length || 20) + "代"
    return head + "以" + numZh(c.museums) + "馆之印，奏" + what + "之音。"
  }
  if (c.kind === "voyage") return head + "溯洄而上，自今及于新石器" + (c.layers ? "，所过" + numZh(c.layers) + "层。" : "。")
  if (c.kind === "seal") return head + "集" + museumList(c.museumNames) + "之印，得「" + c.achName + "」。"
  return head + "集" + numZh(c.museums) + "馆之印，叠为" + numZh(c.layers) + "层。"
}

export function titleSlip(t: { kind: "tune"; eras: string[] } | { kind: "voyage" } | { kind: "seal"; achName: string } | { kind: "scroll"; name: string }): string {
  if (t.kind === "voyage") return "溯洄图卷"
  if (t.kind === "seal") return t.achName
  if (t.kind === "scroll") return t.name + "的长卷"
  if (!t.eras.length) return "百代合奏"
  if (t.eras.length > 4) return numZh(t.eras.length) + "代合奏"
  const sep = t.eras.every((e) => e.length === 1) ? "" : "·"
  return t.eras.join(sep) + numZh(t.eras.length) + "代合奏"
}

const TUNE_YINSHOU = ["百代遗音", "金石之声", "丝竹余韵", "弦上千年"]
export function tuneYinshou(seed: number): string {
  return TUNE_YINSHOU[Math.abs(Math.floor(seed)) % TUNE_YINSHOU.length]!
}
export const VOYAGE_YINSHOU = "溯洄从之"
export const SCROLL_YINSHOU = "平生所见"

export function pageTitle(name: string, yinshou: string): string {
  return name + "寄来一卷 ·《" + yinshou + "》"
}
```

Note `tuneYinshou(5)` → index 1 → 「金石之声」 as the test expects.

- [ ] **Step 4: Run tests**

Run: `bun test tests/scroll-text.test.ts`
Expected: PASS. If `chinaNow` fails, check `currentSolarTerm` (it reads local `getMonth/getDate`; the `local` date above is constructed from Beijing Y/M/D so it is correct in any TZ).

- [ ] **Step 5: Commit**

```bash
git add src/services/scroll-text.ts tests/scroll-text.test.ts
git commit -m "feat(寄): scroll text — 干支, 汉字数字, 题跋, 签条, 引首, 季节句"
```

---

### Task 2: 引首 for every achievement

**Files:**
- Modify: `src/data/achievements.ts` (interface + every entry)
- Test: `tests/achievements-data.test.ts` (add a case)

- [ ] **Step 1: Add the failing test** — append inside the existing top-level `describe` in `tests/achievements-data.test.ts`:

```ts
  it("every achievement has a four-character 引首, all different", () => {
    const seen = new Set<string>()
    for (const a of ACHIEVEMENTS) {
      expect([...(a.yinshou || "")].length).toBe(4)
      expect(seen.has(a.yinshou)).toBe(false)
      seen.add(a.yinshou)
    }
  })
```

(If the file doesn't import `ACHIEVEMENTS` already, add `import { ACHIEVEMENTS } from "~/data/achievements"`.)

- [ ] **Step 2: Run** `bun test tests/achievements-data.test.ts` → FAIL (`yinshou` undefined).

- [ ] **Step 3: Implement.** In the `Achievement` interface add after `seal: string`:

```ts
  /** 寄此印：手卷引首的四个大字 (docs/superpowers/specs/寄.md §3). */
  yinshou: string
```

Then add `yinshou: "…",` right after each entry's `seal: "…",` using exactly this table:

| id | yinshou | | id | yinshou |
|---|---|---|---|---|
| theme-shiku | 佛光东渐 | | region-huabei | 表里山河 |
| theme-qiandu | 平城迁洛 | | region-dongbei | 林海雪原 |
| theme-gudu | 七都风烟 | | region-huadong | 烟雨江南 |
| theme-sandai | 三代遗风 | | region-huazhong | 问鼎中原 |
| theme-gushu | 蚕丛鱼凫 | | region-huanan | 日啖荔枝 |
| theme-diling | 事死如生 | | region-xinan | 巴山夜雨 |
| theme-liaogou | 千年木构 | | region-xibei | 大漠孤烟 |
| theme-qingtong | 金石可镂 | | region-gangaotai | 隔海相望 |
| theme-silu | 西出阳关 | | miles-1 | 始于足下 |
| theme-haisi | 梯航万里 | | miles-2 | 山河过半 |
| theme-ci | 雨过天青 | | miles-3 | 九州遍历 |
| theme-zhuhouwang | 金缕玉衣 | | era-xianqin | 郁郁乎文 |
| theme-sanguo | 三分天下 | | era-qinhan | 大风起兮 |
| theme-beichao | 秀骨清像 | | era-weijin | 魏晋风流 |
| theme-huangjia | 九重宫阙 | | era-suitang | 万国衣冠 |
| theme-gucha | 暮鼓晨钟 | | era-songyuan | 东京梦华 |
| theme-shuguang | 满天星斗 | | era-mingqing | 宫阙万间 |
| theme-duoyuan | 和而不同 | | chain-5 | 渐入佳境 |
| | | | chain-10 | 半部春秋 |
| | | | chain-20 | 源远流长 |

- [ ] **Step 4: Run** `bun test tests/achievements-data.test.ts tests/achievements-core.test.ts && bun run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/achievements.ts tests/achievements-data.test.ts
git commit -m "feat(寄): 引首 for every achievement"
```

---

### Task 3: Migration, repo, sensitive filter

**Files:**
- Create: `migrations/0016_share_scrolls.sql`, `src/repo/scrolls.ts`, `src/lib/sensitive.ts`
- Test: `tests/scrolls-repo.test.ts`, `tests/sensitive.test.ts`

- [ ] **Step 1: Write the migration**

```sql
-- 寄 · 手卷分享 (docs/superpowers/specs/寄.md §7). Additive only.
CREATE TABLE IF NOT EXISTS share_scrolls (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS share_guan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scroll_id TEXT NOT NULL REFERENCES share_scrolls(id) ON DELETE CASCADE,
  name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_share_guan_scroll ON share_guan(scroll_id, created_at);
```

Apply locally: `bunx wrangler d1 migrations apply museum-map-db --local` → expect `0016_share_scrolls.sql ✅`. (Do NOT apply remote; the controller does that after user approval.)

- [ ] **Step 2: Write failing tests**

```ts
// tests/sensitive.test.ts
import { describe, it, expect } from "bun:test"
import { cleanName, cleanLine } from "~/lib/sensitive"

describe("sensitive", () => {
  it("cleans names", () => {
    expect(cleanName("  小明 ", 8)).toBe("小明")
    expect(cleanName("", 8)).toBe("")
    expect(cleanName("一二三四五六七八九", 8)).toBe("一二三四五六七八")
    expect(cleanName("<b>x</b>", 8)).toBe("bxb")
    expect(cleanName("http://spam.com", 8)).toBe("")
    expect(cleanName("加我微信", 8)).toBe("")
  })
  it("cleans lines", () => {
    expect(cleanLine("今天在洛阳，雪很大。", 40)).toBe("今天在洛阳，雪很大。")
    expect(cleanLine("a\n\nb", 40)).toBe("a b")
    expect(cleanLine("www.x.cn 优惠", 40)).toBe("")
  })
})
```

```ts
// tests/scrolls-repo.test.ts
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { ScrollsRepo, newScrollId } from "~/repo/scrolls"

async function db() {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" }, d1Persist: ".wrangler/state/v3/d1" })
  return await mf.getD1Database("DB")
}

describe("ScrollsRepo", () => {
  it("ids are 8 chars from an unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) expect(newScrollId()).toMatch(/^[a-hjkmnp-z2-9]{8}$/)
  })
  it("creates, reads, and collects 观款", async () => {
    const repo = new ScrollsRepo(await db())
    const id = await repo.create({ kind: "voyage", payload: { name: "小明", visitedIds: ["guobo"] }, userId: null })
    const s = await repo.get(id)
    expect(s?.kind).toBe("voyage")
    expect(s?.payload.name).toBe("小明")
    expect(await repo.get("nope0000")).toBeNull()
    await repo.addGuan(id, "阿青")
    await repo.addGuan(id, null)
    const g = await repo.listGuan(id, 30)
    expect(g.count).toBe(2)
    expect(g.items.map((x) => x.name)).toEqual([null, "阿青"]) // newest first
  })
})
```

- [ ] **Step 3: Run** `bun test tests/sensitive.test.ts tests/scrolls-repo.test.ts` → FAIL (modules missing).

- [ ] **Step 4: Implement**

```ts
// src/lib/sensitive.ts
// Names and one-line notes typed on public scrolls. Short, plain text only; anything that looks
// like an ad or contact handle is dropped rather than shown.
const BLOCK = [
  /https?:|www\.|\.com|\.cn|\.net/i,
  /微信|vx|v信|加我|qq|电话|手机号|优惠|代购|返利|兼职|博彩|赌|色情|约炮/i,
  /习近平|共产党|法轮|台独|藏独|六四/,
]
function base(s: unknown): string {
  return String(s ?? "").replace(/[<>"'`\\]/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
}
function ok(s: string): boolean { return !BLOCK.some((r) => r.test(s)) }
export function cleanName(s: unknown, max: number): string {
  const t = [...base(s).replace(/[\/]/g, "")].slice(0, max).join("")
  return t && ok(t) ? t : ""
}
export function cleanLine(s: unknown, max: number): string {
  const t = [...base(s)].slice(0, max).join("")
  return t && ok(t) ? t : ""
}
```

Check `cleanName("<b>x</b>", 8)` → `base` strips `<>` giving `b>x</b` … wait — `base` removes `<` `>` → `bx/b`, then `/` removed → `bxb`. ✓

```ts
// src/repo/scrolls.ts
export type ScrollKind = "tune" | "voyage" | "seal" | "scroll"
export interface ScrollRow { id: string; kind: ScrollKind; payload: any; userId: string | null; createdAt: number }

const ALPHA = "abcdefghjkmnpqrstuvwxyz23456789"
export function newScrollId(): string {
  const b = new Uint8Array(8)
  crypto.getRandomValues(b)
  return [...b].map((x) => ALPHA[x % ALPHA.length]).join("")
}

export class ScrollsRepo {
  constructor(private db: D1Database) {}

  async create(s: { kind: ScrollKind; payload: unknown; userId: string | null }): Promise<string> {
    for (let i = 0; i < 4; i++) {
      const id = newScrollId()
      const r = await this.db
        .prepare("INSERT OR IGNORE INTO share_scrolls (id, kind, payload, user_id, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(id, s.kind, JSON.stringify(s.payload), s.userId, Date.now()).run()
      if (r.meta.changes) return id
    }
    throw new Error("could not allocate scroll id")
  }

  async get(id: string): Promise<ScrollRow | null> {
    const row = await this.db.prepare("SELECT id, kind, payload, user_id, created_at FROM share_scrolls WHERE id = ?")
      .bind(id).first<{ id: string; kind: ScrollKind; payload: string; user_id: string | null; created_at: number }>()
    if (!row) return null
    return { id: row.id, kind: row.kind, payload: JSON.parse(row.payload), userId: row.user_id, createdAt: row.created_at }
  }

  async addGuan(scrollId: string, name: string | null): Promise<void> {
    await this.db.prepare("INSERT INTO share_guan (scroll_id, name, created_at) VALUES (?, ?, ?)")
      .bind(scrollId, name, Date.now()).run()
  }

  async listGuan(scrollId: string, limit: number): Promise<{ count: number; items: { name: string | null; at: number }[] }> {
    const [c, rows] = await Promise.all([
      this.db.prepare("SELECT COUNT(*) AS n FROM share_guan WHERE scroll_id = ?").bind(scrollId).first<{ n: number }>(),
      this.db.prepare("SELECT name, created_at AS at FROM share_guan WHERE scroll_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
        .bind(scrollId, limit).all<{ name: string | null; at: number }>(),
    ])
    return { count: c?.n ?? 0, items: rows.results }
  }
}
```

- [ ] **Step 5: Run** the two test files again → PASS. Then `bun run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add migrations/0016_share_scrolls.sql src/repo/scrolls.ts src/lib/sensitive.ts tests/scrolls-repo.test.ts tests/sensitive.test.ts
git commit -m "feat(寄): share_scrolls + share_guan tables, repo, name filter"
```

---

### Task 4: scroll-narration — the 画心 notes

Builds everything the page shows, from a snapshot plus catalog data. Pure function; the route passes in museums and dynasties.

**Files:**
- Create: `src/services/scroll-narration.ts`
- Test: `tests/scroll-narration.test.ts`

**Data sources (read them):** `src/data/era-voices.ts` (`ERA_VOICES[dynId] = { inst, src?: { museumId, artifact } }`), `src/data/era-tunes.ts` (`ERA_TUNES[dynId] = [{ name, story, from }]`), `src/data/dynasty-geo.ts` (`DYNASTY_GEO[dynId] = { sites, trail }`), `src/data/achievements.ts`, `src/data/achievement-labels.ts` (`ACHIEVEMENT_LABELS[id]` = 展签 text), dynasties from `DynastiesRepo.listFull()` (fields used: `id`, `name`, `period`, `events: {date, event}[]`, `culture: {category, description}[]`, `recommendedMuseums`/`relatedMuseums: {museumId}[]`), museums from `MuseumsRepo.list()` (`id`, `name`).

Museum↔layer links must match the strata view: a museum belongs to a dynasty layer if it appears in that dynasty's `recommendedMuseums` or `relatedMuseums` (see `src/ui/client/strata.ts` ~line 462).

- [ ] **Step 1: Write the failing test**

```ts
// tests/scroll-narration.test.ts
import { describe, it, expect } from "bun:test"
import { buildScroll } from "~/services/scroll-narration"

const dynasties: any[] = [
  { id: "neolithic", name: "远古与新石器时代（约公元前10000年—前2070年）", period: "约公元前10000年—前2070年", events: [], culture: [], recommendedMuseums: [{ museumId: "henan" }] },
  { id: "eastern-zhou", name: "东周：春秋与战国（公元前770年—前221年）", period: "公元前770年—前221年",
    events: [{ date: "前770年", event: "平王东迁洛邑" }], culture: [{ category: "百家争鸣", description: "诸子并起" }], recommendedMuseums: [{ museumId: "hubei" }] },
  { id: "tang", name: "唐朝（公元618年—907年）", period: "公元618年—907年",
    events: [{ date: "618年", event: "李渊建唐，定都长安" }], culture: [{ category: "唐诗", description: "中国古典诗歌的巅峰" }],
    recommendedMuseums: [{ museumId: "shaanxi" }], relatedMuseums: [{ museumId: "guobo" }] },
]
const museums: any[] = [
  { id: "henan", name: "河南博物院" }, { id: "hubei", name: "湖北省博物馆" },
  { id: "shaanxi", name: "陕西历史博物馆" }, { id: "guobo", name: "中国国家博物馆" },
]
const at = { ganzhi: "丙午", term: "立冬" }

describe("buildScroll", () => {
  it("tune: eras played, instruments with their source object, 名曲 with provenance", () => {
    const s = buildScroll({ kind: "tune", payload: { name: "小明", visitedIds: ["hubei", "shaanxi"], seed: 5, era: null, ...at } }, { museums, dynasties })
    expect(s.slip).toBe("东周·唐二代合奏")
    expect(s.yinshou).toBe("金石之声")
    expect(s.colophon).toBe("丙午年立冬，小明以二馆之印，奏东周、唐二代之音。")
    const zhou = s.notes.find((n) => n.dynastyId === "eastern-zhou")!
    expect(zhou.title).toBe("东周")
    expect(zhou.lines[0]).toBe("编钟 · 声取自湖北省博物馆「曾侯乙编钟」")
    expect(zhou.tunes[0]).toEqual({ name: "高山流水", story: "伯牙鼓琴，钟子期知音（《列子·汤问》）", from: "今所奏出自明《神奇秘谱》" })
    expect(s.notes.map((n) => n.dynastyId)).toEqual(["eastern-zhou", "tang"]) // only eras with stamps, old → new
    expect(s.seals.map((x) => x.name)).toEqual(["湖北省博物馆", "陕西历史博物馆"])
  })
  it("tune: lyrics-only tunes say so honestly", () => {
    const s = buildScroll({ kind: "tune", payload: { name: "小明", visitedIds: [], seed: 0, era: null, ...at } },
      { museums, dynasties: [{ id: "nanbeichao", name: "南北朝（公元420年—589年）", period: "", events: [], culture: [] }] as any })
    // no stamps → every era plays; 敕勒歌 is 仅存歌词
    const nb = s.notes.find((n) => n.dynastyId === "nanbeichao")!
    expect(nb.tunes[0]!.from).toBe("曲调已失传，仅存歌词")
  })
  it("voyage: one event, one culture line, capital, where you saw it; new → old", () => {
    const s = buildScroll({ kind: "voyage", payload: { name: "小明", visitedIds: ["shaanxi", "guobo"], ...at } }, { museums, dynasties })
    expect(s.slip).toBe("溯洄图卷")
    expect(s.yinshou).toBe("溯洄从之")
    expect(s.notes.map((n) => n.dynastyId)).toEqual(["tang", "eastern-zhou", "neolithic"])
    const tang = s.notes[0]!
    expect(tang.lines).toContain("618年 · 李渊建唐，定都长安")
    expect(tang.lines).toContain("唐诗 · 中国古典诗歌的巅峰")
    expect(tang.lines.some((l) => l.startsWith("都城 · "))).toBe(true)
    expect(tang.seen).toBe("TA 在 陕西历史博物馆、中国国家博物馆 见过这一层")
    expect(s.colophon).toBe("丙午年立冬，小明溯洄而上，自今及于新石器，所过一层。")
  })
  it("seal: 展签, 所见, colophon", () => {
    const s = buildScroll({ kind: "seal", payload: { name: "小明", visitedIds: ["yungang", "longmen", "mogao"], achId: "theme-shiku", ...at } },
      { museums: [{ id: "yungang", name: "云冈石窟" }, { id: "longmen", name: "龙门石窟" }, { id: "mogao", name: "莫高窟" }] as any, dynasties })
    expect(s.slip).toBe("石窟寺")
    expect(s.yinshou).toBe("佛光东渐")
    expect(s.seal?.labelTitle).toBe("佛像的脸，是怎么一点点变成中国人的脸的")
    expect(s.seal?.label.length).toBeGreaterThan(20)
    expect(s.seal?.seen).toEqual(["云冈石窟", "龙门石窟", "莫高窟"])
    expect(s.colophon).toBe("丙午年立冬，小明集云冈石窟、龙门石窟、莫高窟之印，得「石窟寺」。")
  })
  it("scroll: 长卷", () => {
    const s = buildScroll({ kind: "scroll", payload: { name: "小明", visitedIds: ["hubei", "shaanxi", "guobo"], ...at } }, { museums, dynasties })
    expect(s.slip).toBe("小明的长卷")
    expect(s.yinshou).toBe("平生所见")
    expect(s.colophon).toBe("丙午年立冬，小明集三馆之印，叠为二层。")
  })
  it("season line and title", () => {
    const s = buildScroll({ kind: "voyage", payload: { name: "小明", visitedIds: [], ...at } }, { museums, dynasties })
    expect(s.season).toEqual({ text: "晚来天欲雪，能饮一杯无", src: "白居易《问刘十九》" })
    expect(s.title).toBe("小明寄来一卷 ·《溯洄从之》")
  })
})
```

- [ ] **Step 2: Run** `bun test tests/scroll-narration.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/services/scroll-narration.ts
// 寄 · 手卷的画心旁注与全部文字。Only checked data — dynasty yaml, era voices, 名曲, 展签.
import { ERA_VOICES } from "~/data/era-voices"
import { ERA_TUNES } from "~/data/era-tunes"
import { DYNASTY_GEO } from "~/data/dynasty-geo"
import { ACHIEVEMENTS } from "~/data/achievements"
import { ACHIEVEMENT_LABELS } from "~/data/achievement-labels"
import {
  colophon, eraShort, pageTitle, seasonOf, SEASON_LINES, titleSlip, tuneYinshou, VOYAGE_YINSHOU, SCROLL_YINSHOU,
} from "~/services/scroll-text"
import type { ScrollKind } from "~/repo/scrolls"

export interface ScrollPayload {
  name: string
  line?: string
  visitedIds: string[]
  ganzhi: string
  term: string
  seed?: number
  /** tune: dynasty id the performance was focused on, or null for the whole stack */
  era?: string | null
  achId?: string
}
export interface Note {
  dynastyId: string
  title: string
  period: string
  lines: string[]
  tunes: { name: string; story: string; from: string }[]
  seen: string
}
export interface BuiltScroll {
  kind: ScrollKind
  name: string
  line: string
  slip: string
  yinshou: string
  season: { text: string; src: string }
  title: string
  colophon: string
  notes: Note[]
  seal: { id: string; name: string; seal: string; labelTitle: string; label: string; why: string; seen: string[] } | null
  seals: { id: string; name: string }[]
  visitedIds: string[]
  seed: number | null
  era: string | null
}

type Dyn = { id: string; name: string; period?: string; events?: { date: string; event: string }[]; culture?: { category: string; description: string }[]; recommendedMuseums?: { museumId: string }[]; relatedMuseums?: { museumId: string }[] }
type Mus = { id: string; name: string }

function shortSite(n: string): string { const i = n.search(/[（(]/); return (i >= 0 ? n.slice(0, i) : n).trim() }

function capitalLine(id: string): string {
  const g = DYNASTY_GEO[id]
  if (!g || !g.sites.length) return ""
  if (g.sites.every((s) => s.role === "culture")) return "满天星斗 · " + g.sites.slice(0, 4).map((s) => shortSite(s.name)).join("、") + (g.sites.length > 4 ? " 等" : "")
  const names: string[] = []
  g.trail.forEach((k) => { const s = g.sites[k]; const n = s && shortSite(s.name); if (n && !names.includes(n)) names.push(n) })
  return names.length ? "都城 · " + names.join(" → ") : ""
}

function period(p?: string): string {
  return String(p || "").replace(/约?公元/g, "").replace(/年/g, "").replace(/—/g, "–")
}

export function buildScroll(s: { kind: ScrollKind; payload: ScrollPayload }, cat: { museums: Mus[]; dynasties: Dyn[] }): BuiltScroll {
  const p = s.payload
  const name = p.name || "无名氏"
  const museumById = new Map(cat.museums.map((m) => [m.id, m]))
  const visited = (p.visitedIds || []).filter((id) => museumById.has(id))
  const visitedSet = new Set(visited)
  const at = { ganzhi: p.ganzhi, term: p.term }
  // layer membership, same rule as the strata view
  const byLayer = new Map<string, string[]>()
  for (const d of cat.dynasties) {
    const ids = [...(d.recommendedMuseums || []), ...(d.relatedMuseums || [])].map((r) => r.museumId)
    byLayer.set(d.id, [...new Set(ids)].filter((id) => visitedSet.has(id)))
  }
  const stampedLayers = cat.dynasties.filter((d) => (byLayer.get(d.id) || []).length)
  const seals = visited.map((id) => ({ id, name: museumById.get(id)!.name }))
  const seenLine = (d: Dyn) => {
    const ms = (byLayer.get(d.id) || []).map((id) => museumById.get(id)!.name)
    return ms.length ? "TA 在 " + ms.slice(0, 2).join("、") + (ms.length > 2 ? " 等" + ms.length + "馆" : "") + " 见过这一层" : ""
  }
  let slip = "", yinshou = "", colo = "", notes: Note[] = [], seal: BuiltScroll["seal"] = null

  if (s.kind === "tune") {
    const focus = p.era ? cat.dynasties.filter((d) => d.id === p.era) : stampedLayers.length ? stampedLayers : cat.dynasties
    const eras = focus.map((d) => eraShort(d.name))
    slip = titleSlip({ kind: "tune", eras: stampedLayers.length || p.era ? eras : [] })
    yinshou = tuneYinshou(p.seed ?? 0)
    colo = colophon({ kind: "tune", ...at, name, museums: visited.length, eras: stampedLayers.length || p.era ? eras : [] })
    notes = focus.map((d) => {
      const v = ERA_VOICES[d.id]
      const src = v?.src ? museumById.get(v.src.museumId) : null
      const lines = v ? [v.inst + (v.src && src ? " · 声取自" + src.name + "「" + v.src.artifact + "」" : " · 示意")] : []
      const tunes = (ERA_TUNES[d.id] || []).map((t) => ({
        name: t.name, story: t.story,
        from: t.from === "仅存歌词" ? "曲调已失传，仅存歌词" : "今所奏出自" + t.from,
      }))
      return { dynastyId: d.id, title: eraShort(d.name), period: period(d.period), lines, tunes, seen: seenLine(d) }
    })
  } else if (s.kind === "voyage") {
    slip = titleSlip({ kind: "voyage" }); yinshou = VOYAGE_YINSHOU
    colo = colophon({ kind: "voyage", ...at, name, layers: stampedLayers.length })
    notes = [...cat.dynasties].reverse().map((d) => {
      const lines: string[] = []
      const ev = (d.events || [])[0]; if (ev) lines.push(ev.date + " · " + ev.event)
      const cu = (d.culture || [])[0]; if (cu) lines.push(cu.category + " · " + cu.description)
      const cap = capitalLine(d.id); if (cap) lines.push(cap)
      return { dynastyId: d.id, title: eraShort(d.name), period: period(d.period), lines, tunes: [], seen: seenLine(d) }
    })
  } else if (s.kind === "seal") {
    const a = ACHIEVEMENTS.find((x) => x.id === p.achId)
    if (!a) throw new Error("unknown achievement")
    const memberIds = (a.members || []).map((m) => ("museum" in m ? m.museum : null)).filter(Boolean) as string[]
    const seenIds = memberIds.length ? memberIds.filter((id) => visitedSet.has(id)) : visited
    const seen = seenIds.map((id) => museumById.get(id)?.name).filter(Boolean) as string[]
    slip = titleSlip({ kind: "seal", achName: a.name }); yinshou = a.yinshou
    colo = colophon({ kind: "seal", ...at, name, museumNames: seen.length ? seen : seals.map((x) => x.name), achName: a.name })
    seal = { id: a.id, name: a.name, seal: a.seal, labelTitle: a.labelTitle, label: ACHIEVEMENT_LABELS[a.id] || "", why: a.why, seen }
  } else {
    slip = titleSlip({ kind: "scroll", name }); yinshou = SCROLL_YINSHOU
    colo = colophon({ kind: "scroll", ...at, name, museums: visited.length, layers: stampedLayers.length })
  }
  return {
    kind: s.kind, name, line: p.line || "", slip, yinshou,
    season: { ...SEASON_LINES[seasonOf(p.term)] }, title: pageTitle(name, yinshou), colophon: colo,
    notes, seal, seals, visitedIds: visited, seed: p.seed ?? null, era: p.era ?? null,
  }
}
```

Check the tune test: 东周 + 唐 stamped (hubei, shaanxi) → eras ["东周","唐"] → slip `东周·唐二代合奏` (not all single-char → `·`), colophon `奏东周、唐二代之音`. ✓. Seal for `theme-shiku` with members including a UUID not in museums: seen = visited members in order of `members` → 云冈、龙门、莫高. ✓ (If `ACHIEVEMENT_LABELS` export name differs, read `src/data/achievement-labels.ts` and adapt the import.)

- [ ] **Step 4: Run** `bun test tests/scroll-narration.test.ts && bun run typecheck` → PASS. Fix the implementation (not the expectations) unless an expectation contradicts the data files — then fix the expectation and say so in your report.

- [ ] **Step 5: Commit**

```bash
git add src/services/scroll-narration.ts tests/scroll-narration.test.ts
git commit -m "feat(寄): build the scroll — 画心 notes, 题跋, 签条, 引首 from checked data"
```

---

### Task 5: Routes — seal a scroll, 观款, old link redirect

**Files:**
- Create: `src/routes/scrolls.ts`
- Modify: `src/index.ts` (register `scrollsRoute`; keep `shareRoute` for now — Task 9 removes it)
- Test: `tests/scrolls-route.test.ts`

Behaviour:
- `POST /api/scrolls` body `{ kind, name?, line?, visitedIds?, seed?, era?, achId? }`
  - `kind` ∈ tune|voyage|seal|scroll else 400 `{ error: "bad kind" }`.
  - `visitedIds`: array, ≤ 400 entries, strings, filtered to existing museum ids (`MuseumsRepo.list()`).
  - `seed`: integer 0..2147483646 required for `tune` (else 400). `era`: a dynasty id or null.
  - `achId`: must be in `ACHIEVEMENTS` for `seal` (else 400).
  - Signed-in user (`sessionMiddleware`, `c.user`): `userId = user.id`; default name = `user.display_name || user.handle`.
  - `name = cleanName(body.name, 12) || default || "无名氏"`; `line = cleanLine(body.line, 40)`.
  - `{ganzhi, term} = chinaNow()` frozen into payload.
  - Rate: `checkAndIncrement(env.RATE, "rate:scroll:" + ip + ":" + yyyymmdd, 30, 86400)` → 429 `{ error: "今日封卷已多，明日再寄" }`.
  - Returns `{ id, url: "/s/" + id }`.
- `GET /api/s/:id/guan` → `{ count, items }` (limit 30), 404 if no scroll.
- `POST /api/s/:id/guan` body `{ name? }` → `cleanName(name, 8) || null`; one per IP per scroll via KV key `guan:<id>:<ip>` (TTL 30 days) → 409 `{ error: "已钤过" }`; IP daily cap 40 via `checkAndIncrement(env.RATE, "rate:guan:" + ip + ":" + yyyymmdd, 40, 86400)` → 429. Returns the new list.
- `GET /u/:handle/share` → 301 to `/u/:handle`.
- `GET /s/:id` is added in Task 6 (page); in this task return 404 text for now is NOT needed — just don't add it yet.

- [ ] **Step 1: Write failing tests** (reuse `makeEnv` from `tests/achievements-route.test.ts` — copy the function; museum ids `guobo` and `shaanxi` exist in local D1 after restore/seed; if your run's D1 is the legacy seed, `guobo` still exists).

```ts
// tests/scrolls-route.test.ts
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" }, d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"], r2Buckets: ["IMAGES"] })
  return { DB: await mf.getD1Database("DB"), RATE: await mf.getKVNamespace("RATE"), IMAGES: await mf.getR2Bucket("IMAGES") } as any
}
const post = (app: any, path: string, body: unknown, ip = "1.2.3.4") =>
  app.handle(new Request("http://x" + path, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }))

describe("scrolls routes", () => {
  it("seals a voyage scroll with a frozen 干支 and filtered stamps", async () => {
    const app = createApp(await makeEnv())
    const r = await post(app, "/api/scrolls", { kind: "voyage", name: " 小明 ", visitedIds: ["guobo", "not-a-museum"] }, "10.0.0.1")
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.id).toMatch(/^[a-hjkmnp-z2-9]{8}$/)
    expect(j.url).toBe("/s/" + j.id)
    const env = await makeEnv()
    const row: any = await env.DB.prepare("SELECT payload FROM share_scrolls WHERE id = ?").bind(j.id).first()
    const p = JSON.parse(row.payload)
    expect(p.name).toBe("小明")
    expect(p.visitedIds).toEqual(["guobo"])
    expect(p.ganzhi).toMatch(/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/)
    expect(typeof p.term).toBe("string")
  })
  it("validates kind, seed, achId", async () => {
    const app = createApp(await makeEnv())
    expect((await post(app, "/api/scrolls", { kind: "poster" }, "10.0.0.2")).status).toBe(400)
    expect((await post(app, "/api/scrolls", { kind: "tune" }, "10.0.0.2")).status).toBe(400)
    expect((await post(app, "/api/scrolls", { kind: "seal", achId: "nope" }, "10.0.0.2")).status).toBe(400)
    expect((await post(app, "/api/scrolls", { kind: "tune", seed: 42 }, "10.0.0.2")).status).toBe(200)
    expect((await post(app, "/api/scrolls", { kind: "seal", achId: "theme-shiku" }, "10.0.0.2")).status).toBe(200)
  })
  it("defaults the name to 无名氏 and drops ads", async () => {
    const app = createApp(await makeEnv())
    const j = await (await post(app, "/api/scrolls", { kind: "scroll", name: "加我微信", line: "www.x.cn" }, "10.0.0.3")).json()
    const env = await makeEnv()
    const p = JSON.parse(((await env.DB.prepare("SELECT payload FROM share_scrolls WHERE id = ?").bind(j.id).first()) as any).payload)
    expect(p.name).toBe("无名氏")
    expect(p.line).toBe("")
  })
  it("观款: one per IP per scroll, names filtered", async () => {
    const app = createApp(await makeEnv())
    const { id } = await (await post(app, "/api/scrolls", { kind: "voyage" }, "10.0.0.4")).json()
    const g1 = await post(app, "/api/s/" + id + "/guan", { name: "阿青" }, "10.0.0.5")
    expect(g1.status).toBe(200)
    expect((await g1.json()).items[0].name).toBe("阿青")
    expect((await post(app, "/api/s/" + id + "/guan", { name: "又来" }, "10.0.0.5")).status).toBe(409)
    const g3 = await post(app, "/api/s/" + id + "/guan", { name: "http://x" }, "10.0.0.6")
    expect((await g3.json()).items[0].name).toBeNull()
    const list = await (await app.handle(new Request("http://x/api/s/" + id + "/guan"))).json()
    expect(list.count).toBe(2)
    expect((await post(app, "/api/s/zzzzzzzz/guan", {}, "10.0.0.7")).status).toBe(404)
  })
  it("old poster link redirects to the profile", async () => {
    const app = createApp(await makeEnv())
    const r = await app.handle(new Request("http://x/u/somebody/share"))
    expect(r.status).toBe(301)
    expect(r.headers.get("location")).toBe("/u/somebody")
  })
})
```

Note on route order: the old `shareRoute` also defines `GET /u/:handle/share`. Register `scrollsRoute` **before** `shareRoute` in `src/index.ts` so the redirect wins (or delete the handler from share.ts now — Task 9 deletes the whole file anyway). If Elysia complains about a duplicate route, delete the old handler's `.get("/u/:handle/share", …)` registration by removing `.use(shareRoute)` from `src/index.ts` (keep the file; Task 9 deletes it).

- [ ] **Step 2: Run** `bun test tests/scrolls-route.test.ts` → FAIL.

- [ ] **Step 3: Implement** `src/routes/scrolls.ts`:

```ts
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { sessionMiddleware } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import { ScrollsRepo, type ScrollKind } from "~/repo/scrolls"
import { MuseumsRepo } from "~/repo/museums"
import { DynastiesRepo } from "~/repo/dynasties"
import { ACHIEVEMENTS } from "~/data/achievements"
import { cleanLine, cleanName } from "~/lib/sensitive"
import { chinaNow } from "~/services/scroll-text"
import { checkAndIncrement } from "~/lib/rateLimit"
import { getClientIp } from "~/lib/getClientIp"

interface Ctx { env: Env; body: any; set: any; params: Record<string, string>; request: Request; user: UserRow | null }
const KINDS = new Set<ScrollKind>(["tune", "voyage", "seal", "scroll"])
const ACH = new Set(ACHIEVEMENTS.map((a) => a.id))
const day = () => new Date().toISOString().slice(0, 10).replace(/-/g, "")
const ID_RE = /^[a-hjkmnp-z2-9]{8}$/

export const scrollsRoute = new Elysia()
  .use(sessionMiddleware)
  .post("/api/scrolls", async (ctx) => {
    const c = ctx as unknown as Ctx
    const b = c.body || {}
    const kind = b.kind as ScrollKind
    if (!KINDS.has(kind)) { c.set.status = 400; return { error: "bad kind" } }
    const seed = Number(b.seed)
    if (kind === "tune" && !(Number.isInteger(seed) && seed >= 0 && seed < 2147483647)) { c.set.status = 400; return { error: "bad seed" } }
    if (kind === "seal" && !ACH.has(String(b.achId))) { c.set.status = 400; return { error: "bad achievement" } }
    const ip = getClientIp(c.request)
    const rate = await checkAndIncrement(c.env.RATE, "rate:scroll:" + ip + ":" + day(), 30, 86400)
    if (!rate.ok) { c.set.status = 429; return { error: "今日封卷已多，明日再寄" } }
    const [museums, dynasties] = await Promise.all([new MuseumsRepo(c.env.DB).list(), kind === "tune" && b.era ? new DynastiesRepo(c.env.DB).listFull() : Promise.resolve([])])
    const known = new Set(museums.map((m) => m.id))
    const raw: unknown[] = Array.isArray(b.visitedIds) ? b.visitedIds.slice(0, 400) : []
    const visitedIds = [...new Set(raw.map(String))].filter((id) => known.has(id))
    const u = c.user
    const name = cleanName(b.name, 12) || (u ? cleanName((u as any).display_name || (u as any).handle, 12) : "") || "无名氏"
    const payload: Record<string, unknown> = { name, line: cleanLine(b.line, 40), visitedIds, ...chinaNow() }
    if (kind === "tune") {
      payload.seed = seed
      payload.era = b.era && dynasties.some((d: any) => d.id === b.era) ? String(b.era) : null
    }
    if (kind === "seal") payload.achId = String(b.achId)
    const id = await new ScrollsRepo(c.env.DB).create({ kind, payload, userId: u ? u.id : null })
    return { id, url: "/s/" + id }
  })
  .get("/api/s/:id/guan", async (ctx) => {
    const c = ctx as unknown as Ctx
    const repo = new ScrollsRepo(c.env.DB)
    const id = String(c.params.id || "")
    if (!ID_RE.test(id) || !(await repo.get(id))) { c.set.status = 404; return { error: "此卷已佚" } }
    return await repo.listGuan(id, 30)
  })
  .post("/api/s/:id/guan", async (ctx) => {
    const c = ctx as unknown as Ctx
    const repo = new ScrollsRepo(c.env.DB)
    const id = String(c.params.id || "")
    if (!ID_RE.test(id) || !(await repo.get(id))) { c.set.status = 404; return { error: "此卷已佚" } }
    const ip = getClientIp(c.request)
    const once = "guan:" + id + ":" + ip
    if (await c.env.RATE.get(once)) { c.set.status = 409; return { error: "已钤过" } }
    const rate = await checkAndIncrement(c.env.RATE, "rate:guan:" + ip + ":" + day(), 40, 86400)
    if (!rate.ok) { c.set.status = 429; return { error: "今日钤印已多" } }
    await c.env.RATE.put(once, "1", { expirationTtl: 30 * 86400 })
    await repo.addGuan(id, cleanName(c.body?.name, 8) || null)
    return await repo.listGuan(id, 30)
  })
  .get("/u/:handle/share", (ctx) => {
    const c = ctx as unknown as Ctx
    return new Response(null, { status: 301, headers: { location: "/u/" + encodeURIComponent(String(c.params.handle || "")) } })
  })
```

Check `UserRow` field names in `src/repo/users.ts` (`display_name`, `handle`) and adjust the casts if typed. Register in `src/index.ts`: `import { scrollsRoute } from "~/routes/scrolls"` and `.use(scrollsRoute)` before `.use(shareRoute)` (or remove `.use(shareRoute)` per the note above).

- [ ] **Step 4: Apply migration locally if not yet** (`bunx wrangler d1 migrations apply museum-map-db --local`), run `bun test tests/scrolls-route.test.ts && bun run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/scrolls.ts src/index.ts tests/scrolls-route.test.ts
git commit -m "feat(寄): seal scrolls, 观款, old poster link redirects"
```

---

### Task 6: Strata — guest mode, replay API, 寄此曲 / 寄此行

**Files:**
- Modify: `src/ui/client/strata.ts` (inside the `STRATA_MODULE` string — no backticks!)

Changes, all inside `init(container, data, cb)`:

1. **Guest mode.** `const guest = !!data.guest;` If guest:
   - don't append the 奏一曲 / 溯洄 action buttons (`actions` element) — hide with `actions.style.display = 'none'` after creation;
   - museum / layer clicks don't call `cb.onMuseum` / `cb.onDynasty` (they're absent in the guest cb anyway — make sure every call is guarded `cb.onX && cb.onX(...)`; grep `cb.on` and fix any unguarded call);
   - the era-map button (`cb.onEraMap`) is not shown when `cb.onEraMap` is absent (check how it's created near line 1531 and guard it);
   - in `voyCaption` end card: text uses `'百代过客，TA 走过其中 ' + n + ' 层'` and no 再溯一次 / 回到今天 buttons (the page has its own controls); in non-guest mode, add a third button **寄此行** (class `vc-btn`) that calls `cb.onSend && cb.onSend({ kind: 'voyage' })`, shown only when `cb.onSend` exists;
   - in guest mode the "你在 XX 见过这一层" line in `voyCaption` says `'TA 在 '` instead of `'你在 '`.
2. **寄此曲.** After a full performance ends naturally (in `tickPlay`, the branch `if (c > play.end) stopPlay();`), remember `lastTune = { seed: perf.seed, era: play.focus >= 0 ? layers[play.focus].id : null }` before stopping, then show a small button **寄此曲** next to the play button (inside `actions`, class `strata-ji`), only when `cb.onSend` exists and not guest. Clicking it calls `cb.onSend({ kind: 'tune', seed: lastTune.seed, era: lastTune.era })` and hides the button. Hide it again when a new performance or 溯洄 starts. Style: copy the play button's look (find its CSS in `src/ui/theme.ts`, selector for `.strata-actions` buttons) and add `.strata-ji` beside it with the same height, `btn-ghost`-like border, vermilion text.
3. **Replay API.** Make `startPlay` accept `o`: `function startPlay(o) { ...; const F = o && o.era != null ? layerIndexById[o.era] : state.focus; const c = balance(compose(F, o && o.seed != null ? { seed: o.seed } : undefined)); ... }`. If `layerIndexById` isn't in scope there, build `const idxById = {}; layers.forEach((L) => { idxById[L.id] = L.i; });` near the layers definition and use it. The playBtn handler keeps calling `startPlay()` with no args.
4. **Callbacks.** In `markPlayLayer(li, rest, act, quote)`, when `li >= 0 && li < N` call `cb.onTuneEra && cb.onTuneEra(layers[li].id, quote ? quote.name : null)` (check what `quote` holds — it comes from `quoteOf`, a TUNES entry; use its `name`). In `stopPlay()`, call `cb.onTuneEnd && cb.onTuneEnd()`. In `voyEnterIdx(i)`, call `cb.onVoyage && cb.onVoyage(e.kind === 'layer' ? layers[e.layer].id : e.kind)` (so the page gets `'open'`, a dynasty id, or `'end'`).
5. **Public API.** Add to `window.MuseumStrata`:

```js
  /** Replay 奏一曲 (o: { seed, era: dynasty id | null }). */
  play(o) { if (S.ready) S.play(o); },
  stop() { if (S.ready) S.stop(); },
  /** Start 溯洄 from 今. */
  voyage() { if (S.ready) S.voyage(); },
```

   and inside `init`, where the other `S.x = ...` assignments live (search `S.renderTune =` or `S.update =`), add `S.play = (o) => startPlay(o || {}); S.stop = () => { stopPlay(); voyStop(); }; S.voyage = () => voyStart();`.

- [ ] **Step 1:** Make the edits above.
- [ ] **Step 2:** Syntax check the module string: `bun -e "import('~/ui/client/strata').then(m => { new Function(m.STRATA_MODULE.replace(/^import .*$/gm, '').replace(/export /g, '')); console.log('ok') })"` — if your edit used a backtick or `${` the TS file itself won't compile; run `bun run typecheck` too. Expected: `ok`, typecheck clean.
- [ ] **Step 3:** `bun test` for any strata-related tests (`ls tests | grep -i -e strata -e era`) → PASS.
- [ ] **Step 4: Commit**

```bash
git add src/ui/client/strata.ts src/ui/theme.ts
git commit -m "feat(寄): strata guest mode, replay API, 寄此曲 / 寄此行"
```

---

### Task 7: The 手卷 page — `GET /s/:id`

**Files:**
- Create: `src/ui/scroll-page.ts`
- Modify: `src/routes/scrolls.ts` (add the GET)
- Test: `tests/scroll-page.test.ts`

Server side: `GET /s/:id` → load scroll (404 page reading 「此卷已佚」 with a link 「展开你自己的一卷」 → `/`), load museums + dynasties (same repos as `src/routes/home.ts`), `buildScroll(...)`, `guan = repo.listGuan(id, 30)`, render `ScrollPage({ built, guan, id, museums, dynasties })`.

Page structure (vertical, centred column max-width 560px, paper theme forced — add `<script>document.documentElement.dataset.theme='paper'</script>` if `THEME_BOOT` would pick another; check `src/ui/theme.ts` for the attribute it uses):

```
<head> title = built.title; <meta name="description" content="{colophon}">;
       og:title = built.title; og:description = colophon; og:type=article
<main class="juan">
  <div class="juan-rod"></div>                       ← top roller
  <header class="juan-slip">                          ← 签条: narrow vertical paper strip, serif
     <span class="slip-text">{slip}</span>
  </header>
  <p class="juan-season">{season.text}<small>—— {season.src}</small></p>
  <h1 class="juan-yinshou">{yinshou}</h1>          ← four big characters, vertical (writing-mode: vertical-rl) on wide screens, horizontal on narrow
  <button class="juan-open">展卷</button>             ← required tap for audio (tune/voyage only); for seal/scroll it just scrolls to 画心
  <section class="juan-heart">                        ← 画心
     tune/voyage/scroll: <div id="strata" class="juan-strata"></div> (height 62vh, sticky top:0 while notes scroll beside/below it)
     <ol class="juan-notes"> one <li data-dyn="{dynastyId}"> per note:
         <h3>{title}<small>{period}</small></h3>
         <p>{line}</p>…  (tunes: <p class="tune">《{name}》 · {story}<small>{from}</small></p>)
         <p class="seen">{seen}</p>
     </ol>
     seal: <div class="juan-sealmark">{seal.seal}</div> (vermilion square seal, stamps in with a 600ms scale+rotate animation when it scrolls into view),
           <h2>{seal.labelTitle}</h2><div class="label">{seal.label}</div>, <p class="why">{seal.why}</p>,
           <p class="seen">所见 · {seal.seen joined 、}</p>
  </section>
  <section class="juan-colophon">                     ← 题跋 (vertical-rl on wide screens), then built.line in quotes if present
     <p>{colophon}</p><p class="own">{line}</p>
  </section>
  <section class="juan-seals">                        ← 鉴藏印: up to 24 small vermilion seals (first 2–3 chars of museum name, like the sidebar seals), then 「等 N 方」
  <section class="juan-guan">                         ← 观款
     <ul> each: <li><span class="guan-seal">观</span>{name || '某君'} 观</li>
     <p class="guan-count">已有 {count} 人观</p>
     <form> <input maxlength=8 placeholder="留个名字（可不填）" style="font-size:16px"> <button>钤一方「观」</button></form>
     <p class="tongyou" hidden></p>                  ← 同游
  </section>
  <footer class="juan-tail"><a href="/">展开你自己的一卷</a></footer>
  <div class="juan-rod"></div>
</main>
```

Escape every interpolated string (use an `esc()` like `src/routes/share.ts` had). Embed `{ id, kind, seed, era, visitedIds, museums, dynasties, dynastyGeo: DYNASTY_GEO, crossings: computeCrossings(museums, dynasties), territoryUrl: TERRITORY_SRC }` as bootstrap JSON with the same `<`→`<` and `-->` escaping as `HomePage` in `src/ui/home.ts`, and load `<script type="module" src="${STRATA_SRC}">` for tune/voyage/scroll kinds. Strata CSS lives in `themeCss` (already included by `Layout`).

Client script (inline, plain JS, no backticks):
- On `strata-ready` (or immediately if `window.MuseumStrata` exists): `MuseumStrata.init(el, { ...bootstrap, guest: true, theme: 'paper' }, { onTuneEra, onTuneEnd, onVoyage })`, then `update({ mode: 'all', visitedIds: bootstrap.visitedIds, selectedId: null, candidates: [] })`, `setActive(true)`. If `init` returns false: hide `#strata`, add `<p class="juan-nogl">此处画心，需在支持 3D 的设备上展开</p>`, and show all notes.
- 展卷 tap: tune → `MuseumStrata.play({ seed, era })`; voyage → `MuseumStrata.voyage()`; then the button turns into 「重展」.
- Notes start dim (`opacity:.35`); `onTuneEra(id, quoteName)` / `onVoyage(id)` mark `li[data-dyn=id]` as `.is-on` (full opacity), scroll it into view within the notes list (`block:'nearest'`), and if `quoteName`, add `.is-quote` to the matching `.tune` paragraph. `onVoyage('end')` / `onTuneEnd()` → all notes `.is-on`, then smooth-scroll to `.juan-colophon` after 1.2s.
- 同游: read the viewer's own stamps — `JSON.parse(localStorage.museumAnonVisits || '[]').map(v => v.museumId)`; if signed in, `fetch('/api/visits', { credentials: 'include' })` → `items[].museumId` (ignore errors / `error` responses). Compute shared layers: for each dynasty, its museums (`recommendedMuseums` + `relatedMuseums`) ∩ viewer's stamps non-empty AND ∩ sender's `visitedIds` non-empty → collect short names (strip `（…）`, 东周：… → 东周, drop trailing 朝 for 2-char names). If any: show 「你与 TA 同游 唐·宋·明」 (max 6 names, then 「等 N 层」).
- 观款 form: if `localStorage['mmGuan:' + id]` is set, replace the form with 「你已钤过」. Submit → `POST /api/s/{id}/guan` with `{ name }`; on 200 re-render the list, set the localStorage flag, play a short stamp animation on the new seal; on 409 show 「你已钤过」; on 429 show the error text.

CSS (in the page `<style>`): paper background `var(--paper)`, text ink, vermilion `var(--vermilion)`; serif font family as theme uses; rollers = 14px tall bars with a subtle wood gradient and rounded ends; generous vertical spacing (≥ 56px between sections); `overflow-wrap:anywhere` on notes, colophon, label; `prefers-reduced-motion` disables the stamp animations; at ≥ 900px wide the 引首 and 题跋 use `writing-mode: vertical-rl`.

- [ ] **Step 1: Write failing test**

```ts
// tests/scroll-page.test.ts
import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" }, d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"], r2Buckets: ["IMAGES"] })
  return { DB: await mf.getD1Database("DB"), RATE: await mf.getKVNamespace("RATE"), IMAGES: await mf.getR2Bucket("IMAGES") } as any
}

describe("GET /s/:id", () => {
  it("renders a voyage scroll with title, colophon, seasons, escaped text", async () => {
    const app = createApp(await makeEnv())
    const { id } = await (await app.handle(new Request("http://x/api/scrolls", { method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.9.0.1" },
      body: JSON.stringify({ kind: "voyage", name: "小明", line: "雪<夜>访古", visitedIds: ["guobo"] }) }))).json()
    const r = await app.handle(new Request("http://x/s/" + id))
    expect(r.status).toBe(200)
    const html = await r.text()
    expect(html).toContain("<title>小明寄来一卷 ·《溯洄从之》</title>")
    expect(html).toContain("溯洄图卷")
    expect(html).toContain("溯洄而上，自今及于新石器")
    expect(html).toContain("展开你自己的一卷")
    expect(html).toContain("钤一方「观」")
    expect(html).not.toContain("雪<夜>访古")
    expect(html).not.toContain("分享")
  })
  it("lost scrolls read 此卷已佚", async () => {
    const app = createApp(await makeEnv())
    const r = await app.handle(new Request("http://x/s/zzzzzzzz"))
    expect(r.status).toBe(404)
    expect(await r.text()).toContain("此卷已佚")
  })
})
```

(`雪<夜>访古` → `cleanLine` strips `<>` → `雪夜访古` — so the raw string never appears. Good: that's the point of the assertion.)

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** page + GET route. **Step 4: Run** `bun test tests/scroll-page.test.ts tests/scrolls-route.test.ts && bun run typecheck` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/ui/scroll-page.ts src/routes/scrolls.ts tests/scroll-page.test.ts
git commit -m "feat(寄): the 手卷 page — 签条, 引首, 画心 replay with narration, 题跋, 鉴藏印, 观款, 同游"
```

---

### Task 8: Entry points in the app — 封卷 panel, 寄此印 / 寄此曲 / 寄此行 / 寄一卷

**Files:**
- Create: `src/ui/components/ji.ts` (`JiPanel()` HTML string)
- Modify: `src/ui/home.ts` (include `JiPanel()`), `src/ui/client/app.ts`, `src/ui/components/achievements.ts`, `src/ui/components/sidebar.ts`, `src/ui/components/drawer.ts`, `src/ui/profile.ts`, `src/ui/theme.ts` (styles)

App state & methods (in `museumApp()` data object in `src/ui/client/app.ts`):

```js
    ji: { open: false, kind: '', extra: null, name: '', line: '', busy: false, url: '' },
    jiOpen(kind, extra) {
      this.ji.kind = kind; this.ji.extra = extra || null; this.ji.url = ''; this.ji.busy = false;
      if (!this.ji.name) this.ji.name = (this.me && (this.me.displayName || this.me.handle)) || '';
      try { if (!this.ji.name) this.ji.name = localStorage.getItem('mmJiName') || ''; } catch (_) {}
      this.ji.open = true;
    },
    jiClose() { this.ji.open = false; },
    jiTitle() { return { tune: '寄此曲', voyage: '寄此行', seal: '寄此印', scroll: '寄一卷' }[this.ji.kind] || '寄'; },
    async jiSeal() {
      if (this.ji.busy) return;
      this.ji.busy = true;
      try {
        var body = Object.assign({ kind: this.ji.kind, name: this.ji.name, line: this.ji.line, visitedIds: this.visits.ids.slice() }, this.ji.extra || {});
        var r = await fetch('/api/scrolls', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        var j = await r.json();
        if (!r.ok) { this.flashToast(j.error || '封卷未成，稍后再试'); return; }
        try { localStorage.setItem('mmJiName', this.ji.name || ''); } catch (_) {}
        this.ji.url = location.origin + j.url;
        await this.jiSend();
      } catch (_) { this.flashToast('封卷未成，稍后再试'); }
      finally { this.ji.busy = false; }
    },
    async jiSend() {
      var url = this.ji.url; if (!url) return;
      var inApp = /MicroMessenger|HarmonyOS|HuaweiBrowser/i.test(navigator.userAgent);
      if (!inApp && navigator.share) { try { await navigator.share({ title: this.jiTitle(), url: url }); this.ji.open = false; return; } catch (_) {} }
      try { await navigator.clipboard.writeText(url); this.flashToast('卷已封好，寄去吧'); }
      catch (_) { prompt('卷已封好，复制下面的地址寄去：', url); }
    },
```

(Check the real field names for the signed-in user in `app.ts` — `this.me` is set at lines ~2496/2511/2585; use whatever display-name field it carries.)

`JiPanel()` (modal sheet, same look as other sheets — reuse the achievement sheet's container classes from `src/ui/components/achievements.ts`):

```
<div class="ji-sheet" x-show="ji.open" x-cloak x-transition.opacity @keydown.escape.window="jiClose()">
  <div class="ji-card" @click.stop>
    <div class="ji-kicker">封卷</div>
    <h3 x-text="jiTitle()"></h3>
    <label>署名<input x-model="ji.name" maxlength="12" placeholder="无名氏" style="font-size:16px"></label>
    <label>附一句（可不填）<input x-model="ji.line" maxlength="40" placeholder="比如：雪夜，在洛阳" style="font-size:16px"></label>
    <p class="ji-note">卷上会写下此刻的干支与节气，寄出后不再改动。</p>
    <div class="ji-actions">
      <button class="btn btn-primary" @click="ji.url ? jiSend() : jiSeal()" :disabled="ji.busy" x-text="ji.url ? '再寄一次' : (ji.busy ? '封卷中…' : '封卷，寄出')"></button>
      <a class="btn btn-text" x-show="ji.url" :href="ji.url" target="_blank">先看看这一卷</a>
      <button class="btn btn-text" @click="jiClose()">罢了</button>
    </div>
  </div>
</div>
```

Wire the entry points:
- **寄此印:** in `AchievementCeremony` (`src/ui/components/achievements.ts`, actions at ~line 54), add between 读展签 and 好: `<button class="btn btn-ghost" @click="var id = a.id; achDismiss(); jiOpen('seal', { achId: id })">寄此印</button>`. Also in the `AchievementSheet` for an unlocked achievement (find where the sheet shows level ≥ 1), add a small `寄此印` text button.
- **寄此曲 / 寄此行:** in `initStrata()` add `onSend: function(o){ self.jiOpen(o.kind, o.kind === 'tune' ? { seed: o.seed, era: o.era } : null); }` to the cb object.
- **寄一卷:** in `src/ui/components/sidebar.ts`, in the 集章册 hero actions (near the `hero-actions` / collection buttons, not inside the review block), add `<button class="btn btn-ghost" x-show="!isReadOnly && visits.ids.length" @click="jiOpen('scroll')">${icon("share", 16)}寄一卷</button>`.
- **Drawer:** `src/ui/components/drawer.ts:21` — change `title="分享链接" aria-label="分享"` to `title="寄给友人" aria-label="寄给友人"`; in `shareCurrent()` change the toast `'链接已复制'` to `'已备好，寄给友人吧'` and the prompt text to `'复制下面的地址寄给友人：'`.
- **Profile:** `src/ui/profile.ts:256` — replace the 「分享海报」 link with `<a class="btn btn-ghost" href="/">${icon("share", 16)}回到地图，寄一卷</a>` only when `isOwn`; drop it for others.
- Grep the whole UI for remaining user-facing 「分享」: `grep -rn "分享" src/ui src/routes | grep -v "^src/routes/share.ts\|share-poster\|poster-atoms"` — reword any left (comments are fine).

Styles in `src/ui/theme.ts`: `.ji-sheet` fixed overlay with the same backdrop as `.ach-ceremony`; `.ji-card` paper card, max-width 420px, padding 28px, serif title; inputs full-width, `font-size:16px`, bottom border only; `.ji-note` small muted; mobile: card anchored bottom with `padding-bottom: calc(24px + env(safe-area-inset-bottom))`.

- [ ] **Step 1:** Implement the above.
- [ ] **Step 2:** `bun run typecheck && bun test tests/achievements-core.test.ts tests/scrolls-route.test.ts` → PASS.
- [ ] **Step 3: Commit**

```bash
git add src/ui src/ui/client/app.ts
git commit -m "feat(寄): 封卷 panel and entry points — 寄此印, 寄此曲, 寄此行, 寄一卷"
```

---

### Task 9: Remove the old poster

**Files:**
- Delete: `src/routes/share.ts`, `src/ui/share-poster.ts`, `src/ui/poster-atoms.ts`, `src/services/share-poet.ts`
- Modify: `src/index.ts` (drop `shareRoute` import/use)

- [ ] **Step 1:** `grep -rn "share-poster\|poster-atoms\|share-poet\|shareRoute\|routes/share\"" src tests` — remove every remaining import/use. Keep `src/services/solar-term.ts` (used by scroll-text) and `src/services/qr.ts` only if still imported elsewhere (`grep -rn "services/qr" src`); delete `qr.ts` too if nothing imports it.
- [ ] **Step 2:** `bun run typecheck && bun test` → only the 2 known image-enricher failures.
- [ ] **Step 3: Commit**

```bash
git add -A src tests
git commit -m "chore(寄): remove the old poster share"
```

---

### Task 10 (controller): Verify in the browser, migrate, deploy preview

Done by the controller, not a subagent.

- [ ] `bun run restore -- --target=local --confirm`, `bunx wrangler d1 migrations apply museum-map-db --local`, start dev (`bun run dev`, port 4343 as in earlier scripts).
- [ ] Playwright, desktop 1440×900 and mobile 390×844, with 14 stamped museums in `museumAnonVisits`:
  1. Strata → 奏一曲 → wait for the end → 寄此曲 appears → 封卷 → copy → open `/s/:id` → 展卷 → notes light up in order, a 名曲 is marked, scroll lands on 题跋.
  2. 溯洄 → end card 寄此行 → page replays 溯洄; ending text says TA.
  3. Trigger a ceremony (stamp a museum completing an achievement) → 寄此印 → page shows the seal stamp, 展签, 所见.
  4. 寄一卷 → page shows full strata + seals.
  5. 观款 with a name, reload, form says 你已钤过; second browser context sees two entries and 同游 line.
  6. No user-facing 「分享」 anywhere; `/u/x/share` 301s.
- [ ] Ask the user before `bunx wrangler d1 migrations apply museum-map-db --remote` (additive: two new tables). Then deploy preview: `bunx wrangler deploy --name museum-map-preview --domains museum-preview.xianliao.de5.net`.
