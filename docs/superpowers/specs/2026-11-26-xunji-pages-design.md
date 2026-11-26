# 循迹 · 翻页的「刊」 — design

2026-11-26 · status: approved in conversation · supersedes the scrolling reader of
`2026-11-26-xunji-magazine-design.md` for threads that carry `chapters`

## Why

User feedback on the live pilot: the vertical scroll doesn't feel like a magazine, and ~300 字 per
act is "匆匆过客" — the history is rich and should unfold. A feature becomes a **paged magazine**:
cover → 目录 → 6 chapters × 6–14 composed pages → 尾页. Each page is one screen with its own layout.

Trial: **苏轼「东坡」 only**, end to end. 张骞 keeps the scrolling reader until 苏轼 is approved;
the other six threads keep the tour UI.

## Content model (`src/data/threads.ts`)

```ts
export type ThreadPage =
  | { kind: "opener"; num: string; place: string; span: string; line: string }          // 章扉页
  | { kind: "text"; paras: string[]; note?: { term: string; text: string } }             // 正文 (+旁注)
  | { kind: "image"; image: ThreadImage; caption: string }                               // 整页图
  | { kind: "quote"; text: string; source: string; vertical?: boolean }                  // 引语页
  | { kind: "object"; kicker: string; title: string; paras: string[]; image?: ThreadImage } // 物件特写
  | { kind: "people"; title: string; people: { name: string; role: string; line: string }[] } // 人物页
  | { kind: "map"; text: string }                                                         // 地图页
export interface ThreadChapter {
  title: string; place: string; span: string
  stops: [number, number]     // inclusive stop range, chapters cover all stops in order
  pages: ThreadPage[]         // 6–11, first is an opener, at least one map page
  source: string
}
// Thread gains `chapters?: ThreadChapter[]` (and keeps mag/deck/cover). When `chapters` is present
// the paged reader is used; `opening` becomes the 目录 page's 导语.
```

Rules (tests): chapters 5–7; cover all stops in order; 6–14 pages each, first `opener`, ≥1 `map`;
text pages 120–220 字 total paras (one phone screen: ~10 lines × ~21 字); object pages ≤ 220 字; quotes exact with source; people 2–4 with
name/role/line; images fully credited with w/h; total thread text 5000–9000 字.

Writing: scene-led, concrete, our own words, standard sources, hedged disputes, exact 原文, young
adult voice. Independent fact-check before release. New images: verified public-domain art, viewed
before use, uploaded with `scripts/thread-images.ts`.

## Reader

- Horizontal pager: a flex row of full-panel pages with `scroll-snap-type: x mandatory`;
  swipe on phones, ←/→ keys and edge taps on desktop. Page order: cover, 目录, chapters' pages,
  尾页 (existing end card: 快速回放 · 停站表 · 变成行程).
- Folio on every page: `东坡 · 肆` and `n / N`.
- 目录 page lists chapters (num, title, place, span) and jumps to their openers; a ☰ button
  on every page re-opens it.
- Map: hidden behind opaque pages; `map` pages are transparent so the live Leaflet map shows,
  with the chapter's stops lit (`setThreadRoute` + `setThreadSegment` + `fitThread` with the
  page's padding). Turning onto any page of a chapter updates the route state.
- Phone: full height below the topbar/timeline (`--xj-top`), tuck to bar as today.
  Desktop: a 420–520 px page column on the left, map visible on the right (map pages show the
  map behind the column too).
- Deep link `#/x/sushi/p<n>` opens page n; `#/x/sushi/<stop>` opens that stop's chapter opener.
- Threads with `acts` but no `chapters` keep the scrolling reader; without either, the tour.

## Testing

Data tests above; typecheck; served-script `node --check`; phone checklist: swipe feel and snap,
each page type's layout on a small phone, map pages show the route, 目录 jumps, deep links,
end page → 行程.
