# 打卡成就 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the achievement subsystem from `docs/superpowers/specs/打卡成就.md` — 18 专题, 8 大区 + 行万里路, 6 断代 + 3 连续 — with progress, an achievements page, the 落印 ceremony, 展签, "never revoked" persistence, and achievement-based recommendation reasons. Sounds and share cards are out of scope (later phase).

**Architecture:**
- **Catalog** (`src/data/achievements.ts`): plain data — members, thresholds, copy, 展签. Injected into the page through the bootstrap JSON (same path as `ai` and `aliases` in `src/ui/home.ts`).
- **Engine** (`src/ui/client/achievements-core.ts`): pure JS string exposed as `window.AchCore`, evaluated as-is by tests (same pattern as `src/ui/client/trip-core.ts`). It turns *(catalog, visited ids, museum → city/province/eras)* into per-achievement progress, and answers "what would visiting this museum do for my achievements".
- **Persistence:** unlocked levels are stored separately and never removed — `localStorage['mmAch']` when anonymous; table `user_achievements` + `GET/POST /api/achievements` when logged in. Display level = max(stored, computed). The server trusts the client (打卡 itself is unverified; Workers can't eval the engine string).
- **UI:** a 成就 section in the 集章册 panel, an achievement sheet (detail + 展签), a ceremony overlay after a stamp unlocks something, achievement chips in trip recommendations and the 附近可补 ledger, and a line for the AI guide.

**Tech Stack:** Bun + Elysia on Cloudflare Workers (D1), Alpine.js (client code as strings), bun:test + miniflare.

**Conventions:**
- Client code lives inside TS template strings (`APP_SCRIPT` in `src/ui/client/app.ts`, sidebar/component markup strings). Inside them: never a backtick, no unintended `${`, regex escapes doubled (`\\d`), newline `\\n`.
- Province/city names: short form without 省/市/自治区 (北京, 河南, 广西, 内蒙古, 香港).
- Copy: youth-oriented, warm, concise; never 亲子/儿童 tone.
- `bun test` (full suite) reseeds local D1 — run individual files during tasks; the full suite only in the last task, followed by `bun run restore -- --target=local --confirm`. Known pre-existing failures: 2 in `image-enricher`.
- Commit on `worktree-redesign`, message ends with a blank line + `Co-Authored-By: Claude <noreply@anthropic.com>`. Never push. Never bare `git stash`.
- **Remote D1 migration needs the user's go-ahead** (the preview Worker binds the production DB). Task 5 applies it locally only.

---

## File map

| File | Responsibility |
|---|---|
| Modify `src/services/museum-meta.ts` | `deriveProvince(location)` |
| Modify `src/repo/types.ts`, `src/repo/museums.ts` | `province` on museum list items |
| Create `src/data/achievements.ts` | catalog types + data |
| Create `src/data/achievement-labels.ts` | 展签 texts (long prose kept apart from structure) |
| Create `src/ui/client/achievements-core.ts` | `ACH_CORE_SCRIPT` → `window.AchCore` |
| Create `migrations/0015_user_achievements.sql` | table |
| Create `src/repo/achievements.ts` | D1 access |
| Create `src/routes/achievements.ts` | `GET/POST /api/achievements` |
| Modify `src/index.ts` | register route |
| Modify `src/ui/home.ts` | bootstrap `achievements`, inject `ACH_CORE_SCRIPT`, mount sheet + ceremony |
| Modify `src/ui/client/app.ts` | state, sync, ceremony queue, nudges in trip/ledger/guide |
| Create `src/ui/components/achievements.ts` | sheet + ceremony markup |
| Modify `src/ui/components/sidebar.ts` | 成就 section in 集章册; chips in ledger recs |
| Modify `src/ui/theme.ts` | styles |
| Tests | `tests/museum-meta.test.ts` (append), `tests/achievements-data.test.ts`, `tests/achievements-core.test.ts`, `tests/achievements-route.test.ts` |

---

### Task 1: Province for every museum

**Files:**
- Modify: `src/services/museum-meta.ts`
- Modify: `src/repo/types.ts` (add `province?: string | null` to `MuseumListItem`, next to `city`)
- Modify: `src/repo/museums.ts` (`list()` → `province: deriveProvince(location)`)
- Test: `tests/museum-meta.test.ts` (append)

- [ ] **Step 1: Write the failing test** (append):

```ts
import { readdirSync, readFileSync } from "node:fs"
import { deriveProvince } from "~/services/museum-meta"

describe("deriveProvince", () => {
  it("reads the province from common address shapes", () => {
    expect(deriveProvince("河南省洛阳市偃师区翟镇镇")).toBe("河南")
    expect(deriveProvince("北京市东城区景山前街4号")).toBe("北京")
    expect(deriveProvince("广西壮族自治区南宁市青秀区")).toBe("广西")
    expect(deriveProvince("内蒙古自治区呼和浩特市")).toBe("内蒙古")
    expect(deriveProvince("中国河北省承德市双桥区")).toBe("河北")
    expect(deriveProvince("香港九龙尖沙咀漆咸道南100号")).toBe("香港")
    expect(deriveProvince("澳门特别行政区花王堂区")).toBe("澳门")
    expect(deriveProvince("台湾省台北市士林区")).toBe("台湾")
    expect(deriveProvince("南京市玄武区中山东路")).toBe("江苏")
    expect(deriveProvince("扬州博物馆：江苏省扬州市邗江区")).toBe("江苏")
    expect(deriveProvince(null)).toBeNull()
  })

  it("resolves every museum in data/museums", () => {
    const missing: string[] = []
    for (const f of readdirSync("data/museums")) {
      const loc = readFileSync("data/museums/" + f, "utf8").match(/^location: (.*)$/m)?.[1] ?? null
      if (!deriveProvince(loc)) missing.push(f + " → " + loc)
    }
    expect(missing).toEqual([])
  })
})
```

- [ ] **Step 2:** `bun test tests/museum-meta.test.ts` → FAIL (`deriveProvince` not exported).

- [ ] **Step 3: Implement** in `src/services/museum-meta.ts`:

```ts
const PROVINCES = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江", "江苏", "浙江", "安徽", "福建", "江西",
  "山东", "河南", "湖北", "湖南", "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾",
  "内蒙古", "广西", "西藏", "宁夏", "新疆", "香港", "澳门",
]
/** Addresses that start with a city instead of a province. Extend when a new museum fails the data test. */
const CITY_PROVINCE: Record<string, string> = {
  南京: "江苏", 苏州: "江苏", 扬州: "江苏", 徐州: "江苏", 杭州: "浙江", 广州: "广东", 佛山: "广东",
  西安: "陕西", 洛阳: "河南", 成都: "四川", 武汉: "湖北", 长沙: "湖南", 济南: "山东", 太原: "山西",
  大同: "山西", 沈阳: "辽宁", 兰州: "甘肃", 福州: "福建", 泉州: "福建",
}

/** "河南省洛阳市…" → "河南"; "南京市玄武区…" → "江苏"; "香港九龙…" → "香港". */
export function deriveProvince(location: string | null | undefined): string | null {
  if (!location) return null
  const loc = location.replace(/^中国/, "").replace(/^[^：:]{2,12}[：:]/, "").trim()
  for (const p of PROVINCES) if (loc.startsWith(p)) return p
  const city = deriveCity(loc)
  if (city && CITY_PROVINCE[city]) return CITY_PROVINCE[city]
  for (const [c, p] of Object.entries(CITY_PROVINCE)) if (loc.startsWith(c)) return p
  return null
}
```

If the "every museum" test lists failures, add the missing cities to `CITY_PROVINCE` (look at each failing address) until it passes. Then add `province` to `MuseumListItem` and to `list()` in `src/repo/museums.ts`:

```ts
      return { ...r, tiers: normalizeLevel(r.level), city, province: deriveProvince(location), seal: sealSpec(r.id, r.name, city) }
```
(import `deriveProvince` alongside `deriveCity`).

- [ ] **Step 4:** `bun test tests/museum-meta.test.ts && bun run typecheck` → pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/museum-meta.ts src/repo/types.ts src/repo/museums.ts tests/museum-meta.test.ts
git commit -m "feat(museums): province for every museum (for regional achievements)"
```

---

### Task 2: Achievement catalog

**Files:**
- Create: `src/data/achievements.ts`
- Create: `src/data/achievement-labels.ts` (in this task: an empty-string entry per id; Task 3 writes the prose)
- Test: `tests/achievements-data.test.ts`

Thresholds follow spec §8: 3–4 members → all; 5–7 → n−2 (min 4); ≥8 → ceil(60%). 石窟寺 is the documented exception (4 members spread across the country → reach 3).

- [ ] **Step 1: Write the failing test**

```ts
// tests/achievements-data.test.ts
import { describe, it, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { ACHIEVEMENTS, REGIONS } from "~/data/achievements"
import { ACHIEVEMENT_LABELS } from "~/data/achievement-labels"
import { deriveProvince, deriveCity } from "~/services/museum-meta"

const museums = readdirSync("data/museums").map((f) => {
  const s = readFileSync("data/museums/" + f, "utf8")
  const loc = s.match(/^location: (.*)$/m)?.[1] ?? null
  return { id: f.replace(/\.yaml$/, ""), city: deriveCity(loc), province: deriveProvince(loc) }
})
const ids = new Set(museums.map((m) => m.id))
const themes = ACHIEVEMENTS.filter((a) => a.line === "theme")

describe("achievement catalog", () => {
  it("has 18 themes, 8 regions + 3 milestones, 6 segments + 3 chains", () => {
    expect(themes.length).toBe(18)
    expect(ACHIEVEMENTS.filter((a) => a.line === "region").length).toBe(11)
    expect(ACHIEVEMENTS.filter((a) => a.line === "era").length).toBe(9)
  })

  it("ids and seal texts are unique; seals are 2–4 characters", () => {
    const seen = new Set<string>(), seals = new Set<string>()
    for (const a of ACHIEVEMENTS) {
      expect(seen.has(a.id)).toBe(false); seen.add(a.id)
      expect(seals.has(a.seal)).toBe(false); seals.add(a.seal)
      expect(Array.from(a.seal).length).toBeGreaterThanOrEqual(1)
      expect(Array.from(a.seal).length).toBeLessThanOrEqual(4)
    }
  })

  it("theme members exist (museum ids, or cities that have a museum)", () => {
    const cities = new Set(museums.map((m) => m.city))
    for (const a of themes) for (const mem of a.members!) {
      if ("museum" in mem) expect(ids.has(mem.museum)).toBe(true)
      else expect(cities.has(mem.city)).toBe(true)
    }
  })

  it("theme thresholds follow the rule", () => {
    for (const a of themes) {
      const n = a.members!.length
      const rule = n <= 4 ? n : n <= 7 ? Math.max(4, n - 2) : Math.ceil(n * 0.6)
      if (a.id === "theme-shiku") expect(a.reach).toBe(3)
      else expect([a.id, a.reach]).toEqual([a.id, rule])
    }
  })

  it("every museum province belongs to exactly one region", () => {
    for (const m of museums) {
      const hits = REGIONS.filter((r) => r.provinces.includes(m.province!))
      expect([m.id, hits.length]).toEqual([m.id, 1])
    }
  })

  it("segments cover layers 1..20 exactly once", () => {
    const covered: number[] = []
    for (const a of ACHIEVEMENTS.filter((x) => x.layers)) for (let i = a.layers![0]; i <= a.layers![1]; i++) covered.push(i)
    expect(covered.sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it("every achievement has hook, why and a 展签 entry", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.hook.length).toBeGreaterThan(4)
      expect(a.why.length).toBeGreaterThan(10)
      expect(a.id in ACHIEVEMENT_LABELS).toBe(true)
    }
  })
})
```

- [ ] **Step 2:** `bun test tests/achievements-data.test.ts` → FAIL (module missing).

- [ ] **Step 3: Write `src/data/achievements.ts`**

```ts
// 打卡成就 — the catalog. Design and rules: docs/superpowers/specs/打卡成就.md.
// line: theme (专题收集) · region (区域) · era (朝代). Levels: 1 = 达成, 2 = 圆满.

export type Member = { museum: string } | { city: string }

export interface Achievement {
  id: string
  line: "theme" | "region" | "era"
  name: string
  seal: string
  hook: string
  why: string
  /** Title of the 展签 (the text itself is in achievement-labels.ts). */
  labelTitle: string
  /** Planned sound (not implemented in this phase). */
  sound: string
  // theme
  members?: Member[]
  reach?: number
  // region: a 大区 (provinces) — level 1 on the first visit, level 2 when every province with museums is visited
  provinces?: string[]
  // region milestone: share of all provinces that have museums (1/3, 2/3, 1)
  share?: number
  // era: a segment of layers [from, to] (1-based, inclusive) — every layer needs one visited museum
  layers?: [number, number]
  // era: longest run of consecutive layers ≥ chain
  chain?: number
}

const M = (museum: string): Member => ({ museum })
const C = (city: string): Member => ({ city })

export const REGIONS = [
  { id: "region-huabei", provinces: ["北京", "天津", "河北", "山西", "内蒙古"] },
  { id: "region-dongbei", provinces: ["辽宁", "吉林", "黑龙江"] },
  { id: "region-huadong", provinces: ["上海", "江苏", "浙江", "安徽", "福建", "江西", "山东"] },
  { id: "region-huazhong", provinces: ["河南", "湖北", "湖南"] },
  { id: "region-huanan", provinces: ["广东", "广西", "海南"] },
  { id: "region-xinan", provinces: ["四川", "重庆", "贵州", "云南", "西藏"] },
  { id: "region-xibei", provinces: ["陕西", "甘肃", "青海", "宁夏", "新疆"] },
  { id: "region-gangaotai", provinces: ["香港", "澳门", "台湾"] },
]
const prov = (id: string) => REGIONS.find((r) => r.id === id)!.provinces

export const ACHIEVEMENTS: Achievement[] = [
  // ── 专题收集 ──
  { id: "theme-shiku", line: "theme", name: "石窟寺", seal: "石窟", reach: 3,
    members: [M("yungang"), M("longmen"), M("mogao"), M("6312bdbd-cc07-456a-a5d0-472e502a5154")],
    hook: "佛教东传，一路凿进山里。",
    why: "四处石窟跨了一千年、三种风格：云冈的雄浑、龙门的秀骨清像、北齐的丰圆。连起来看，是一种外来艺术怎样变成中国的。",
    labelTitle: "佛像的脸，是怎么一点点变成中国人的脸的", sound: "磬" },
  { id: "theme-qiandu", line: "theme", name: "从平城到洛阳", seal: "迁都", reach: 4,
    members: [M("shanxi-datong"), M("yungang"), M("hanwei-luoyang"), M("longmen")],
    hook: "公元 494 年，北魏把都城从大同搬到了洛阳。",
    why: "一次迁都，四个地点：前后两座都城、两处皇家石窟，正好成对。走完，就是走了一遍孝文帝的改革。",
    labelTitle: "孝文帝为什么要迁都，云冈和龙门的佛像为什么换了衣服", sound: "胡笳转入琴" },
  { id: "theme-gudu", line: "theme", name: "七大古都", seal: "古都", reach: 5,
    members: [C("西安"), C("洛阳"), C("南京"), C("北京"), C("开封"), C("杭州"), C("安阳")],
    hook: "中国古都的主干，七座城。",
    why: "这七座城加起来，覆盖了从商到清的大半部都城史，每一座都当过某个时代的中心。",
    labelTitle: "都城为什么一路从西往东、从北往南挪", sound: "晨钟暮鼓" },
  { id: "theme-sandai", line: "theme", name: "三代之源", seal: "三代", reach: 4,
    members: [M("erlitou"), M("yinxu"), M("wenzi"), M("4dc89822-84e4-4b0a-91dd-798aa762981b"), M("054543c3-1850-471d-be28-e611f77ba9c4")],
    hook: "夏都、商都、甲骨文，还有周人起家的地方。",
    why: "「最早的中国」从哪里来？这五座馆是最直接的现场。",
    labelTitle: "从二里头的绿松石龙，到何尊上的「宅兹中国」", sound: "陶埙" },
  { id: "theme-gushu", line: "theme", name: "古蜀文明", seal: "古蜀", reach: 4,
    members: [M("sanxingdui"), M("jinsha"), M("sichuan"), M("chengdu")],
    hook: "三星堆之后，古蜀人去了哪里？",
    why: "三星堆和金沙是同一个文明的前后两段，连起来才是完整的古蜀。",
    labelTitle: "从青铜纵目面具到太阳神鸟", sound: "青铜铃" },
  { id: "theme-diling", line: "theme", name: "帝王陵寝", seal: "帝陵", reach: 4,
    members: [M("bingmayong"), M("8d05e910-ec8f-4d99-8cba-140f10bd9ef2"), M("b27bc4cc-0ca1-4cf9-a934-9370b40c0732"),
      M("817569a4-234c-46ce-9bcd-89ef8f271011"), M("ebd9f374-6925-48ef-a456-13e0fd61fcd4"), M("c9b31e6a-c677-468d-913e-ce8f400f459a")],
    hook: "从秦到明，皇帝怎么安排自己的身后事。",
    why: "陵墓是一个朝代最舍得花钱的工程。从陶俑大军到无字碑，看得见每个时代的世界观。",
    labelTitle: "从「事死如事生」到明朝的地宫", sound: "大鼓" },
  { id: "theme-liaogou", line: "theme", name: "辽代木构", seal: "辽构", reach: 5,
    members: [M("dulesi"), M("ef6658c6-03b4-4edb-98ca-e19523bdaaa7"), M("fengguosi"), M("9b3cf4df-a9f9-42b7-9418-adc2560c13c5"),
      M("shanhuasi"), M("geyuansi"), M("guangjisi-baodi"), M("kaishansi")],
    hook: "梁思成一座座找到的，千年的木头房子。",
    why: "中国现存最早的木构建筑，多数是辽代的，散在京津冀晋辽的县城里。集齐它们，等于重走一遍营造学社的考察路线。",
    labelTitle: "1932 年，梁思成在蓟县看到了独乐寺", sound: "风铎" },
  { id: "theme-qingtong", line: "theme", name: "青铜时代", seal: "青铜", reach: 5,
    members: [M("054543c3-1850-471d-be28-e611f77ba9c4"), M("52857eb0-ccb7-46af-a887-79501e299e42"), M("hubei"), M("yinxu"),
      M("shanghai"), M("sanxingdui"), M("zhongshanguo")],
    hook: "礼器、编钟、神树，各有各的青铜。",
    why: "中原的礼器、楚地的编钟、古蜀的神像、中山国的错金银——同一种金属，四种审美。",
    labelTitle: "青铜为什么没做成农具，而是做成了礼器", sound: "编钟（真声）" },
  { id: "theme-silu", line: "theme", name: "陆上丝路", seal: "丝路", reach: 4,
    members: [M("shaanxi"), M("gansu"), M("mogao"), M("xinjiang"), M("qinghai"), M("ningxia")],
    hook: "从长安出发，一路向西。",
    why: "起点、河西走廊、敦煌、西域，再加上唐蕃古道和西夏——一条路上的六个路口。",
    labelTitle: "铜奔马、胡商俑，和一封写给家里的信", sound: "驼铃 · 琵琶" },
  { id: "theme-haisi", line: "theme", name: "海上丝路", seal: "海丝", reach: 4,
    members: [M("quanzhou"), M("nanhai"), M("guangdong"), M("fujian"), M("hainan"), M("macau-museum")],
    hook: "宋元时期，世界最大的港口在泉州。",
    why: "从港口到沉船，再到水下考古。海上的那条路，比陆上的更少人知道。",
    labelTitle: "南海一号沉没时，船上装着什么、要去哪里", sound: "海螺号" },
  { id: "theme-ci", line: "theme", name: "瓷之路", seal: "瓷", reach: 4,
    members: [M("jingdezhen"), M("1f59db8a-b242-494f-aba4-7f02ed14f48c"), M("dingzhou"), M("nanhai"), M("jiangxi")],
    hook: "从窑口到御窑，再到一整船出海。",
    why: "定窑、官窑、景德镇，再到沉船里成摞的瓷器——从烧出来到运出去的全过程。",
    labelTitle: "「china」这个词是怎么来的", sound: "瓷瓯" },
  { id: "theme-zhuhouwang", line: "theme", name: "汉代诸侯王", seal: "王侯", reach: 4,
    members: [M("nanyue"), M("haihunhou"), M("xuzhou"), M("hebei"), M("hunan"), M("dingzhou")],
    hook: "天子之外，各地诸侯王的地下世界。",
    why: "金缕玉衣、马王堆帛画、海昏侯的金饼。天子的陵很少发掘，诸侯王墓才是了解汉代贵族生活的窗口。",
    labelTitle: "当了 27 天皇帝的海昏侯，带走了什么", sound: "瑟" },
  { id: "theme-sanguo", line: "theme", name: "三国鼎立", seal: "三国", reach: 3,
    members: [M("232d4da5-550c-49eb-89e0-042c913657c8"), M("jiangsu"), M("hanwei-luoyang")],
    hook: "魏、蜀、吴，各去一处。",
    why: "三国是最多人熟悉的一段历史，却很少有人真的把三家都去一遍。",
    labelTitle: "小说之外，三国真正留下了什么", sound: "琴" },
  { id: "theme-beichao", line: "theme", name: "北朝风华", seal: "北朝", reach: 4,
    members: [M("311c5f1f-d67d-4e79-a891-253baced913b"), M("6312bdbd-cc07-456a-a5d0-472e502a5154"), M("cixian-beichao"),
      M("qingzhou"), M("shanxi-datong"), M("yungang")],
    hook: "被低估的北朝艺术。",
    why: "北齐的壁画、青州的微笑佛，是隋唐之前最有个性的一段艺术，很多人没听说过。",
    labelTitle: "青州龙兴寺那一窖佛像，是怎么被埋、又怎么被找到的", sound: "曲项琵琶" },
  { id: "theme-huangjia", line: "theme", name: "明清皇家", seal: "皇家", reach: 5,
    members: [M("gugong"), M("shenyang-gugong"), M("799daa55-94c0-4ef7-bdf8-21cff39e6c6b"), M("40b9932c-a873-4aa4-85fe-392abe12ef50"),
      M("706747f5-3e5a-4883-ad52-67c7169d70fc"), M("bfd76fa2-1343-4649-91f0-a8bcc3b0b690"), M("taipei-gugong")],
    hook: "宫殿、园林、坛庙，一个王朝怎么生活。",
    why: "两座故宫，加上台北的那一座，再加夏宫、祭天的地方和一座废墟，就是明清皇家生活的全貌。",
    labelTitle: "同一批文物，为什么分在北京和台北", sound: "编磬" },
  { id: "theme-gucha", line: "theme", name: "古刹", seal: "古刹", reach: 4,
    members: [M("6d90c01d-efe7-45e5-a39a-e28a10298fa2"), M("famensi"), M("2622e024-00eb-4a11-8b65-036b820f89d1"),
      M("d07ca61f-47b5-4b8f-b061-ab0b67017ae9"), M("da80ec30-88cf-4f4f-ae53-1d277f18c96a"), M("2f91b70e-838a-4af4-97f0-5511dad3373c")],
    hook: "从中国第一座官办寺院，到皇家供奉的地宫。",
    why: "白马寺是起点，法门寺地宫是巅峰，智化寺还留着明代的京音乐。寺庙里藏着另一部中国史。",
    labelTitle: "法门寺地宫打开的那天", sound: "云锣 · 木鱼" },
  { id: "theme-shuguang", line: "theme", name: "文明曙光", seal: "曙光", reach: 4,
    members: [M("09fc018e-37d8-4aef-a17c-d9e3c0ac04cc"), M("banpo"), M("liangzhu"), M("anhui"), M("shandong")],
    hook: "文字出现之前的中国。",
    why: "从北京人到良渚古城，人怎样从洞穴走进城市。",
    labelTitle: "良渚玉琮上的神人兽面，是谁", sound: "骨笛" },
  { id: "theme-duoyuan", line: "theme", name: "多元一体", seal: "多元", reach: 6,
    members: [M("xizang"), M("xinjiang"), M("neimenggu"), M("ningxia"), M("yunnan"), M("guizhou"), M("guangxi"), M("jilin"),
      M("heilongjiang"), M("ccb305e9-5097-423f-b188-3314412b9ffd")],
    hook: "中原之外的中国。",
    why: "吐蕃、西夏、古滇、渤海、高句丽……这些名字在课本里一笔带过，在当地是整整一部历史。",
    labelTitle: "「中国」是怎样由许多个中心拼起来的", sound: "铜鼓" },

  // ── 区域 ──
  { id: "region-huabei", line: "region", name: "长城内外", seal: "长城", provinces: prov("region-huabei"),
    hook: "一道长城，两种生活。", why: "农耕和游牧在这里相遇了两千年，长城、都城、草原都在这一片。",
    labelTitle: "长城两边的人，其实一直在来往", sound: "唢呐 · 笙" },
  { id: "region-dongbei", line: "region", name: "白山黑水", seal: "白山", provinces: prov("region-dongbei"),
    hook: "渤海国、金、后金，都从这里起家。", why: "好几个改变了中国的政权从这里出发，往南走进了历史的中心。",
    labelTitle: "从白山黑水到紫禁城", sound: "马头琴" },
  { id: "region-huadong", line: "region", name: "东海之滨", seal: "东海", provinces: prov("region-huadong"),
    hook: "吴越、齐鲁、六朝和宋韵。", why: "孔子的故乡、六朝的金陵、南宋的临安，这里是中国最会过日子的地方。",
    labelTitle: "经济重心为什么一路南移", sound: "二胡" },
  { id: "region-huazhong", line: "region", name: "中原荆楚", seal: "中原", provinces: prov("region-huazhong"),
    hook: "一半的古都，和整个楚文化。", why: "「逐鹿中原」的中原，加上浪漫的楚地，中国历史有一半是在这里写的。",
    labelTitle: "中原和楚，两种中国", sound: "编钟" },
  { id: "region-huanan", line: "region", name: "岭南", seal: "岭南", provinces: prov("region-huanan"),
    hook: "南越国、海丝、广府。", why: "山的那一边自成一体，又最早面向大海。",
    labelTitle: "岭南为什么总是最先看见世界", sound: "高胡" },
  { id: "region-xinan", line: "region", name: "西南万山", seal: "万山", provinces: prov("region-xinan"),
    hook: "古蜀、古滇、夜郎、吐蕃。", why: "崇山峻岭隔出了许多个各自灿烂的文明。",
    labelTitle: "大山里的四个古国", sound: "竹笛 · 三弦" },
  { id: "region-xibei", line: "region", name: "大漠长河", seal: "大漠", provinces: prov("region-xibei"),
    hook: "周秦汉唐的根，丝路的路。", why: "中国最强盛的几个朝代从这里出发，也从这里走向世界。",
    labelTitle: "为什么周秦汉唐都选了关中", sound: "板胡" },
  { id: "region-gangaotai", line: "region", name: "海峡与港湾", seal: "海港", provinces: prov("region-gangaotai"),
    hook: "另一种方式保存下来的中国。", why: "这里的博物馆用不同的眼光讲同一部历史。",
    labelTitle: "离开和回来", sound: "洞箫 · 南音琵琶" },
  { id: "miles-1", line: "region", name: "行万里路 · 一", seal: "万里", share: 1 / 3,
    hook: "走过三分之一的省份。", why: "读万卷书，也要行万里路。三分之一，已经比大多数人走得远。",
    labelTitle: "第一段路", sound: "" },
  { id: "miles-2", line: "region", name: "行万里路 · 二", seal: "万里二", share: 2 / 3,
    hook: "走过三分之二的省份。", why: "大半个中国已经在你的集章册里了。", labelTitle: "第二段路", sound: "" },
  { id: "miles-3", line: "region", name: "行万里路 · 三", seal: "万里三", share: 1,
    hook: "走遍收录里的每一个省份。", why: "从东北到岭南，从东海到大漠，一个不落。", labelTitle: "走遍", sound: "" },

  // ── 朝代 · 断代 ──
  { id: "era-xianqin", line: "era", name: "礼乐之始", seal: "礼乐", layers: [1, 5],
    hook: "从陶罐到青铜鼎，中国的样子是怎么定下来的。", why: "新石器、夏、商、西周、东周，五层地层连在一起，是中国文明的前传。",
    labelTitle: "「礼」到底是什么", sound: "先秦乐章" },
  { id: "era-qinhan", line: "era", name: "大一统", seal: "一统", layers: [6, 8],
    hook: "车同轨、书同文，然后是四百年的汉。", why: "秦定下了框架，两汉把它活成了一个文明。",
    labelTitle: "为什么我们叫「汉」人", sound: "秦汉乐章" },
  { id: "era-weijin", line: "era", name: "魏晋风度", seal: "风度", layers: [9, 11],
    hook: "最乱的时代，最自由的艺术。", why: "三国、两晋、南北朝，四百年分裂，佛像、书法和山水画都在这时长了出来。",
    labelTitle: "乱世里长出来的东西", sound: "魏晋南北朝乐章" },
  { id: "era-suitang", line: "era", name: "盛唐气象", seal: "盛唐", layers: [12, 14],
    hook: "从运河到长安，再到碎成十国。", why: "隋修运河，唐开盛世，五代把它拆开，一整段大起大落。",
    labelTitle: "长安城有多大", sound: "隋唐五代乐章" },
  { id: "era-songyuan", line: "era", name: "宋韵与草原", seal: "宋韵", layers: [15, 18],
    hook: "最精致的宋，和最辽阔的元，同时存在。", why: "宋、辽、金、元并立又更替，是中国最多元的一段。",
    labelTitle: "宋人的生活，比你想的更像现在", sound: "宋辽金元乐章" },
  { id: "era-mingqing", line: "era", name: "最后的帝国", seal: "帝国", layers: [19, 20],
    hook: "紫禁城、长城、大运河，留到今天最多的那一段。", why: "我们今天看到的「古代」，多半是明清的样子。",
    labelTitle: "我们看到的古代，多半是明清", sound: "明清乐章" },
  // ── 朝代 · 连续 ──
  { id: "chain-5", line: "era", name: "连成一段", seal: "一段", chain: 5,
    hook: "五个朝代，一口气连上了。", why: "历史不是一个个孤岛，你已经走出了一段不断的线。", labelTitle: "接上的那一刻", sound: "" },
  { id: "chain-10", line: "era", name: "半部通史", seal: "半部", chain: 10,
    hook: "中国史的一半，没有断过。", why: "十个朝代连在一起，足够看出兴衰的节奏。", labelTitle: "兴衰的节奏", sound: "" },
  { id: "chain-20", line: "era", name: "一脉相承", seal: "相承", chain: 20,
    hook: "从新石器到清，一根弦上没有空着的地方。", why: "二十层地层全部集齐，这是整部历史。", labelTitle: "一脉相承", sound: "大套" },
]
```

Layer numbers: 1 远古与新石器, 2 夏, 3 商, 4 西周, 5 东周, 6 秦, 7 西汉, 8 东汉, 9 三国, 10 两晋, 11 南北朝, 12 隋, 13 唐, 14 五代十国, 15 宋, 16 辽, 17 金, 18 元, 19 明, 20 清 (`order_index + 1` in `data/dynasties`).

Then `src/data/achievement-labels.ts`:

```ts
// 展签 for each achievement: 150–250 characters, every fact traceable (member museums' data/museums/*.yaml
// or well-documented history). Written in Task 3.
import { ACHIEVEMENTS } from "./achievements"
export const ACHIEVEMENT_LABELS: Record<string, string> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, ""]))
```

- [ ] **Step 4:** `bun test tests/achievements-data.test.ts` → all pass. If "every museum province belongs to a region" fails, the province is missing from `REGIONS` (fix the data, not the test).

- [ ] **Step 5: Commit**

```bash
git add src/data/achievements.ts src/data/achievement-labels.ts tests/achievements-data.test.ts
git commit -m "feat(achievements): catalog — 18 themes, 8 regions + milestones, 6 segments + chains"
```

---

### Task 3: 展签 texts

**Files:**
- Modify: `src/data/achievement-labels.ts`
- Modify: `tests/achievements-data.test.ts` (append a length check)

- [ ] **Step 1: Test** — append inside the `describe`:

```ts
  it("every 展签 is 120–300 characters", () => {
    for (const a of ACHIEVEMENTS) {
      const n = Array.from(ACHIEVEMENT_LABELS[a.id] ?? "").length
      expect([a.id, n >= 120 && n <= 300]).toEqual([a.id, true])
    }
  })
