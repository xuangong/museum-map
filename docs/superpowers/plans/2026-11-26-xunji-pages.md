# 循迹 · 翻页的「刊」 (trial: 苏轼) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 苏轼「东坡」 as a paged magazine — cover, 目录, 6 chapters × 6–9 composed pages (opener / text+旁注 / image / quote / object / people / map), 尾页 — read by swiping, the map showing through map pages.

**Architecture:** `chapters?: ThreadChapter[]` with typed `ThreadPage`s in `src/data/threads.ts` (tests enforce structure and lengths); a paged reader (`xunji-pages.ts` component) chosen when a thread has `chapters`; scroll-snap pager with keyboard/edge navigation, page-driven map state; images via `scripts/thread-images.ts`.

**Spec:** `docs/superpowers/specs/2026-11-26-xunji-pages-design.md`

## Ground rules
Branch `feat/xunji-pages`; trailer `Co-Authored-By: Claude <noreply@anthropic.com>`; template-literal JS doubles backslashes; targeted tests only (baseline ~12 pre-existing failures); dev server `bunx wrangler dev --port 8787`; no browser automation; content in our own words, exact quotes, hedged disputes, young-adult voice, independent fact-check; images viewed before use.

### Task 1: Types and rules (controller)
- [ ] Add `ThreadPage` union and `ThreadChapter` (spec §Content model) and `chapters?` on `Thread`.
- [ ] Tests (`tests/threads.test.ts`, describe "paged features"): for threads with `chapters` — 5–7 chapters; stop ranges cover all stops in order; 6–9 pages, first `opener`, ≥1 `map`; text pages 180–380 字; object ≤ 300 字; quote text+source non-empty; people 2–4 with name/role/line; image pages fully credited incl. w/h and `/img/xj-` src; whole-thread text 5000–9000 字. Vacuous until content lands. Commit.

### Task 2: 苏轼 chapters (writer agent) — parallel with 3 and 4
- [ ] Write `chapters` for `sushi` (出川 · 西湖与明月 · 乌台 · 东坡 · 南迁 · 北归, stop ranges as in the existing acts). Each chapter: opener, 2–3 text pages (with 旁注 where a term needs it), quote page(s), object and/or people page, map page; image pages only with the 4 existing 苏轼 images (cover 寒食帖, 西湖图, 后赤壁赋图, 赵孟頫像) — the controller adds new image pages after Task 3. Reuse and deepen the fact-checked act text; add scenes, people, objects from standard sources. Keep `acts` in place (fallback). Tests green. Commit. Then independent fact-check → fixes commit.

### Task 3: More 苏轼 images (curator agent)
- [ ] Find 4–8 more verified public-domain works for the chapters (眉山/三苏, 汴京, 杭州/西湖, 密州, 乌台, 黄州/赤壁, 惠州, 儋州, 金山/常州; e.g. 东坡笠屐图, 武元直《赤壁图》, 苏轼书迹 like 《前赤壁赋》卷 / 《人来得书帖》, 宋人 画 of 西湖, 清明上河图 detail for 汴京). Download, view, reject mismatches/watermarks/copyrighted; process with `scripts/thread-images.ts` (local R2), write `/tmp/xj-img/pages/manifest.json` (thread, chapter, work, by, where, license, commons, src, w, h, note). Do not edit threads.ts. Commit nothing but notes.

### Task 4: Paged reader (UI agent)
- [ ] New `src/ui/components/xunji-pages.ts` rendering cover, 目录, pages by kind, 尾页 (reuse panel `endCard(true)`), folio; wired in `xunji-panel.ts` when `xunji.thread.chapters`; app.ts state `xunji.paged`, `xunji.page`, page count/flattening helper, scroll-snap listener (rAF) → current page → chapter → map (`setThreadRoute`, `setThreadSegment`, `fitThread` with padding; map pages transparent); keyboard ←/→, edge taps, ☰ 目录; deep links `#/x/<id>/p<n>` and `#/x/<id>/<stop>`; phone full height below `--xj-top`, tuck/expand keeps page; desktop column + map. CSS per page kind (see mockup in spec discussion: opener big numeral + seal, text with margin note column, full-bleed image with gradient caption, vertical quote, object, people list with monogram avatars, transparent map page with a caption box). Threads with only `acts` keep the scrolling reader. Verify (typecheck, targeted tests, served-page grep, node --check). Commit.

### Task 5: Integrate, review, deploy
- [ ] Controller adds image pages from Task 3 manifest; tests green.
- [ ] Code review of Task 4 with real content; fixes.
- [ ] Full suite = baseline; restore local DB; ask the user before deploy; merge, VM backup, pull, rebuild, upload new images to VM R2, verify `/img/` keys live.
