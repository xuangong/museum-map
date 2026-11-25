import { describe, it, expect } from "bun:test"
import { assetsRoute, THREADS_SRC } from "~/routes/assets"
import { THREADS } from "~/data/threads"

describe("/assets/threads.json", () => {
  it("serves the threads, immutable-cached, under a content-hashed URL", async () => {
    expect(THREADS_SRC).toMatch(/^\/assets\/threads\.json\?v=[0-9a-z]+$/)
    const res = await assetsRoute.handle(new Request("http://localhost/assets/threads.json"))
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("immutable")
    expect(((await res.json()) as unknown[]).length).toBe(THREADS.length)
  })
})