```
Run → FAIL (all empty).

- [ ] **Step 2: Write the 展签.** Replace the generated object with a literal `Record<string, string>` keyed by every id in `ACHIEVEMENTS` (35 entries). For each:
  - Topic = the achievement's `labelTitle`; open with a concrete image or fact, end with why the members belong together.
  - **Facts only from**: the member museums' `data/museums/<id>.yaml` (`specialty`, `timeline`, `treasures`, `halls`, `artifacts`), the dynasty files in `data/dynasties/`, or textbook-level history (dates of dynasties, 孝文帝迁都 494, 梁思成 1932 独乐寺, 南海一号 南宋沉船, 法门寺地宫 1987, 青州龙兴寺窖藏 1996). No invented numbers, quotes or names. If unsure of a fact, leave it out.
  - Voice: second person, warm, for young adults; no 亲子 tone; no Markdown.
  - Region/era/milestone entries may be more general but still concrete (name real places from the catalog).

- [ ] **Step 3:** `bun test tests/achievements-data.test.ts` → pass.

- [ ] **Step 4: Commit**

```bash
git add src/data/achievement-labels.ts tests/achievements-data.test.ts
git commit -m "feat(achievements): 展签 texts"
```

---

### Task 4: Engine (`AchCore`)

**Files:**
- Create: `src/ui/client/achievements-core.ts`
- Test: `tests/achievements-core.test.ts`

Input context: `{ visited: string[], museums: [{id, city, province}], eras: {museumId: number[]} (layer numbers), layers: 20 }`.
Output per achievement: `{ id, line, level: 0|1|2, have, reach, total, missing: [{museum}|{city}|{province}|{layer}] }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/achievements-core.test.ts
import { describe, it, expect } from "bun:test"
import { ACH_CORE_SCRIPT } from "~/ui/client/achievements-core"

