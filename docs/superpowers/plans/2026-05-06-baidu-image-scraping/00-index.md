# Phase B.2 — Baidu + Museum-site Image Scraping

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push artifact image coverage from 51.4% (294/572) to ≥80% by adding Baidu Baike + 5 museum-official-site scrapers, LLM-arbitrated candidate comparison, and R2 caching.

**Architecture:** A local Bun script orchestrates per-artifact candidate hunts (Baidu Baike + 5 museum-site adapters + existing Wikimedia URL), feeds candidates to a Haiku image-comparator agent, downloads the chosen image to R2, and writes a `/img/<hash>` URL back to D1. The Worker only serves the static `/img/:hash` route.

**Tech Stack:** Bun + TypeScript, Cloudflare Workers + R2 + D1, Elysia, Anthropic Haiku 4.5 vision via the existing copilot gateway, `cheerio` for HTML parsing.

**Spec:** [`docs/superpowers/specs/2026-05-06-baidu-museum-image-scraping-design.md`](../../specs/2026-05-06-baidu-museum-image-scraping-design.md)

---

## Plan files (execute in order)

| # | File | Topic |
|---|---|---|
| 1 | [01-r2-and-image-proxy.md](./01-r2-and-image-proxy.md) | R2 bucket creation, `IMAGES` binding, `GET /img/:hash` route |
| 2 | [02-baidu-baike-scraper.md](./02-baidu-baike-scraper.md) | `baidu-baike.ts` search + image extractor + tests |
| 3 | [03-museum-site-adapters.md](./03-museum-site-adapters.md) | 5 museum site adapters + registry + tests |
| 4 | [04-image-comparator.md](./04-image-comparator.md) | Haiku-based comparator agent that picks best candidate |
| 5 | [05-orchestrator-script.md](./05-orchestrator-script.md) | `scripts/scrape-images.ts` — local Bun orchestrator (with R2 + D1 writes) |
| 6 | [06-ui-and-rollout.md](./06-ui-and-rollout.md) | UI caption tweak, dry-run, single-museum live, full run, verification |

## Cross-cutting conventions

- **License values:** Wikimedia rows keep their existing license string. New rows from Baidu/museum sites use `"fair-use"`.
- **Attribution format for fair-use rows:** `来源：<source label> · <pageUrl>` (e.g. `来源：百度百科 · https://baike.baidu.com/item/...`).
- **R2 object key:** `sha256(originalUrl).slice(0, 16) + extFromContentTypeOrUrl` (e.g. `a3f9c2b1d8e4f7a0.jpg`).
- **`image_url` value stored in D1:** `/img/<r2_key>` (always starts with `/img/`).
- **field_provenance authority:** `encyclopedia` for Baidu/Wikimedia, `official` for museum sites.
- **Worker code stays read-only of R2** — all writes happen in the local script; the Worker never `put()`s to R2.

## Repo conventions to follow

- Tests use `bun:test` (`describe`/`it`/`expect`) + miniflare 4 where D1/KV/R2 needed.
- `tests/fixtures/` for HTML fixtures captured from real pages (sanitize cookies/PII first).
- Use `cheerio` for HTML parsing (add to deps).
- Imports use `~/*` aliased to `src/*`.
- All HTTP requests for scraping accept an optional `fetcher?: typeof fetch` arg (so tests can stub).
- `bun test` and `bun run typecheck` must pass before each commit.
