# Phase B.2 — Plan 01: R2 bucket + image proxy route

**Files:**
- Modify: `wrangler.toml`
- Modify: `src/index.ts` (Env type)
- Create: `src/routes/image-proxy.ts`
- Modify: `src/index.ts` (mount route)
- Create: `tests/image-proxy.test.ts`

This plan creates the R2 bucket, wires the binding, and adds the read-only `GET /img/:hash` route. After this plan the system can serve images out of R2 — but R2 is empty until plan 05 populates it.

---

## Task 1: Create R2 bucket

- [ ] **Step 1: Create the R2 bucket via wrangler**

```bash
bunx wrangler r2 bucket create museum-images
```

Expected: `Created bucket 'museum-images' with default storage class set to Standard.` (or "Bucket 'museum-images' already exists" — both are fine).

- [ ] **Step 2: Verify bucket exists**

```bash
bunx wrangler r2 bucket list | grep museum-images
```

Expected: line containing `museum-images`.

- [ ] **Step 3: Add binding to `wrangler.toml`**

Append after the `[[kv_namespaces]]` block:

```toml
[[r2_buckets]]
binding = "IMAGES"
bucket_name = "museum-images"
```

- [ ] **Step 4: Commit**

```bash
git add wrangler.toml
git commit -m "feat(r2): add IMAGES bucket binding for museum-images"
```

---

## Task 2: Add IMAGES to Env type

- [ ] **Step 1: Edit `src/index.ts` `Env` interface**

Add `IMAGES: R2Bucket` after `RATE: KVNamespace`:

```ts
export interface Env {
  DB: D1Database
  RATE: KVNamespace
  IMAGES: R2Bucket
  RATE_PER_MIN?: string
  // ...rest unchanged
}
```

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

Expected: passes (the local-env shim and tests will be updated in subsequent steps if anything breaks).

- [ ] **Step 3: Fix any local-env shim**

Open `src/local/` (if a D1/KV REST shim exposes Env). Search for an existing `Env` literal:

```bash
grep -rn "RATE:" src/local 2>/dev/null
```

If a shim object literally constructs an Env, add a stub `IMAGES: undefined as any as R2Bucket` (script does not need real R2 in REST mode).

- [ ] **Step 4: Commit**

```bash
git add src/index.ts src/local 2>/dev/null
git commit -m "feat(env): add IMAGES R2Bucket to Env"
```

---

## Task 3: Write failing test for `/img/:hash`

- [ ] **Step 1: Create `tests/image-proxy.test.ts`**

```ts
import { describe, it, expect, beforeAll } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

describe("GET /img/:hash", () => {
  let mf: Miniflare
  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {}",
      r2Buckets: ["IMAGES"],
      d1Databases: ["DB"],
      kvNamespaces: ["RATE"],
    })
    const bucket = await mf.getR2Bucket("IMAGES")
    await bucket.put("abc123.jpg", new Uint8Array([1, 2, 3, 4]), {
      httpMetadata: { contentType: "image/jpeg" },
    })
  })

  it("serves an existing object", async () => {
    const env = {
      DB: await mf.getD1Database("DB"),
      RATE: await mf.getKVNamespace("RATE"),
      IMAGES: await mf.getR2Bucket("IMAGES"),
    } as any
    const res = await createApp(env).handle(new Request("http://x/img/abc123.jpg"))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/jpeg")
    expect(res.headers.get("cache-control")).toContain("immutable")
    const body = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(body)).toEqual([1, 2, 3, 4])
  })

  it("returns 404 for missing object", async () => {
    const env = {
      DB: await mf.getD1Database("DB"),
      RATE: await mf.getKVNamespace("RATE"),
      IMAGES: await mf.getR2Bucket("IMAGES"),
    } as any
    const res = await createApp(env).handle(new Request("http://x/img/nope.jpg"))
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun test tests/image-proxy.test.ts
```

Expected: FAIL — route not registered yet (404 on the existing object too, or a 200/404 mismatch).

---

## Task 4: Implement the route

- [ ] **Step 1: Create `src/routes/image-proxy.ts`**

```ts
import { Elysia } from "elysia"
import type { Env } from "~/index"

interface RouteContext {
  env: Env
  params: { hash: string }
  set: { status?: number; headers: Record<string, string> }
}

export const imageProxyRoute = new Elysia().get("/img/:hash", async (ctx) => {
  const { env, params, set } = ctx as unknown as RouteContext
  const key = params.hash
  if (!/^[a-zA-Z0-9._-]{1,128}$/.test(key)) {
    set.status = 400
    return "bad key"
  }
  const obj = await env.IMAGES.get(key)
  if (!obj) {
    set.status = 404
    return "not found"
  }
  set.headers["content-type"] = obj.httpMetadata?.contentType ?? "image/jpeg"
  set.headers["cache-control"] = "public, max-age=31536000, immutable"
  if (obj.etag) set.headers["etag"] = obj.etag
  return obj.body
})
```

- [ ] **Step 2: Mount in `src/index.ts`**

Add the import next to the others:

```ts
import { imageProxyRoute } from "~/routes/image-proxy"
```

And in `createApp`, add `.use(imageProxyRoute)` after `.use(cdnRoute)` (so it's grouped with static-asset-style routes):

```ts
    .use(cdnRoute)
    .use(imageProxyRoute)
    .use(homeRoute)
```

- [ ] **Step 3: Run the test to verify it passes**

```bash
bun test tests/image-proxy.test.ts
```

Expected: both tests PASS.

- [ ] **Step 4: Run typecheck + full test suite**

```bash
bun run typecheck && bun test
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/routes/image-proxy.ts src/index.ts tests/image-proxy.test.ts
git commit -m "feat(routes): GET /img/:hash serves objects from R2 IMAGES bucket"
```

---

## Done when

- `bunx wrangler r2 bucket list` shows `museum-images`
- `wrangler.toml` declares the binding
- `bun test tests/image-proxy.test.ts` passes (both cases)
- `bun run typecheck` passes