const w: any = {}
new Function("window", ACH_CORE_SCRIPT)(w)
const A = w.AchCore

const museums = [
  { id: "a", city: "大同", province: "山西" }, { id: "b", city: "大同", province: "山西" },
  { id: "c", city: "洛阳", province: "河南" }, { id: "d", city: "洛阳", province: "河南" },
  { id: "e", city: "西安", province: "陕西" }, { id: "f", city: "北京", province: "北京" },
]
const catalog = [
  { id: "t1", line: "theme", members: [{ museum: "a" }, { museum: "b" }, { museum: "c" }, { museum: "d" }], reach: 3 },
  { id: "t2", line: "theme", members: [{ city: "西安" }, { city: "洛阳" }, { city: "北京" }], reach: 3 },
  { id: "r1", line: "region", provinces: ["山西", "北京", "天津"] },
  { id: "r2", line: "region", provinces: ["陕西"] },
  { id: "m1", line: "region", share: 0.5 },
  { id: "s1", line: "era", layers: [1, 3] },
  { id: "c3", line: "era", chain: 3 },
]
const eras = { a: [1], b: [2], c: [3, 4], d: [6], e: [5], f: [20] }
const ctx = (visited: string[]) => ({ visited, museums, eras, layers: 20 })
const by = (rs: any[]) => Object.fromEntries(rs.map((r: any) => [r.id, r]))

