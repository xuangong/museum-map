# 循迹 · 杂志专题 (pilot: 张骞 + 苏轼) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 张骞 and 苏轼 threads into magazine features — cover, 导语, 4–6 acts written as scenes with 原文 quotes and verified ancient art — read in a full-screen reader whose map follows the act in view; the 循迹 list becomes a shelf of covers.

**Architecture:** Optional magazine fields on `Thread` (`mag`, `deck`, `opening`, `cover`, `acts`) in `src/data/threads.ts`, validated by tests; images curated by hand, resized and stored in R2 (`/img/xj-…`); a `XunjiReader` component rendered inside the 循迹 panel when the thread has `acts`, with an IntersectionObserver driving `MuseumMap.setThreadSegment`; era accent colours from a small data table. Threads without `acts` keep today's tour UI.

**Tech Stack:** Bun + Elysia (Workers runtime; prod = Miniflare on the VM), Alpine.js, Leaflet, bun:test, `sips` for image resizing, wrangler R2.

**Spec:** `docs/superpowers/specs/2026-11-26-xunji-magazine-design.md`

## Ground rules

- Branch `feat/xunji-mag`. Commit per task, trailer `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Client JS lives in TS template literals (app.ts, map.ts, component markup): double backslashes; no stray `${`.
- Content: young-adult voice, scene-led, never parent/child tone; facts from standard sources, disputed points hedged ("一般认为…"); our own words (jiangshan-map is GPL — reference only). Quotes must be exact.
- Images: only verified public-domain / CC artworks; each one downloaded and **viewed** before use; no watermarks; full credit.
- Run targeted tests only (full `bun test` reseeds local D1; afterwards `bun run restore -- --target=local --confirm`). Baseline: ~10–12 pre-existing failures (achievements, scrolls, image enricher, legacy "64 museums") — add none.
- Dev server: `bunx wrangler dev --port 8787`. No browser automation; verify by curl + `node --check`.

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/data/threads.ts` | modify | types `ThreadImage`, `ThreadAct`, optional `mag/deck/opening/cover/acts`; pilot content for `zhangqian`, `sushi` |
| `tests/threads.test.ts` | modify | magazine-field rules |
| `src/data/era-accents.ts` | create | dynasty id → accent colour |
| `scripts/thread-images.ts` | create | resize + hash + upload curated images to R2 (local / emit VM commands) |
| `src/ui/components/xunji-reader.ts` | create | `XunjiReader()` markup (cover, opening, acts, end) |
| `src/ui/components/xunji-panel.ts` | modify | render reader when thread has acts; cover-shelf picker |
| `src/ui/client/app.ts` | modify | reader state, act tracking, map sync, hash `#/x/<id>/<n>` → act |
| `src/ui/home.ts` | modify | bootstrap `eraAccents` |
| `src/ui/theme.ts` | modify | reader + shelf CSS |

---

### Task 1: Types, rules and era accents

**Files:** Modify `src/data/threads.ts`, `tests/threads.test.ts`; Create `src/data/era-accents.ts`

- [ ] **Step 1: Failing test** — append to `tests/threads.test.ts`:

```ts
import { ERA_ACCENTS } from "~/data/era-accents"

describe("magazine features", () => {
  const mags = THREADS.filter((t) => t.acts)
  it("acts cover every stop once, in order", () => {
    for (const t of mags) {
      const acts = t.acts!
      expect(acts.length).toBeGreaterThanOrEqual(4); expect(acts.length).toBeLessThanOrEqual(6)
      expect(acts[0].stops[0]).toBe(0)
      expect(acts[acts.length - 1].stops[1]).toBe(t.stops.length - 1)
      for (let k = 1; k < acts.length; k++) expect(acts[k].stops[0]).toBe(acts[k - 1].stops[1] + 1)
      for (const a of acts) expect(a.stops[1]).toBeGreaterThanOrEqual(a.stops[0])
    }
  })
  it("lengths, quotes, sources", () => {
    for (const t of mags) {
      expect(len(t.mag!)).toBeGreaterThanOrEqual(2); expect(len(t.mag!)).toBeLessThanOrEqual(4)
      expect(len(t.deck!)).toBeLessThanOrEqual(40)
      expect(len(t.opening!)).toBeGreaterThanOrEqual(150); expect(len(t.opening!)).toBeLessThanOrEqual(240)
      for (const a of t.acts!) {
        const body = a.body.join("")
        expect(len(body)).toBeGreaterThanOrEqual(280); expect(len(body)).toBeLessThanOrEqual(420)
        expect(len(a.title)).toBeGreaterThanOrEqual(2); expect(len(a.title)).toBeLessThanOrEqual(6)
        expect(a.source.length).toBeGreaterThan(0)
        if (a.quote) { expect(a.quote.text.length).toBeGreaterThan(0); expect(a.quote.source.length).toBeGreaterThan(0) }
      }
    }
  })
  it("images are self-hosted and fully credited", () => {
    for (const t of mags) {
      const imgs = [t.cover!, ...t.acts!.map((a) => a.image).filter(Boolean)] as any[]
      for (const im of imgs) {
        expect(im.src).toMatch(/^\/img\/xj-[a-z0-9-]+-[0-9a-f]{16}\.jpg$/)
        for (const k of ["work", "by", "where", "license"]) expect(String(im[k]).length).toBeGreaterThan(0)
      }
    }
  })
  it("every era has an accent", () => {
    for (const t of THREADS) expect(ERA_ACCENTS[t.era]).toMatch(/^#[0-9A-F]{6}$/i)
  })
})
```

- [ ] **Step 2: Run** `bun test tests/threads.test.ts` → FAIL (module `era-accents` missing).

- [ ] **Step 3: Types** — in `src/data/threads.ts` add above `ThreadStop`:

```ts
export interface ThreadImage {
  src: string; work: string; by: string; where: string; license: string
  commons?: string; focus?: string
}
export interface ThreadAct {
  title: string; place: string; span: string
  stops: [number, number]
  body: string[]
  quote?: { text: string; source: string }
  image?: ThreadImage
  source: string
}
```

and extend `Thread` with:

```ts
  mag?: string; deck?: string; opening?: string; cover?: ThreadImage; acts?: ThreadAct[]
```

- [ ] **Step 4: Era accents** — `src/data/era-accents.ts`:

```ts
/** 循迹 杂志: one accent per era (traditional colours), for numerals, seals, rules and the map strip. */
export const ERA_ACCENTS: Record<string, string> = {
  neolithic: "#B0763F", xia: "#9C6B3A", shang: "#7E8C5A", "western-zhou": "#8A7A3E", "eastern-zhou": "#A36A3E",
  qin: "#5C5A55", "western-han": "#B7472A", "eastern-han": "#A4503A", "three-kingdoms": "#8E4B3A", jin: "#6F8A86",
  nanbeichao: "#7F6A8E", sui: "#A07D3C", tang: "#C9A04B", wudai: "#7C6A55", liao: "#6E7F94",
  song: "#5E8C8A", "jin-jurchen": "#8B7A5A", yuan: "#4F6F8F", ming: "#C0392B", qing: "#D6A23A",
}
```

- [ ] **Step 5: Run** `bun test tests/threads.test.ts` → PASS (no thread has `acts` yet, so the magazine rules hold vacuously). Commit `feat(xunji-mag): magazine fields on threads, their rules, and era accent colours`.

---

### Task 2: Pilot writing — 张骞 and 苏轼

**Files:** Modify `src/data/threads.ts` (only `zhangqian`, `sushi`)

Write `mag`, `deck`, `opening`, `acts` (with `stops` ranges, `body` paragraphs, `quote`, `source`) for both threads; leave `cover` / act `image` for Task 3. Existing `stops` stay unchanged (the map and timetable depend on them).

Act outlines (adjust boundaries to the actual stop indexes in the file):

- `zhangqian` · mag 「凿空」 · deck ≈ "一个郎官，一百多人，一根汉节，走进没有地图的西方。十三年后回来的，只有两个人。"
  1. 应募 · 长安 — the court's need (大月氏, 匈奴), a young 郎官 volunteers, 堂邑父.
  2. 汉节 · 匈奴 — captured, ten years, a wife and child, 「持汉节不失」.
  3. 西去 · 大宛 → 康居 → 大月氏 — escape west, the kingdoms he saw (大宛 horses, 康居), 月氏 no longer wants revenge.
  4. 归途 · 大夏 → 羌中 — 大夏 markets with 邛竹杖 and 蜀布, captured again.
  5. 凿空 · 长安 — return with 堂邑父, the report that opened the 丝绸之路, 「凿空」 (司马迁's word).
- `sushi` · mag 「东坡」 · deck ≈ "他被一贬再贬，从黄州到儋州，却把每一处流放地都活成了诗。"
  1. 出川 · 眉山 → 开封 — the three 苏 cross the 秦岭, 欧阳修's 「出人头地」.
  2. 西湖与明月 · 杭州 → 密州 — 杭州 通判, 密州 中秋 「明月几时有」.
  3. 乌台 · 湖州 — arrested, the poems as evidence, 103 days.
  4. 东坡 · 黄州 — the slope he farmed, 赤壁 「大江东去」, the 东坡 name.
  5. 南迁 · 杭州 → 惠州 → 儋州 — 苏堤, 荔枝, the sea crossing to 儋州.
  6. 北归 · 镇江 → 常州 — 金山 portrait 「问汝平生功业」, death in 常州.

First add to the `magazine features` describe block in `tests/threads.test.ts`:

```ts
  it("pilot threads carry a magazine", () => {
    expect(mags.map((t) => t.id)).toEqual(expect.arrayContaining(["sushi", "zhangqian"]))
  })
```

Writing rules: opening 150–240 字 starting on a single moment; each act 280–420 字 across 2–4 paragraphs, scene-led (what he saw, heard, risked), then the fact; one exact 原文 quote per act where a reliable one exists (《史记·大宛列传》, 苏轼's own poems/letters, 《宋史》), `source` per act. Hedge disputed facts. Verify with `bun test tests/threads.test.ts` → PASS (the image test needs Task 3: until then run `-t "acts cover"`, `-t "lengths"`, `-t "pilot"`; the commit may leave the image test red — Task 3 follows immediately). Commit `content(xunji-mag): 张骞「凿空」 and 苏轼「东坡」 written as magazine features`.

(Controller then runs an independent fact-check; fixes in a separate commit.)

---

### Task 3: Images — curate, verify, store

**Files:** Create `scripts/thread-images.ts`; Modify `src/data/threads.ts`

- [ ] **Step 1: Curate.** For each pilot thread pick a `cover` and 2–4 act images from Wikimedia Commons (public domain or CC), preferring museum sources. Candidates already verified by eye: `File:ZhangQianTravels.jpg` (莫高窟第 323 窟 · 张骞出使西域图 · 唐 · 公有领域) for 张骞; `File:Su shi wearing Dongpo jin.jpg` (赵孟頫 东坡像局部, low-res — use only if no better) for 苏轼. Search further (e.g. 赵孟頫《前后赤壁赋》卷首东坡像 at NPM Taipei, 武元直《赤壁图》, 李公麟 / 元人 东坡笠屐图, 汉代画像石 / 车马出行图, 莫高窟 张骞 others, 西湖 / 赤壁 classical paintings). For each candidate: download the original or a ≥1200 px thumb into an isolated dir (`/tmp/xj-img/<thread>/`), **open it and look** (Read the image), reject anything mismatched, watermarked or too small (< 900 px wide for covers). Record work / by / where / license / commons URL.

- [ ] **Step 2: Script** `scripts/thread-images.ts`:

```ts
/**
 * Prepare curated 循迹 images: resize to ≤1200 px (JPEG q≈80 via macOS `sips`), name
 * xj-<thread>-<slug>-<sha16>.jpg, upload to the local R2 bucket, and print the VM commands.
 *   bun run scripts/thread-images.ts <dir> [--target=local]
 * <dir> holds files named <thread>-<slug>.jpg (e.g. zhangqian-cover.jpg). Prints the /img/ src for each.
 */
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const dir = process.argv[2]
if (!dir) { console.error("usage: bun run scripts/thread-images.ts <dir>"); process.exit(1) }
const out = join(dir, "out"); mkdirSync(out, { recursive: true })
const vm: string[] = []
for (const f of readdirSync(dir).filter((x) => /^[a-z0-9-]+\.(jpe?g|png|webp)$/i.test(x)).sort()) {
  const base = f.replace(/\.[a-z]+$/i, "")
  const tmp = join(out, base + ".jpg")
  execSync(`sips -s format jpeg -s formatOptions 80 -Z 1200 ${JSON.stringify(join(dir, f))} --out ${JSON.stringify(tmp)}`, { stdio: "ignore" })
  const sha = createHash("sha256").update(readFileSync(tmp)).digest("hex").slice(0, 16)
  const key = `xj-${base}-${sha}.jpg`
  execSync(`mv ${JSON.stringify(tmp)} ${JSON.stringify(join(out, key))}`)
  execSync(`bunx wrangler r2 object put museum-images/${key} --file ${JSON.stringify(join(out, key))} --content-type image/jpeg --local`, { stdio: "ignore" })
  console.log(`${f} → /img/${key}  (${Math.round(statSync(join(out, key)).size / 1024)} KB)`)
  vm.push(`docker cp /tmp/xj/${key} museum-map-web-1:/tmp/${key} && docker compose -f deploy/vm/docker-compose.yml exec -T web bunx wrangler r2 object put museum-images/${key} --file /tmp/${key} --content-type image/jpeg --local --persist-to /data/state`)
}
console.log("\n# VM (after scp -r " + out + "/* xian@VM:/tmp/xj/):\n" + vm.join("\n"))
```

- [ ] **Step 3:** Run it on the curated dir; check each printed size ≤ ~250 KB (re-run with `-s formatOptions 70` if larger). Fill `cover` and act `image` fields with the printed `src`, plus work/by/where/license/commons and an optional `focus`.
- [ ] **Step 4:** `bun test tests/threads.test.ts` → all PASS. Commit `content(xunji-mag): verified ancient art for 张骞 and 苏轼` + the script.

---

### Task 4: The reader

**Files:** Create `src/ui/components/xunji-reader.ts`; Modify `src/ui/components/xunji-panel.ts`, `src/ui/client/app.ts`, `src/ui/home.ts`, `src/ui/theme.ts`

- [ ] **Step 1: Bootstrap** — `home.ts`: import `ERA_ACCENTS`, add `eraAccents: ERA_ACCENTS` to the bootstrap; in `app.ts` init copy `this._eraAccents = data.eraAccents || {};`.

- [ ] **Step 2: Markup** — `src/ui/components/xunji-reader.ts`:

```ts
/** 循迹 杂志: the feature reader — cover, 导语, acts, then the existing end (快速回放 · 停站表 · 行程). */
export function XunjiReader(): string {
  return `<article class="xj-mag" :style="'--era:' + xunjiAccent()" @scroll.passive="xunjiOnScroll($event)">
  <div class="xj-strip" aria-hidden="true" @click="xunji.mini = true"></div>
  <header class="mag-cover">
    <img :src="xunji.thread.cover.src" :alt="xunji.thread.cover.work" :style="xunji.thread.cover.focus ? 'object-position:' + xunji.thread.cover.focus : ''" loading="eager" decoding="async">
    <div class="mag-cover-text">
      <div class="mag-kick" x-text="'循迹 · ' + xunjiEraName() + ' · ' + xunji.thread.span"></div>
      <h1 class="mag-title" x-text="xunji.thread.mag"></h1>
      <p class="mag-deck" x-text="xunji.thread.deck"></p>
    </div>
    <div class="mag-credit" x-text="xunjiCredit(xunji.thread.cover)"></div>
  </header>
  <p class="mag-opening" x-text="xunji.thread.opening"></p>
  <template x-for="(a, k) in xunji.thread.acts" :key="k">
    <section class="mag-act" :data-act="k">
      <div class="mag-act-head">
        <span class="mag-num" x-text="String(k + 1).padStart(2, '0')"></span>
        <span class="mag-seal" x-text="a.place"></span>
      </div>
      <h2 class="mag-act-title" x-text="a.title"></h2>
      <div class="mag-act-span" x-text="a.span"></div>
      <template x-for="(p, n) in a.body" :key="n">
        <div>
          <p class="mag-p" x-text="p"></p>
          <blockquote class="mag-quote" x-show="a.quote && n === 0"><span x-text="a.quote ? a.quote.text : ''"></span><cite x-text="a.quote ? a.quote.source : ''"></cite></blockquote>
        </div>
      </template>
      <figure class="mag-fig" x-show="a.image">
        <img :src="a.image ? a.image.src : ''" :alt="a.image ? a.image.work : ''" loading="lazy" decoding="async">
        <figcaption x-text="a.image ? xunjiCredit(a.image) : ''"></figcaption>
      </figure>
    </section>
  </template>
  <footer class="mag-end">
    <button class="xj-cta" @click="xunjiReplay()">▶ 快速回放这一路</button>
    <div class="mag-end-ticket" x-ref="xjTicket"></div>
  </footer>
</article>`
}
```

The end reuses the existing end card: in `xunji-panel.ts` render, for threads with `acts`, `XunjiReader()` in place of `.xj-tour`'s body when `xunji.reading` is true, and put the existing `endCard(true)` markup (timetable + CTA) inside `.mag-end` instead of the `x-ref` placeholder (import `endCard` from the same file — it is already a local function there; move `XunjiReader` into `xunji-panel.ts` if simpler, keeping it a separate function).

- [ ] **Step 3: State + methods** (`app.ts`, 循迹 block):

```js
    xunjiAccent() { var t = this.xunji.thread; return (t && this._eraAccents && this._eraAccents[t.era]) || 'var(--gilt)'; },
    xunjiEraName() { var t = this.xunji.thread, d = t && this.dynastyById(t.era); return d ? this.dynastyShortName(d).replace(/[：:].*$/, '').replace(/（.*$/, '') : ''; },
    xunjiCredit(im) { return im ? [im.work, im.by, im.where, im.license].filter(Boolean).join(' · ') : ''; },
    /** The act in view lights its stops on the map. */
    xunjiOnScroll(e) {
      var el = e.target, acts = el.querySelectorAll('.mag-act'), mid = el.getBoundingClientRect().top + el.clientHeight * 0.35, k = -1;
      Array.prototype.forEach.call(acts, function(s, i){ if (s.getBoundingClientRect().top <= mid) k = i; });
      if (k === this.xunji.act) return;
      this.xunji.act = k;
      this.xunjiDrawAct();
    },
    xunjiDrawAct() {
      var t = this.xunji.thread, M = window.MuseumMap; if (!t || !M) return;
      if (this.xunji.act < 0) { M.setThreadRoute(t.stops, -1); M.setThreadSegment(null); M.fitThread(t.stops, this.xunjiPad()); return; }
      var a = t.acts[this.xunji.act], seg = t.stops.slice(a.stops[0], a.stops[1] + 1);
      M.setThreadRoute(t.stops, a.stops[1]);
      M.setThreadSegment(seg);
      M.fitThread(seg.length > 1 ? seg : [seg[0], seg[0]], this.xunjiPad());
    },
    xunjiReplay() { this.xunji.reading = false; this.xunji.ended = false; this.xunjiGo(0); this.xunjiPlay(); },
```

`xunji` state gains `reading: false, act: -1`. In `openThread`: `this.xunji.reading = !!t.acts; this.xunji.act = -1;` and when reading, skip `xunjiPlay()` (no autoplay — the cover is the start); play the era note once on open (`window.EraSynth && EraSynth.note(t.era, 5)`) only when opened by a tap (`opts.play`). After render, `this.$nextTick(() => this.xunjiDrawAct())`. For `#/x/<id>/<n>` with acts: after render, scroll the act containing stop `n-1` into view (`el.querySelector('[data-act="k"]').scrollIntoView()`).

`xunjiPad()` for the reader: on phones the reader covers the screen below the strip, so pad.bottom = innerHeight − strip bottom; on desktop pad.left = reader width (reader sits left). Add a `reading` branch to `xunjiPad`:

```js
      if (this.xunji.reading) {
        var mag = document.querySelector('.xj-mag'), strip = document.querySelector('.xj-strip');
        if (window.innerWidth > 920 && mag) pad.left = Math.round(mag.getBoundingClientRect().right - cr.left);
        else if (strip) { var sr = strip.getBoundingClientRect(); pad.top = Math.max(0, Math.round(sr.top - cr.top)); pad.bottom = Math.max(0, Math.round(cr.bottom - sr.bottom)); }
        return pad;
      }
```

(insert after `cr` is computed).

- [ ] **Step 4: CSS** (`theme.ts`): reader is the panel's content; when `xunji.reading` the panel class `is-reading` makes it full-height on phones (`top: 0; height: 100dvh; border-radius: 0`) and a left column on desktop (`left: 16px; right: auto; width: min(560px, 45vw)`). The `.xj-strip` is a transparent 140 px window at the top of the article on phones (`position: sticky; top: 0; height: 140px; background: transparent; pointer-events: auto`), hidden on desktop; the article background starts below it (`.mag-cover` margin-top 0; the panel itself transparent above the strip — set `.xunji-panel.is-reading { background: transparent }` and give `.xj-mag > *:not(.xj-strip)` the surface background). Typography:

```css
.xj-mag { height: 100%; overflow-y: auto; overscroll-behavior: contain; --era: var(--gilt); }
.mag-cover { position: relative; min-height: 72dvh; display: flex; align-items: flex-end; background: #000; overflow: hidden; }
.mag-cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .78; }
.mag-cover-text { position: relative; padding: 0 22px 46px; }
.mag-kick { font-family: var(--mono); font-size: 10px; letter-spacing: .3em; color: var(--era); }
.mag-title { font-family: var(--serif); font-size: clamp(56px, 16vw, 88px); line-height: 1; margin: 10px 0 8px; letter-spacing: .04em; font-weight: 500; }
.mag-deck { font-size: 15px; line-height: 1.75; color: rgba(var(--fg-rgb), .9); margin: 0; max-width: 30em; }
.mag-credit { position: absolute; left: 22px; right: 22px; bottom: 12px; font-family: var(--mono); font-size: 9.5px; color: rgba(var(--fg-rgb), .55); }
.mag-opening { padding: 28px 22px 8px; font-size: 16px; line-height: 2; color: var(--text); background: var(--surface); margin: 0; }
.mag-opening::first-letter { float: left; font-size: 52px; line-height: 1; margin: 6px 8px 0 0; color: var(--era); font-family: var(--serif); }
.mag-act { padding: 34px 22px 10px; background: var(--surface); overflow-wrap: anywhere; }
.mag-act-head { display: flex; align-items: center; gap: 12px; }
.mag-num { font-family: var(--mono); font-size: 40px; line-height: 1; color: var(--era); }
.mag-seal { font-size: 12px; padding: 3px 6px; border: 1.5px solid var(--seal); color: var(--seal-ink-strong); border-radius: 3px; letter-spacing: .1em; }
.mag-act-title { font-family: var(--serif); font-size: 24px; margin: 10px 0 2px; font-weight: 500; }
.mag-act-span { font-family: var(--mono); font-size: 10.5px; color: var(--text-3); letter-spacing: .12em; }
.mag-p { font-size: 15px; line-height: 2; color: var(--text-2); margin: 14px 0 0; }
.mag-quote { margin: 22px 0 6px; padding: 14px 0; border-top: 1px solid color-mix(in srgb, var(--era) 55%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--era) 55%, transparent); text-align: center; }
.mag-quote span { display: block; font-family: var(--serif); font-size: 21px; line-height: 1.6; color: var(--gilt-hi); letter-spacing: .06em; }
.mag-quote cite { display: block; margin-top: 6px; font-style: normal; font-size: 11px; color: var(--text-3); }
.mag-fig { margin: 22px -22px 0; }
.mag-fig img { width: 100%; display: block; }
.mag-fig figcaption { padding: 6px 22px 0; font-family: var(--mono); font-size: 9.5px; color: var(--text-3); line-height: 1.5; }
.mag-end { padding: 30px 22px calc(30px + env(safe-area-inset-bottom)); background: var(--surface); }
```

Check every variable exists (`--serif`, `--seal`, `--seal-ink-strong`, `--fg-rgb`); `color-mix` fallback: also set a plain border colour before it.

- [ ] **Step 5: Verify** — typecheck; targeted tests; serve and grep the page for `xj-mag`, `mag-cover`, `xunjiOnScroll`; `node --check` all inline scripts; curl one `/img/xj-…` key locally → 200 image/jpeg. Commit `feat(xunji-mag): the feature reader — cover, 导语, acts; the map follows the act you're reading`.

---

### Task 5: The shelf of covers

**Files:** Modify `src/ui/components/xunji-panel.ts`, `src/ui/theme.ts`

- [ ] In the picker, a thread with `cover` renders as:

```html
<button type="button" class="xj-cover-card" @click="openThread(t.id, 0, { play: true })" :style="'--era:' + (_eraAccents[t.era] || 'var(--gilt)')">
  <img :src="t.cover.src" alt="" loading="lazy" decoding="async" :style="t.cover.focus ? 'object-position:' + t.cover.focus : ''">
  <span class="cc-mag" x-text="t.mag"></span>
  <span class="cc-meta" x-text="t.who + ' · ' + t.span"></span>
  <span class="cc-deck" x-text="t.deck"></span>
</button>
```

(use `x-if="t.cover"` / `x-if="!t.cover"` around the new and the existing card). CSS: card 100% wide, 180 px tall, image object-fit cover with a bottom gradient, `cc-mag` 34 px serif in white, `cc-meta` mono small in `var(--era)`, `cc-deck` 12.5 px two lines clamp.
- [ ] Verify as in Task 4; commit `feat(xunji-mag): the 循迹 shelf — threads with a magazine show their cover`.

---

### Task 6: Verify and deploy

- [ ] Full suite: only baseline failures. `bun run restore -- --target=local --confirm`.
- [ ] Ask the user before deploying. On approval: merge `feat/xunji-mag` → main, push; on the VM back up state, `git pull --ff-only`, rebuild; copy the `out/` images to the VM and run the printed R2 commands; verify each `/img/xj-…` returns 200 on the live host and the page contains `xj-mag`.
- [ ] Hand the user the pilot for review (writing + look) before Phase 2.
