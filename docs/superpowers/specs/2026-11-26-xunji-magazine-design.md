# 循迹 · 杂志专题 — design

2026-11-26 · status: approved in brainstorming, awaiting spec review · builds on `2026-11-26-xunji-design.md`

## Why

A thread only matters if the 迹 itself pulls you in — the history, the memory across time. Today a
stop is a ≤120 字 caption in a 2 s tour. Each thread becomes a **magazine feature** you want to read:
cover, opening, acts written as scenes, real ancient images, art-directed layout — then the
existing 快速回放 / 停站表 / 变成行程 loop.

Voice: young adults, emotional value, never parent/child. 鼓舞 ≠ 编造.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Form | A — open the magazine, then travel: full-screen reader (cover → 导语 → acts), map follows reading |
| Style | A · 封面杂志 (Kinfolk-like), with the period carried by details: real ancient art, era accent colour, 朱印 chapter seals, 古籍-style quotes, era instrument on the cover |
| Chapters | by **act** (4–6 per thread, a real turn of the story), stops nested in acts |
| Images | verified public-domain artworks only, self-hosted, full credit; typographic opener when none fits |
| Phone map | slim sticky map strip at the top following the act in view; tap → full map |
| Rollout | pilot 张骞 + 苏轼 first, user reviews writing + look, then the other six |

## 1. Content model (extends `src/data/threads.ts`)

```ts
export interface ThreadImage {
  src: string          // /img/xj-<thread>-<slug>-<sha16>.jpg (R2, served by /img/:hash)
  work: string         // 《张骞出使西域图》
  by: string           // 唐 · 佚名 / 元 · 赵孟頫
  where: string        // 敦煌莫高窟第 323 窟 / 台北故宫博物院
  license: string      // 公有领域 / CC BY-SA 4.0 …
  commons?: string     // source page for verification
  focus?: string       // CSS object-position for the crop, e.g. "60% 40%"
}
export interface ThreadAct {
  title: string        // 2–6 字, e.g. 应募
  place: string        // 长安
  span: string         // 前138
  stops: [number, number]   // inclusive range of stop indexes this act covers
  body: string[]       // paragraphs, total 280–420 字, scene-led
  quote?: { text: string; source: string }   // 原文 pull quote, exact
  image?: ThreadImage
  source: string       // for fact-checking (not shown)
}
// Thread gains:
//   cover: ThreadImage; mag: string (2–4 字 magazine title: 凿空 / 东坡 …);
//   deck: string (≤ 40 字); opening: string (导语, 150–240 字); acts: ThreadAct[]
// All new fields optional on the type until every thread has them; the reader falls back to the
// existing stop-based card UI for threads without `acts`.
```

Rules (enforced by `tests/threads.test.ts` for threads that have `acts`):
- acts cover all stops exactly once, in order (act k+1 starts at act k's end + 1; first starts at 0, last ends at n−1);
- 4–6 acts; body 280–420 字 per act; opening 150–240 字; deck ≤ 40 字; mag 2–4 字;
- every `quote.text` non-empty with a `source`; poem threads' quotes that are lines of the poem must be exact substrings;
- every image has src matching `/img/xj-…`, work, by, where, license.
- Images: each candidate is downloaded, **viewed**, and only used if it is the stated work and clean
  (no watermarks, e.g. the 百度百科-watermarked 辋川图 copy is rejected). Prefer museum sources
  (Palace Museum, NPM Taipei, Met, AIC, Mogao) via Wikimedia Commons; record `commons`.

## 2. Reader

- Opening a thread (picker card, deep link, back-link) opens the **reader**; the 2 s tour moves
  behind a 「快速回放」 button. State: `xunji.reading` (bool), current act from scroll.
- **Cover**: full-bleed `cover` image (object-fit cover, `focus`), kicker (循迹 · 朝代), `mag`
  title large serif, `deck`, credit in small mono at the bottom; plays the era note on open (the
  opening tap is the gesture).
- **导语**: drop cap, wide leading.
- **Acts**: big numeral (01…), a small 朱印 seal with `place`, title, `span`; body paragraphs; the
  pull quote between paragraphs (rules above/below, 原文 in a larger face, source below);
  `image` full-width with credit caption; without an image the act opens typographically.
- **Era accent**: `--era` CSS variable per thread era (from the strata palette in strata.ts / theme),
  used for numerals, seals, rules, the map strip route.
- **End**: 「快速回放」 (existing tour), 停站表 (existing), 「变成行程，看沿途 N 座馆」, 听原曲 where available.
- **Map sync**: an IntersectionObserver marks the act in view; the map draws the whole route faint
  and the act's stop range lit (`MuseumMap.setThreadRoute` + `setThreadSegment`), framed with the
  reader's padding.
- **Phone**: reader full-screen over the map; a sticky map strip (≈ 140 px) at the top shows the
  live map behind (the reader starts below it; the strip is a transparent window, so the real
  Leaflet map shows through and follows). Tapping the strip collapses the reader to its title bar
  (existing sheet mini) to see the full map; tapping the bar returns.
- **Desktop**: reader column (min(560px, 45vw)) on the left over the map, map visible right.
- Hash: `#/x/<id>` opens the reader at the cover; `#/x/<id>/<n>` scrolls to the act containing
  stop n.
- Threads without `acts` keep today's UI (picker card → tour) until written.

## 3. Picker

The 循迹 list becomes a shelf of covers: per thread a card with the cover image (cropped), `mag`
title, who · span, `deck`. Threads without `cover` keep the text card.

## 4. Pilot then rollout

- **Phase 1 (pilot)**: 张骞 (`zhangqian`) and 苏轼 (`sushi`) — content (opening, acts, quotes,
  images), the reader, the picker shelf. Fact-check pass. User reviews on the live site.
- **Phase 2**: the other six threads, adjusted by the pilot feedback; each fact-checked.

## 5. Testing

- Data tests above; image keys resolve (`/img/` objects uploaded locally + prod before deploy).
- Typecheck, targeted tests, served-script `node --check`, curl checks.
- Phone checklist: cover loads fast (images ≤ ~250 KB, 1200 px max), reading scroll smooth,
  map strip follows acts, collapse/expand, 快速回放, 停站表 → 行程, deep links.

## Out of scope

Audio narration, user comments, more threads beyond the 8, print/PDF export.