describe("AchCore.evaluate", () => {
  it("theme: reach → level 1, all → level 2, missing listed", () => {
    let r = by(A.evaluate(catalog, ctx(["a", "c"])))
    expect([r.t1.level, r.t1.have, r.t1.reach, r.t1.total]).toEqual([0, 2, 3, 4])
    expect(r.t1.missing).toEqual([{ museum: "b" }, { museum: "d" }])
    r = by(A.evaluate(catalog, ctx(["a", "b", "c"])))
    expect(r.t1.level).toBe(1)
    r = by(A.evaluate(catalog, ctx(["a", "b", "c", "d"])))
    expect(r.t1.level).toBe(2)
  })

  it("theme with city members: any museum in the city counts", () => {
    const r = by(A.evaluate(catalog, ctx(["d", "e"])))
    expect([r.t2.have, r.t2.missing]).toEqual([2, [{ city: "北京" }]])
  })

  it("region: first visit → 1; every province that has museums → 2 (天津 has none, so it doesn't count)", () => {
    let r = by(A.evaluate(catalog, ctx(["a"])))
    expect([r.r1.level, r.r1.have, r.r1.total, r.r1.missing]).toEqual([1, 1, 2, [{ province: "北京" }]])
    r = by(A.evaluate(catalog, ctx(["a", "f"])))
    expect(r.r1.level).toBe(2)
    expect(r.r2.level).toBe(0)
  })

  it("milestone: share of provinces that have museums", () => {
    // 4 provinces have museums → share 0.5 needs 2
    expect(by(A.evaluate(catalog, ctx(["a"]))).m1.level).toBe(0)
    expect(by(A.evaluate(catalog, ctx(["a", "e"]))).m1).toMatchObject({ level: 2, have: 2, reach: 2, total: 2 })
  })

  it("era segment: each layer needs a visited museum", () => {
    let r = by(A.evaluate(catalog, ctx(["a", "c"])))
    expect([r.s1.level, r.s1.have, r.s1.missing]).toEqual([0, 2, [{ layer: 2 }]])
    r = by(A.evaluate(catalog, ctx(["a", "b", "c"])))
    expect(r.s1.level).toBe(2)
  })

  it("chain: longest consecutive run", () => {
    expect(by(A.evaluate(catalog, ctx(["a", "b"]))).c3).toMatchObject({ level: 0, have: 2 })
    expect(by(A.evaluate(catalog, ctx(["a", "b", "c"]))).c3).toMatchObject({ level: 2, have: 3 })
  })
})

describe("AchCore.merge", () => {
  it("never lowers a stored level; records new ones with time", () => {
    const stored = { t1: { r: 100, c: 0 } }
    const results = [{ id: "t1", level: 0 }, { id: "s1", level: 2 }, { id: "r1", level: 1 }]
    const { next, fresh } = A.merge(stored, results, 500)
    expect(next).toEqual({ t1: { r: 100, c: 0 }, s1: { r: 500, c: 500 }, r1: { r: 500, c: 0 } })
    expect(fresh).toEqual([{ id: "s1", level: 2 }, { id: "r1", level: 1 }])
  })
  it("upgrades 1 → 2", () => {
    const { next, fresh } = A.merge({ t1: { r: 100, c: 0 } }, [{ id: "t1", level: 2 }], 900)
    expect(next.t1).toEqual({ r: 100, c: 900 })
    expect(fresh).toEqual([{ id: "t1", level: 2 }])
  })
  it("levelOf combines stored and computed", () => {
    expect(A.levelOf({ t1: { r: 1, c: 0 } }, { id: "t1", level: 0 })).toBe(1)
    expect(A.levelOf({}, { id: "t1", level: 2 })).toBe(2)
  })
})

