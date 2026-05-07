# Phase B.2 — Plan 06: UI tweak + rollout + verification

**Files:**
- Modify: `src/ui/client/app.ts` (caption rendering)
- (No new tests — UI tweak is small and visually verified)

After this plan, fair-use captions render cleanly without the license suffix, the script has been live-tested on one museum, and the full 94-museum run is complete with reported coverage.

---

## Task 1: UI caption tweak

- [ ] **Step 1: Locate caption render**

```bash
grep -n "image_attribution\|imageAttribution\|artifact-image-caption" src/ui src/routes -r
```

Note the file and line number where the artifact's `imageAttribution` + `imageLicense` strings get concatenated into the caption div.

- [ ] **Step 2: Edit the renderer**

The current rendering likely concatenates `attribution + " · " + license`. For fair-use rows the attribution string already contains the source label and URL, so the license suffix is redundant. Change the logic to:

```ts
const attribution = a.imageAttribution ?? ""
const license = a.imageLicense ?? ""
const caption =
  license === "fair-use"
    ? attribution                                    // "来源：百度百科 · https://..."
    : (attribution && license ? `${attribution} · ${license}` : (attribution || license))
```

Apply this edit at the line(s) found in step 1.

- [ ] **Step 3: Run tests + typecheck**

```bash
bun test && bun run typecheck
```

Expected: all green.

- [ ] **Step 4: Commit + deploy**

```bash
git add src/ui/client/app.ts
git commit -m "feat(ui): omit redundant 'fair-use' suffix in artifact image caption"
bunx wrangler deploy
```

---

## Task 2: Single-museum live test

- [ ] **Step 1: Pick one of the museum-site-adapter museums**

Pick the museum ID from `src/services/museum-sites/index.ts` (e.g. the gugong ID). Confirm it currently has missing-image artifacts:

```bash
curl -sS "https://museum.xianliao.de5.net/api/museums/<ID>" \
  | jq '[.artifacts[] | {name, image}] | map(select(.image == null)) | length'
```

Expected: ≥1 (otherwise pick a different museum).

- [ ] **Step 2: Run scrape-images live**

```bash
ADMIN_TOKEN=$ADMIN_TOKEN \
  COPILOT_GATEWAY_URL=$COPILOT_GATEWAY_URL \
  COPILOT_GATEWAY_KEY=$COPILOT_GATEWAY_KEY \
  bun run scrape-images -- --museum=<ID> --concurrency=2
```

Expected: per-artifact log lines, finishing with `+N new` summary, no `r2 put failed` or `admin endpoint 401` errors.

- [ ] **Step 3: Verify R2 + D1 + image route**

```bash
# pick one new image_url from the API
url=$(curl -sS "https://museum.xianliao.de5.net/api/museums/<ID>" \
  | jq -r '.artifacts[] | select(.imageLicense=="fair-use") | .image' | head -1)
echo "Got: $url"
curl -sI "https://museum.xianliao.de5.net$url" | head -5
```

Expected: HTTP/2 200, content-type image/*, cache-control includes immutable.

- [ ] **Step 4: Manual UI check**

Open the museum drawer in a browser, confirm:
- The image renders.
- Caption shows `来源：<source> · <pageUrl>` (no `· fair-use` suffix).
- No console errors.

- [ ] **Step 5: If all good, document the test in commit message** (no code change needed, just record):

```bash
git commit --allow-empty -m "test(rollout): scrape-images live on <museum> — N images persisted"
```

---

## Task 3: Full 94-museum run

- [ ] **Step 1: Compute baseline coverage**

```bash
ids=$(curl -sS "https://museum.xianliao.de5.net/api/museums" --max-time 30 | jq -r '.[].id')
total=0; with=0
for id in $ids; do
  resp=$(curl -sS "https://museum.xianliao.de5.net/api/museums/$id" --max-time 20)
  t=$(echo "$resp" | jq '[.artifacts[]?] | length')
  w=$(echo "$resp" | jq '[.artifacts[]? | select(.image)] | length')
  total=$((total+t)); with=$((with+w))
done
echo "Baseline: $with/$total ($(awk "BEGIN{printf \"%.1f\", $with*100/$total}")%)"
```

Record the baseline (expected ~51.4%).

- [ ] **Step 2: Run full scrape**

```bash
ADMIN_TOKEN=$ADMIN_TOKEN \
  COPILOT_GATEWAY_URL=$COPILOT_GATEWAY_URL \
  COPILOT_GATEWAY_KEY=$COPILOT_GATEWAY_KEY \
  bun run scrape-images -- --all --concurrency=4 2>&1 | tee /tmp/scrape-all.log
```

Expected: runs to completion (~30-60 min depending on network). Final line: `DONE: +N new across <T> artifacts`.

- [ ] **Step 3: Compute final coverage**

Re-run the script from Step 1, record the final coverage. Target ≥80%.

- [ ] **Step 4: Spot-check 10 fair-use captions in browser**

Open 10 random museums in browser, verify captions look correct and images load.

- [ ] **Step 5: Commit run summary**

```bash
git commit --allow-empty -m "test(rollout): full scrape-images run — coverage <X>% → <Y>%

See /tmp/scrape-all.log"
```

---

## Task 4: Add a README/CLAUDE.md note

- [ ] **Step 1: Append to `CLAUDE.md`** (or wherever the workflow notes live):

```markdown
## Image scraping (Phase B.2)

- `bun run scrape-images -- --museum=<id> --dry-run` for testing
- `bun run scrape-images -- --all --concurrency=4` for the whole catalog
- License handling: Wikimedia rows keep their original CC license; Baidu/官网 rows get `image_license="fair-use"` and an attribution string of the form `来源：<source> · <pageUrl>`
- Images are cached to R2 (`museum-images` bucket) and served via `/img/:hash`
- The Worker never writes to R2; only the local `scrape-images` script does
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: image scraping pipeline notes"
```

---

## Rollback

If something is wrong with a swept image:
- Revert just one artifact: `bun run scrape-images -- --museum=<id> --force` after editing source code locally to skip the bad source
- Wipe all fair-use rows: `wrangler d1 execute museum-map-db --command="UPDATE museum_artifacts SET image_url=NULL, image_license=NULL, image_attribution=NULL WHERE image_license='fair-use'"`
- Wipe R2 bucket: `bunx wrangler r2 bucket delete museum-images --confirm` then re-create

---

## Done when

- `wrangler deploy` succeeded after Task 1
- A live single-museum scrape produced visible images
- A full `--all` run completed without fatal errors
- Final coverage ≥ 80% (or recorded reason for falling short)
- CLAUDE.md notes added