describe("AchCore.nudges", () => {
  it("names what visiting a museum would do", () => {
    const res = A.evaluate(catalog, ctx(["a", "c"]))
    const n = A.nudges(catalog, res, museums.find((m) => m.id === "b"), eras)
    expect(n.map((x: any) => [x.id, x.kind])).toEqual([["t1", "last"], ["s1", "last"]])
    const n2 = A.nudges(catalog, res, museums.find((m) => m.id === "e"), eras)
    expect(n2.map((x: any) => [x.id, x.kind])).toEqual([["r2", "first"], ["t2", "advance"]])
  })
})
```

- [ ] **Step 2:** `bun test tests/achievements-core.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/ui/client/achievements-core.ts
// 打卡成就 engine, shipped as window.AchCore and evaluated as-is by tests.
// Levels: 0 未达成 · 1 达成 · 2 圆满 (single-level achievements jump straight to 2).
export const ACH_CORE_SCRIPT = `
(function(global){
  function set(list){ var s = {}; (list || []).forEach(function(x){ s[x] = true; }); return s; }

  function longestRun(have, n) {
    var best = 0, cur = 0;
    for (var i = 1; i <= n; i++) { if (have[i]) { cur++; if (cur > best) best = cur; } else cur = 0; }
    return best;
  }

  function evaluate(catalog, ctx) {
    var visited = set(ctx.visited), byId = {}, provinces = {}, provVisited = {}, cityVisited = {}, layerHave = {};
    ctx.museums.forEach(function(m){
      byId[m.id] = m;
      if (m.province) provinces[m.province] = true;
      if (visited[m.id]) {
        if (m.province) provVisited[m.province] = true;
        if (m.city) cityVisited[m.city] = true;
        (ctx.eras[m.id] || []).forEach(function(l){ layerHave[l] = true; });
      }
    });
    var allProv = Object.keys(provinces), visitedProv = allProv.filter(function(p){ return provVisited[p]; });
    return catalog.map(function(a){
      var have = 0, reach = 0, total = 0, missing = [];
      if (a.members) {
        total = a.members.length; reach = a.reach || total;
        a.members.forEach(function(mem){
          var ok = mem.museum ? !!visited[mem.museum] : !!cityVisited[mem.city];
          if (ok) have++; else missing.push(mem.museum ? { museum: mem.museum } : { city: mem.city });
        });
        return { id: a.id, line: a.line, level: have >= total ? 2 : have >= reach ? 1 : 0, have: have, reach: reach, total: total, missing: missing };
      }
      if (a.provinces) {
        var inCat = a.provinces.filter(function(p){ return provinces[p]; });
        total = inCat.length; reach = 1;
        inCat.forEach(function(p){ if (provVisited[p]) have++; else missing.push({ province: p }); });
        return { id: a.id, line: a.line, level: total && have >= total ? 2 : have >= 1 ? 1 : 0, have: have, reach: reach, total: total, missing: missing };
      }
      if (a.share) {
        total = reach = Math.max(1, Math.ceil(allProv.length * a.share));
        have = Math.min(visitedProv.length, total);
        allProv.forEach(function(p){ if (!provVisited[p]) missing.push({ province: p }); });
        return { id: a.id, line: a.line, level: have >= total ? 2 : 0, have: have, reach: reach, total: total, missing: have >= total ? [] : missing };
      }
      if (a.layers) {
        for (var l = a.layers[0]; l <= a.layers[1]; l++) { total++; if (layerHave[l]) have++; else missing.push({ layer: l }); }
        reach = total;
        return { id: a.id, line: a.line, level: have >= total ? 2 : 0, have: have, reach: reach, total: total, missing: missing };
      }
      if (a.chain) {
        total = reach = a.chain;
        have = Math.min(longestRun(layerHave, ctx.layers), total);
        return { id: a.id, line: a.line, level: have >= total ? 2 : 0, have: have, reach: reach, total: total, missing: [] };
      }
      return { id: a.id, line: a.line, level: 0, have: 0, reach: 0, total: 0, missing: [] };
    });
  }

  // stored: { id: { r: reachedAt, c: completedAt } } (0 = not yet). Never lowers anything.
  function merge(stored, results, now) {
    var next = {}, fresh = [];
    Object.keys(stored || {}).forEach(function(k){ next[k] = { r: stored[k].r || 0, c: stored[k].c || 0 }; });
    results.forEach(function(res){
      var cur = next[res.id] || { r: 0, c: 0 }, was = cur.c ? 2 : cur.r ? 1 : 0;
      if (res.level <= was) return;
      if (!cur.r) cur.r = now;
      if (res.level === 2) cur.c = now;
      next[res.id] = cur;
      fresh.push({ id: res.id, level: res.level });
    });
    return { next: next, fresh: fresh };
  }

  function levelOf(stored, res) {
    var s = (stored || {})[res.id], was = s ? (s.c ? 2 : s.r ? 1 : 0) : 0;
    return Math.max(was, res.level);
  }

  // What visiting museum m would do: [{ id, kind: 'last'|'first'|'advance', next }] — 'last' = this completes a level.
  function nudges(catalog, results, m, eras) {
    var out = [], byRes = {};
    results.forEach(function(r){ byRes[r.id] = r; });
    var mEras = set((eras || {})[m.id]);
    catalog.forEach(function(a){
      var r = byRes[a.id]; if (!r || r.level === 2) return;
      var hit = r.missing.some(function(x){
        return (x.museum && x.museum === m.id) || (x.city && x.city === m.city) || (x.province && x.province === m.province) || (x.layer && mEras[x.layer]);
      });
      if (!hit) return;
      if (a.share || a.chain) return;
      var target = r.level === 1 ? r.total : r.reach;
      if (a.provinces && r.level === 0) { out.push({ id: a.id, kind: 'first', next: 1 }); return; }
      if (target - r.have === 1) out.push({ id: a.id, kind: 'last', next: r.level === 1 ? 2 : (r.reach === r.total ? 2 : 1) });
      else if (a.members) out.push({ id: a.id, kind: 'advance', next: r.level });
    });
    var rank = { last: 0, first: 1, advance: 2 };
    return out.sort(function(x, y){ return rank[x.kind] - rank[y.kind]; });
  }

  global.AchCore = { evaluate: evaluate, merge: merge, levelOf: levelOf, nudges: nudges, longestRun: longestRun };
})(window);
`
```

- [ ] **Step 4:** `bun test tests/achievements-core.test.ts` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/ui/client/achievements-core.ts tests/achievements-core.test.ts
git commit -m "feat(achievements): AchCore — progress, never-lower merge, what-a-visit-would-do nudges"
```

---

### Task 5: Persistence for logged-in users

**Files:**
- Create: `migrations/0015_user_achievements.sql`
- Create: `src/repo/achievements.ts`
- Create: `src/routes/achievements.ts`
- Modify: `src/index.ts` (import + `.use(achievementsRoute)` next to `visitsRoute`)
- Test: `tests/achievements-route.test.ts`

- [ ] **Step 1: Migration**

```sql
-- migrations/0015_user_achievements.sql
-- Unlocked achievements are kept, never recomputed away (docs/superpowers/specs/打卡成就.md §3).
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  reached_at INTEGER NOT NULL,
  completed_at INTEGER,
  PRIMARY KEY (user_id, achievement_id)
);
```

Apply locally: `bunx wrangler d1 migrations apply museum-map-db --local`. **Do not apply `--remote`** — that needs the user's go-ahead (Task 10).

- [ ] **Step 2: Failing test.** Look at `tests/auth-routes.test.ts` for how a logged-in session cookie is created (register/login against `createApp(env)`), and reuse that helper pattern:

```ts
// tests/achievements-route.test.ts  — skeleton; copy the env + login helper from tests/auth-routes.test.ts
import { describe, it, expect } from "bun:test"
// … env/login helpers …

describe("/api/achievements", () => {
  it("401 without a session", async () => {
    const res = await app.handle(new Request("http://localhost/api/achievements"))
    expect(res.status).toBe(401)
  })

  it("stores unlocks, ignores unknown ids, never lowers", async () => {
    const cookie = await login()
    const post = (items: unknown) => app.handle(new Request("http://localhost/api/achievements", {
      method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ items }),
    }))
    expect((await post([{ id: "theme-sanguo", r: 1000, c: 1000 }, { id: "nope", r: 1, c: 0 }])).status).toBe(200)
    expect((await post([{ id: "theme-sanguo", r: 5000, c: 0 }])).status).toBe(200)
    const got = await (await app.handle(new Request("http://localhost/api/achievements", { headers: { cookie } }))).json()
    expect(got.items).toEqual({ "theme-sanguo": { r: 1000, c: 1000 } })
  })
})
```

Run → FAIL (404).

- [ ] **Step 3: Repo + route**

```ts
// src/repo/achievements.ts
export interface Unlock { r: number; c: number }

export class AchievementsRepo {
  constructor(private db: D1Database) {}

  async list(userId: string): Promise<Record<string, Unlock>> {
    const { results } = await this.db
      .prepare("SELECT achievement_id AS id, reached_at AS r, completed_at AS c FROM user_achievements WHERE user_id = ?")
      .bind(userId).all<{ id: string; r: number; c: number | null }>()
    const out: Record<string, Unlock> = {}
    for (const row of results) out[row.id] = { r: row.r, c: row.c ?? 0 }
    return out
  }

  /** Keeps the earliest times; never clears completed_at. */
  async upsert(userId: string, items: { id: string; r: number; c: number }[]): Promise<void> {
    if (!items.length) return
    const stmt = this.db.prepare(
      `INSERT INTO user_achievements (user_id, achievement_id, reached_at, completed_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, achievement_id) DO UPDATE SET
         reached_at = MIN(reached_at, excluded.reached_at),
         completed_at = CASE
           WHEN completed_at IS NULL THEN excluded.completed_at
           WHEN excluded.completed_at IS NULL THEN completed_at
           ELSE MIN(completed_at, excluded.completed_at) END`,
    )
    await this.db.batch(items.map((i) => stmt.bind(userId, i.id, i.r, i.c || null)))
  }
}
```

```ts
// src/routes/achievements.ts
import { Elysia } from "elysia"
import type { Env } from "~/index"
import { sessionMiddleware, requireUser } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import { AchievementsRepo } from "~/repo/achievements"
import { ACHIEVEMENTS } from "~/data/achievements"

interface Ctx { env: Env; body: any; set: any; user: UserRow | null }
const KNOWN = new Set(ACHIEVEMENTS.map((a) => a.id))

export const achievementsRoute = new Elysia()
  .use(sessionMiddleware)
  .get("/api/achievements", async (ctx) => {
    const c = ctx as unknown as Ctx
    const u = requireUser(c as any)
    if (!u) return { error: "unauthorized" }
    return { items: await new AchievementsRepo(c.env.DB).list(u.id) }
  })
  .post("/api/achievements", async (ctx) => {
    const c = ctx as unknown as Ctx
    const u = requireUser(c as any)
    if (!u) return { error: "unauthorized" }
    const raw = Array.isArray(c.body?.items) ? c.body.items.slice(0, 200) : []
    const now = Date.now()
    const items = raw
      .filter((i: any) => i && KNOWN.has(i.id) && Number.isFinite(i.r) && i.r > 0)
      .map((i: any) => ({ id: String(i.id), r: Math.min(Number(i.r), now), c: Number.isFinite(i.c) && i.c > 0 ? Math.min(Number(i.c), now) : 0 }))
    await new AchievementsRepo(c.env.DB).upsert(u.id, items)
    return { ok: true, n: items.length }
  })
```

`requireUser` sets 401 itself in the existing routes — check `src/middleware/session.ts`; if it doesn't, set `c.set.status = 401` before returning.

- [ ] **Step 4:** `bun test tests/achievements-route.test.ts && bun run typecheck` → pass.

- [ ] **Step 5: Commit**

```bash
git add migrations/0015_user_achievements.sql src/repo/achievements.ts src/routes/achievements.ts src/index.ts tests/achievements-route.test.ts
git commit -m "feat(achievements): user_achievements table and /api/achievements (never lowers)"
```

---

### Task 6: Client state and sync

**Files:**
- Modify: `src/ui/home.ts` — import `ACHIEVEMENTS` and `ACHIEVEMENT_LABELS`; bootstrap `achievements: ACHIEVEMENTS.map((a) => ({ ...a, label: ACHIEVEMENT_LABELS[a.id] }))`; import `ACH_CORE_SCRIPT` and inject `<script>${ACH_CORE_SCRIPT}</script>` right after the `TRIP_CORE_SCRIPT` script tag.
- Modify: `src/ui/client/app.ts`

- [ ] **Step 1: State** (in the data object, near `trip`):

```js
    achCatalog: [],
    ach: { stored: {}, queue: [], sheetId: null, ready: false },
```

and in init, after `this.aiCatalog = …`:

```js
      this.achCatalog = data.achievements || [];
```

- [ ] **Step 2: Methods** — add a `// ─── 打卡成就 ───` section:

```js
    // ─── 打卡成就 ─── (docs/superpowers/specs/打卡成就.md)
    achCtx() {
      var self = this, eras = {};
      this.museums.forEach(function(m){ eras[m.id] = self.linkedDynasties(m.id).map(function(d){ return self.layerNo(d.id); }); });
      return { visited: this.visits.ids.slice(), museums: this.museums, eras: eras, layers: this.dynasties.length };
    },

    /** Progress for every achievement, memoized on visits. */
    achResults() {
      var key = this.visits.ids.join(',') + '|' + this.museums.length + '|' + this.dynasties.length;
      if (__ach && __achKey === key) return __ach;
      __ach = window.AchCore.evaluate(this.achCatalog, this.achCtx());
      __achKey = key;
      return __ach;
    },

    achById(id) { return this.achCatalog.find(function(a){ return a.id === id; }) || null; },
    achResult(id) { return this.achResults().find(function(r){ return r.id === id; }) || null; },
    achLevel(id) { var r = this.achResult(id); return r ? window.AchCore.levelOf(this.isReadOnly ? {} : this.ach.stored, r) : 0; },

    /** Load what's been unlocked before (local or server), then record anything new. */
    async loadAchievements() {
      var local = {};
      try { local = JSON.parse(window.localStorage.getItem('mmAch') || '{}') || {}; } catch(_) {}
      if (window.MuseumAuth && window.MuseumAuth.isAuthenticated()) {
        try {
          var res = await fetch('/api/achievements', { credentials: 'same-origin' });
          var j = res.ok ? await res.json() : { items: {} };
          var merged = j.items || {};
          // Bring anonymous unlocks along on first login.
          Object.keys(local).forEach(function(k){ if (!merged[k]) merged[k] = local[k]; });
          this.ach.stored = merged;
        } catch(_) { this.ach.stored = local; }
      } else this.ach.stored = local;
      this.ach.ready = true;
      this.syncAchievements(false);
    },

    /** Record new unlocks. With ceremony=true (just stamped), queue the 落印 for each. */
    syncAchievements(ceremony) {
      if (!this.ach.ready || this.isReadOnly) return;
      var out = window.AchCore.merge(this.ach.stored, this.achResults(), Date.now());
      if (!out.fresh.length) return;
      this.ach.stored = out.next;
      try { window.localStorage.setItem('mmAch', JSON.stringify(out.next)); } catch(_) {}
      if (window.MuseumAuth && window.MuseumAuth.isAuthenticated()) {
        var items = out.fresh.map(function(f){ var s = out.next[f.id]; return { id: f.id, r: s.r, c: s.c }; });
        fetch('/api/achievements', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: items }) }).catch(function(){});
      }
      if (ceremony) this.ach.queue = this.ach.queue.concat(out.fresh);
    },

    achCeremony() { return this.ach.queue[0] || null; },
    achDismiss() { this.ach.queue = this.ach.queue.slice(1); },

    /** Rows for the 成就 page: [{ line, title, items: [{ a, r, level }] }], unlocked and nearly-there first. */
    achGroups() {
      var self = this, lines = [['theme', '专题收集'], ['region', '区域'], ['era', '朝代']];
      return lines.map(function(l){
        var items = self.achCatalog.filter(function(a){ return a.line === l[0]; }).map(function(a){
          var r = self.achResult(a.id); return { a: a, r: r, level: self.achLevel(a.id) };
        });
        items.sort(function(x, y){
          return (y.level - x.level) || ((y.r.have / (y.r.reach || 1)) - (x.r.have / (x.r.reach || 1)));
        });
        return { line: l[0], title: l[1], items: items, done: items.filter(function(i){ return i.level > 0; }).length };
      });
    },

    achStatus(id) {
      var r = this.achResult(id), lv = this.achLevel(id);
      if (!r) return '';
      if (lv === 2) return r.reach < r.total ? '圆满' : '已达成';
      if (lv === 1) return '已达成 · 再集 ' + (r.total - r.have) + ' 处就圆满';
      var left = r.reach - r.have;
      if (r.have === 0) return '还没开始 · 需要 ' + r.reach + ' 处';
      return left === 1 ? '只差一处' : '还差 ' + left + ' 处';
    },

    /** Missing pieces as display rows, nearest first when we know where you are. */
    achMissing(id) {
      var r = this.achResult(id), self = this; if (!r) return [];
      var here = this.geo && this.geo.lat != null ? { lat: this.geo.lat, lng: this.geo.lng } : null;
      var rows = r.missing.map(function(x){
        if (x.museum) { var m = self.museumById(x.museum); return m ? { kind: 'museum', id: m.id, name: m.name, sub: m.city || '', km: here ? self.kmBetween(here, m) : null } : null; }
        if (x.city) return { kind: 'city', name: x.city, sub: '城里任意一座收录馆' };
        if (x.province) return { kind: 'province', name: x.province, sub: '' };
        if (x.layer) { var d = self.dynasties[x.layer - 1]; return d ? { kind: 'layer', id: d.id, name: self.dynastyShortName(d).replace(/[：:].*$/, ''), sub: '这一层还空着' } : null; }
        return null;
      }).filter(Boolean);
      if (here) rows.sort(function(a, b){ return (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km); });
      return rows;
    },

    achDone(id) {
      var a = this.achById(id), self = this; if (!a || !a.members) return [];
      var vis = {}; this.visits.ids.forEach(function(v){ vis[v] = true; });
      return a.members.filter(function(mem){
        if (mem.museum) return vis[mem.museum];
        return self.visitedMuseums().some(function(m){ return m.city === mem.city; });
      }).map(function(mem){ return mem.museum ? self.museumById(mem.museum) : { id: '', name: mem.city }; }).filter(Boolean);
    },

    /** 展签: full when unlocked, first sentence as a teaser otherwise. */
    achLabel(id) {
      var a = this.achById(id); if (!a || !a.label) return '';
      if (this.achLevel(id) > 0) return a.label;
      var cut = a.label.search(/[。！？]/);
      return cut > 0 ? a.label.slice(0, cut + 1) : a.label.slice(0, 40);
    },

    achDate(id) {
      var s = this.ach.stored[id]; if (!s) return '';
      var t = s.c || s.r, d = new Date(t);
      return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
    },

    openAch(id) { this.ach.sheetId = id; },
    closeAch() { this.ach.sheetId = null; },

    /** Recommendation chips from achievements for one museum (max 2, completing ones first). */
    achChips(m) {
      if (!m || !this.achCatalog.length) return [];
      var self = this, eras = {}; eras[m.id] = this.linkedDynasties(m.id).map(function(d){ return self.layerNo(d.id); });
      return window.AchCore.nudges(this.achCatalog, this.achResults(), m, eras).slice(0, 2).map(function(n){
        var a = self.achById(n.id), r = self.achResult(n.id);
        var t = n.kind === 'last' ? (n.next === 2 && r.level === 1 ? '「' + a.name + '」就圆满' : '「' + a.name + '」就达成')
          : n.kind === 'first' ? '第一次来' + (a.provinces ? '这一片 · 「' + a.name + '」' : '')
          : '「' + a.name + '」第 ' + (r.have + 1) + ' 处';
        return { k: n.kind === 'last' ? 'ach-last' : 'ach', t: t, w: n.kind === 'last' ? 3 : n.kind === 'first' ? 1.5 : 0.5 };
      });
    },
```

Next to the other module-level caches (`var __tripView …`), add `var __ach = null, __achKey = '';`.

- [ ] **Step 3: Hooks**
  - At the end of `loadVisits()` (both branches, after `visits.ids` is set), and in init after the first `loadVisits()`, call `this.loadAchievements()` once (guard with `if (!this.ach.ready)`) — after that, only `syncAchievements`.
  - In `toggleVisit`, inside the "Stamped just now" block (`if (!visited && this.isVisited(id)) { … }`), add `this.syncAchievements(true);`. Also call `this.syncAchievements(false)` after login/register (`submitLogin`, `submitRegister`) following `loadVisits()` — and set `this.ach.ready = false; this.loadAchievements();` there so server unlocks are pulled.

- [ ] **Step 4:** Typecheck + syntax check (scratch `new Function(APP_SCRIPT)`), commit:

```bash
git add src/ui/home.ts src/ui/client/app.ts
git commit -m "feat(achievements): client state, unlock sync (local + server), helpers for the page"
```

---

### Task 7: 成就 page, sheet and ceremony

**Files:**
- Create: `src/ui/components/achievements.ts`
- Modify: `src/ui/components/sidebar.ts` (stamps section)
- Modify: `src/ui/home.ts` (mount `AchievementSheet()` + `AchievementCeremony()` once, next to the chat panel)
- Modify: `src/ui/theme.ts`

- [ ] **Step 1: 集章册 section.** In `sidebar.ts`, inside the `stamps` section after the `seal-wall` block, add:

```html
  <div class="ach-wrap">
    <div class="ach-head"><span>成就</span><small x-text="achGroups().reduce(function(s, g){ return s + g.done; }, 0) + ' / ' + achCatalog.length"></small></div>
    <template x-for="g in achGroups()" :key="g.line">
      <div class="ach-group">
        <div class="ach-group-title"><span x-text="g.title"></span><small x-text="g.done + ' / ' + g.items.length"></small></div>
        <div class="ach-grid">
          <template x-for="it in g.items" :key="it.a.id">
            <button class="ach-card" :class="'lv' + it.level + ' line-' + it.a.line" @click="openAch(it.a.id)">
              <span class="ach-seal" x-text="it.a.seal"></span>
              <span class="ach-name" x-text="it.a.name"></span>
              <span class="ach-bar"><i :style="'width:' + Math.min(100, Math.round(100 * it.r.have / (it.r.total || 1))) + '%'"></i><b x-show="it.r.reach < it.r.total" :style="'left:' + Math.round(100 * it.r.reach / it.r.total) + '%'"></b></span>
              <span class="ach-status" x-text="achStatus(it.a.id)"></span>
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>
```

- [ ] **Step 2: Component** `src/ui/components/achievements.ts`:

```ts
import { icon } from "../icons"

/** The achievement sheet: what it is, why it's worth it, where to go next, and the 展签. */
export function AchievementSheet(): string {
  return `<div class="ach-overlay" x-show="ach.sheetId" x-cloak @click="closeAch()"></div>
<section class="ach-sheet" x-show="ach.sheetId" x-cloak role="dialog" aria-label="成就">
  <template x-if="ach.sheetId && achById(ach.sheetId)">
    <div x-data="{ get a(){ return achById(ach.sheetId) }, get r(){ return achResult(ach.sheetId) } }">
      <header class="ach-sheet-head">
        <span class="ach-seal big" :class="'lv' + achLevel(a.id) + ' line-' + a.line" x-text="a.seal"></span>
        <div>
          <div class="ach-kicker" x-text="({ theme: '专题收集', region: '区域', era: '朝代' })[a.line]"></div>
          <h2 x-text="a.name"></h2>
          <div class="ach-status" x-text="achStatus(a.id) + (achDate(a.id) ? ' · ' + achDate(a.id) : '')"></div>
        </div>
        <button class="icon-btn" @click="closeAch()" aria-label="关闭">${icon("close", 18)}</button>
      </header>
      <p class="ach-hook" x-text="a.hook"></p>
      <div class="ach-bar big"><i :style="'width:' + Math.min(100, Math.round(100 * r.have / (r.total || 1))) + '%'"></i><b x-show="r.reach < r.total" :style="'left:' + Math.round(100 * r.reach / r.total) + '%'"></b></div>
      <div class="ach-count" x-text="r.have + ' / ' + r.total + (r.reach < r.total ? '（' + r.reach + ' 处达成，' + r.total + ' 处圆满）' : '')"></div>
      <h3>为什么值得</h3>
      <p x-text="a.why"></p>
      <template x-if="achDone(a.id).length">
        <div><h3>已经集到</h3>
          <ul class="ach-list"><template x-for="m in achDone(a.id)" :key="m.id + m.name"><li class="done"><button @click="m.id && openMuseum(m.id)">${icon("check", 14)}<span x-text="m.name"></span></button></li></template></ul>
        </div>
      </template>
      <template x-if="achMissing(a.id).length">
        <div><h3 x-text="achLevel(a.id) ? '再去这些，就圆满' : '还差这些'"></h3>
          <ul class="ach-list"><template x-for="x in achMissing(a.id)" :key="x.kind + x.name">
            <li><button @click="x.kind === 'museum' ? openMuseum(x.id) : (x.kind === 'layer' ? openDynasty(x.id) : null)">
              <span x-text="x.name"></span><small x-text="x.km != null ? '离你 ' + Math.round(x.km) + ' 公里' : x.sub"></small>
            </button></li>
          </template></ul>
        </div>
      </template>
      <h3>展签 · <span x-text="a.labelTitle"></span></h3>
      <p class="ach-label" :class="achLevel(a.id) ? '' : 'locked'" x-text="achLabel(a.id)"></p>
      <p class="ach-locked-note" x-show="!achLevel(a.id)">达成后读全文</p>
    </div>
  </template>
</section>`
}

/** 落印: shown once per new unlock right after a stamp. */
export function AchievementCeremony(): string {
  return `<div class="ach-ceremony" x-show="achCeremony()" x-cloak x-transition.opacity>
  <template x-if="achCeremony()">
    <div class="ach-ceremony-card" x-data="{ get c(){ return achCeremony() }, get a(){ return achById(achCeremony().id) } }">
      <div class="ach-ceremony-kicker" x-text="c.level === 2 && achResult(a.id).reach < achResult(a.id).total ? '圆满' : '解锁成就'"></div>
      <span class="ach-seal stamp" :class="'lv' + c.level + ' line-' + a.line" x-text="a.seal"></span>
      <h2 x-text="a.name"></h2>
      <p x-text="a.hook"></p>
      <div class="ach-ceremony-actions">
        <button class="btn btn-primary" @click="openAch(a.id); achDismiss()">读展签</button>
        <button class="btn btn-text" @click="achDismiss()">好</button>
      </div>
    </div>
  </template>
</div>`
}
```

Check that `openDynasty` exists in app.ts (grep `openDynasty(`); if the dynasty opener is named differently, use that name.

- [ ] **Step 3: Styles** — append to `src/ui/theme.ts`:

```css
/* 打卡成就 */
.ach-wrap { margin-top: 22px; }
.ach-head { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--serif); font-weight: 600; font-size: 17px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
.ach-head small, .ach-group-title small { font-family: var(--mono); font-weight: 400; font-size: 11.5px; color: var(--text-3); }
.ach-group { margin-top: 14px; }
.ach-group-title { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2); margin-bottom: 8px; }
.ach-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ach-card { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto auto; gap: 3px 9px; align-items: center; text-align: left; padding: 9px 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--text); cursor: pointer; min-width: 0; }
.ach-card .ach-seal { grid-row: 1 / 4; }
.ach-card .ach-name { font-size: 13.5px; font-weight: 600; overflow-wrap: anywhere; }
.ach-card .ach-status { font-size: 11px; color: var(--text-3); overflow-wrap: anywhere; }
.ach-card.lv0 { opacity: 0.82; }
.ach-seal { width: 38px; height: 38px; display: grid; place-items: center; font-family: var(--serif); font-weight: 700; font-size: 12px; line-height: 1.05; letter-spacing: 0.02em; color: var(--text-4); border: 1.5px dashed var(--line-strong); border-radius: 6px; writing-mode: vertical-rl; }
.ach-seal.line-region { border-radius: 50%; }
.ach-seal.line-era { width: 30px; height: 46px; border-radius: 5px; }
.ach-seal.lv1, .ach-seal.lv2 { color: #FFF2E8; background: var(--seal); border: 1.5px solid var(--seal); }
.ach-seal.lv2 { box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px var(--gilt); }
.ach-seal.big { width: 58px; height: 58px; font-size: 16px; }
.ach-seal.big.line-era { width: 44px; height: 68px; }
.ach-bar { position: relative; display: block; height: 4px; border-radius: 4px; background: var(--line); overflow: visible; }
.ach-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; background: var(--seal); }
.ach-bar b { position: absolute; top: -3px; width: 1.5px; height: 10px; background: var(--text-3); }
.ach-bar.big { height: 6px; margin: 14px 0 6px; }
.ach-overlay { position: fixed; inset: 0; z-index: 70; background: rgba(0,0,0,0.28); }
.ach-sheet { position: fixed; z-index: 71; left: 50%; bottom: 0; transform: translateX(-50%); width: min(560px, 100vw); max-height: 86dvh; overflow-y: auto; padding: 18px 22px calc(22px + env(safe-area-inset-bottom)); background: var(--bg); border-radius: 22px 22px 0 0; border: 1px solid var(--line-strong); box-shadow: 0 -24px 60px -30px var(--sh-95); overflow-wrap: anywhere; }
.ach-sheet-head { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; }
.ach-sheet h2 { margin: 2px 0; font-family: var(--serif); font-size: 22px; }
.ach-sheet h3 { margin: 18px 0 6px; font-size: 13px; color: var(--text-2); font-weight: 600; }
.ach-kicker { font-family: var(--mono); font-size: 11px; color: var(--text-3); letter-spacing: 0.08em; }
.ach-hook { margin: 12px 0 0; font-family: var(--serif); font-size: 16px; }
.ach-count { font-family: var(--mono); font-size: 11.5px; color: var(--text-3); }
.ach-list { list-style: none; margin: 0; padding: 0; }
.ach-list li button { display: flex; width: 100%; gap: 8px; align-items: center; justify-content: space-between; padding: 8px 0; border: 0; border-bottom: 1px solid var(--line); background: none; color: var(--text); text-align: left; cursor: pointer; font-size: 14px; }
.ach-list li.done button { justify-content: flex-start; color: var(--text-2); }
.ach-list small { color: var(--text-3); font-size: 11.5px; white-space: nowrap; }
.ach-label { font-family: var(--serif); line-height: 1.85; }
.ach-label.locked { color: var(--text-3); }
.ach-locked-note { font-size: 11.5px; color: var(--text-4); margin-top: -4px; }
.ach-ceremony { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; background: rgba(0,0,0,0.42); padding: 24px; }
.ach-ceremony-card { width: min(360px, 100%); text-align: center; padding: 28px 24px 22px; background: var(--bg); border-radius: 22px; border: 1px solid var(--line-strong); }
.ach-ceremony-kicker { font-family: var(--mono); font-size: 11.5px; letter-spacing: 0.18em; color: var(--seal-ink-strong); }
.ach-ceremony-card h2 { font-family: var(--serif); margin: 14px 0 6px; }
.ach-ceremony-card p { color: var(--text-2); margin: 0 0 18px; }
.ach-ceremony-card .ach-seal { margin: 18px auto 0; width: 84px; height: 84px; font-size: 22px; }
.ach-ceremony-card .ach-seal.line-era { width: 62px; height: 96px; }
.ach-seal.stamp { animation: ach-stamp 0.7s cubic-bezier(.2,1.6,.4,1) both; }
@keyframes ach-stamp { 0% { transform: scale(2.4) rotate(-14deg); opacity: 0; } 55% { transform: scale(0.92) rotate(3deg); opacity: 1; } 100% { transform: scale(1) rotate(-4deg); } }
.ach-ceremony-actions { display: flex; gap: 10px; justify-content: center; }
@media (prefers-reduced-motion: reduce) { .ach-seal.stamp { animation: none; } }
```

Check variable names exist in `theme.ts` (`--surface`, `--line`, `--line-strong`, `--seal`, `--gilt`, `--seal-ink-strong`, `--sh-95`, `--text-2..4`); substitute existing equivalents if one is missing.

- [ ] **Step 4:** Mount both components in `home.ts` (import from `./components/achievements`, place `${AchievementSheet()}${AchievementCeremony()}` right after `${ChatPanel()}`). Typecheck + `bun test tests/html.test.ts`; commit:

```bash
git add src/ui/components/achievements.ts src/ui/components/sidebar.ts src/ui/home.ts src/ui/theme.ts
git commit -m "feat(achievements): 成就 page in 集章册, achievement sheet with 展签, 落印 ceremony"
```

---

### Task 8: Achievements in recommendation reasons

**Files:**
- Modify: `src/ui/client/app.ts` (`tripTags`, `ledgerView` rec rows, the guide's system line)
- Modify: `src/ui/components/sidebar.ts` (render chips in ledger recs)
- Modify: `src/ui/theme.ts` (chip colours)

- [ ] **Step 1: Trip.** In `tripTags(m, kmOff, held)`, before building the score:

```js
      var ach = this.achChips(m);
      ach.forEach(function(c){ chips.splice(c.k === 'ach-last' ? 0 : chips.length, 0, { k: c.k, t: c.t }); });
```
and add the weights to the returned score: `score: window.TripCore.score(t) + ach.reduce(function(s, c){ return s + c.w; }, 0)`. No memo change is needed: `tripAlong`'s key already includes `visits.ids`, which is all achievements depend on.

- [ ] **Step 2: Ledger (附近可补).** In `ledgerView()`, where recommendation rows are built (search `recs` / the objects with `m:` and `km:` that the sidebar renders under `lg-rec`), attach `ach: this.achChips(m)` to each rec and add `ach.reduce(... w ...)` to its sort score. In `sidebar.ts`, inside the rec item markup, add:

```html
<template x-for="c in (r.ach || [])" :key="c.t"><span class="why" :class="'why-' + c.k" x-text="c.t"></span></template>
```
(reuse the trip's `.why` chip style; if ledger recs use another chip class, use that.)

- [ ] **Step 3: Guide.** Next to `visitedLine()` add:

```js
    /** One line for the guide: achievements one visit away, so it can suggest the missing piece. */
    achLine() {
      var self = this, near = this.achResults().filter(function(r){
        var lv = self.achLevel(r.id), target = lv === 1 ? r.total : r.reach;
        return lv < 2 && r.have > 0 && target - r.have === 1;
      }).slice(0, 6).map(function(r){
        var a = self.achById(r.id), miss = self.achMissing(r.id).slice(0, 2).map(function(x){ return x.name; }).join('或');
        return '「' + a.name + '」差一处（' + miss + '）';
      });
      return near.length ? '用户快要完成的成就（推荐时可以顺带提，语气轻松）：' + near.join('；') : '';
    },
```
and append it wherever `visitedLine()` is appended to the system text in the chat request (search `visitedLine()`).

- [ ] **Step 4: Chip styles** (append to theme):

```css
.trip-why .why-ach-last, .why.why-ach-last { color: #FFF2E8; background: var(--seal); border-color: var(--seal); }
.trip-why .why-ach, .why.why-ach { color: var(--seal-ink-strong); border-color: rgba(var(--seal-rgb), 0.45); border-style: dashed; }
```

- [ ] **Step 5:** Typecheck, syntax check, `bun test tests/trip-core.test.ts tests/achievements-core.test.ts`; commit:

```bash
git add src/ui/client/app.ts src/ui/components/sidebar.ts src/ui/theme.ts
git commit -m "feat(achievements): achievement reasons in trip and 附近可补 recommendations, and for the guide"
```

---

### Task 9: Museum drawer shows its achievements

**Files:**
- Modify: `src/ui/client/app.ts` (`buildMuseumSections`)

- [ ] **Step 1:** In `buildMuseumSections(m)`, add a small section (follow how existing sections are pushed — look at their `{ title, html }` / `kind` shape) titled 「属于这些成就」 listing every theme achievement whose members include `m.id` or `m.city`: seal + name + `have/total` + status, each line clickable `@click="openAch(id)"` (if sections are rendered via `x-html`, add `data-ach="<id>"` and handle the click in the drawer's existing click delegate). Omit the section when the list is empty. Escape names with the existing HTML-escape helper used by other sections.

- [ ] **Step 2:** Typecheck + syntax check; commit:

```bash
git add src/ui/client/app.ts
git commit -m "feat(achievements): museum drawer lists the achievements it belongs to"
```

---

### Task 10: Verify, migrate, deploy

- [ ] **Step 1:** `bun run restore -- --target=local --confirm`, `bunx wrangler d1 migrations apply museum-map-db --local`, make sure `bun run dev` serves `http://127.0.0.1:4343`.

- [ ] **Step 2: Browser check** (Playwright script in `$TMPDIR/pwscripts/ach.mjs`, desktop 1440×900 and mobile 390×844):
  1. Seed `museumAnonVisits` with `shanxi-datong`, `yungang`, `hanwei-luoyang` (3/4 of 从平城到洛阳). Open 集章册 → 成就 section shows 「从平城到洛阳」 with 「只差一处」. Screenshot.
  2. Open its sheet → 还差 龙门石窟; 展签 shows only the first sentence + 「达成后读全文」. Screenshot.
  3. Open 龙门石窟's drawer and stamp it → ceremony appears with seal 「迁都」 and kicker 解锁成就; also 石窟寺 (云冈+龙门 = 2/4, not yet) must NOT appear. Screenshot.
  4. Dismiss → sheet shows full 展签 and today's date. `localStorage.mmAch` contains `theme-qiandu` with `c > 0`.
  5. Remove the 龙门 stamp → 「从平城到洛阳」 still shows as 已达成 (never revoked).
  6. Trip mode with city 洛阳 → 龙门石窟 (fresh profile without it) carries a red 「「从平城到洛阳」就达成」 chip at the front.
  7. No page errors.

- [ ] **Step 3:** Full tests twice + restore:

```bash
bun test > /dev/null 2>&1; bun test 2>&1 | grep -E "\(fail\)|^ *[0-9]+ (pass|fail)"
bun run restore -- --target=local --confirm
```
Expected: only the 2 known `image-enricher` failures.

- [ ] **Step 4: Remote migration — ask the user first.** The preview Worker binds the production D1. `migrations/0015_user_achievements.sql` only creates a new table (`IF NOT EXISTS`), nothing is altered or deleted. With approval: `bunx wrangler d1 migrations apply museum-map-db --remote`.

- [ ] **Step 5:** Deploy preview: `bunx wrangler deploy --name museum-map-preview --domains museum-preview.xianliao.de5.net`.

---

## Self-review notes

- Spec §1 准入 → catalog content (Task 2) + data guard tests. §2 four stages → `achStatus`, sheet (还差, 只差一处), ceremony. §3 incentives → seal (印 shapes per line, 朱印/金边), 展签 (Task 3, locked teaser), ceremony; sound + share card explicitly deferred. "已解锁不回收" → `AchCore.merge`/`levelOf`, `user_achievements` upsert never lowers, Task 10 step 5 check. §4 progress + reasons → bar with reach tick, nearest-first missing, `achChips` in trip/ledger/guide with ordering last > first > advance. §5–7 catalog → Task 2 (ids verified against `data/museums`). §8–11 expansion → data tests enforce the threshold rule, unique seals, region coverage, layer coverage; adding a theme = add an entry + 展签.
- Deliberate: 石窟寺 reach 3 (exception documented in spec); 古蜀 全集 (spec updated).
- Names used across tasks: `AchCore.{evaluate, merge, levelOf, nudges, longestRun}`; app `achCatalog, ach.{stored, queue, sheetId, ready}, achCtx, achResults, achById, achResult, achLevel, loadAchievements, syncAchievements, achCeremony, achDismiss, achGroups, achStatus, achMissing, achDone, achLabel, achDate, openAch, closeAch, achChips, achLine`; components `AchievementSheet, AchievementCeremony`.
