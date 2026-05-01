import { describe, it, expect, beforeEach } from "bun:test"
import { checkAndIncrement, bucketKey } from "~/lib/rateLimit"

class MemKV {
  store = new Map<string, { v: string; exp: number | null }>()
  async get(key: string): Promise<string | null> {
    const e = this.store.get(key)
    if (!e) return null
    if (e.exp && Date.now() / 1000 > e.exp) {
      this.store.delete(key)
      return null
    }
    return e.v
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> {
    const exp = opts?.expirationTtl ? Date.now() / 1000 + opts.expirationTtl : null
    this.store.set(key, { v: String(value), exp })
  }
}

describe("rateLimit", () => {
  let kv: MemKV
  beforeEach(() => {
    kv = new MemKV()
  })

  it("allows under limit and increments count", async () => {
    const r1 = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r1.ok).toBe(true)
    expect(r1.count).toBe(1)
    const r2 = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r2.ok).toBe(true)
    expect(r2.count).toBe(2)
    const r3 = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r3.ok).toBe(true)
    expect(r3.count).toBe(3)
  })

  it("denies when over limit", async () => {
    for (let i = 0; i < 3; i++) await checkAndIncrement(kv as any, "k", 3, 60)
    const r = await checkAndIncrement(kv as any, "k", 3, 60)
    expect(r.ok).toBe(false)
  })

  it("bucketKey format includes ip and time bucket", () => {
    const d = new Date(Date.UTC(2026, 3, 30, 12, 34))
    expect(bucketKey("min", "1.2.3.4", d)).toBe("rate:ip:1.2.3.4:min:202604301234")
    expect(bucketKey("day", "1.2.3.4", d)).toBe("rate:ip:1.2.3.4:day:20260430")
    expect(bucketKey("global-day", null, d)).toBe("rate:global:day:20260430")
  })
})

import { runRateLimits } from "~/services/chat"

describe("runRateLimits (per-IP min/day + global day)", () => {
  it("12 serial calls in same minute: at least one denied (best-effort)", async () => {
    const kv = new MemKV()
    let denied = 0
    let earlyOk = 0
    for (let i = 0; i < 12; i++) {
      const r = await runRateLimits(kv as any, "1.1.1.1", { perMin: 10, perDay: 100, globalPerDay: 5000 })
      if (!r.ok) denied++
      else if (i < 9) earlyOk++
    }
    expect(denied).toBeGreaterThanOrEqual(1)
    expect(earlyOk).toBe(9)
  })

  it("110 serial calls in one day: last 5 contain at least one 429", async () => {
    const kv = new MemKV()
    for (let i = 0; i < 105; i++) await runRateLimits(kv as any, "2.2.2.2", { perMin: 10000, perDay: 100, globalPerDay: 5000 })
    let denied = 0
    for (let i = 0; i < 5; i++) {
      const r = await runRateLimits(kv as any, "2.2.2.2", { perMin: 10000, perDay: 100, globalPerDay: 5000 })
      if (!r.ok && r.reason === "ip_day") denied++
    }
    expect(denied).toBeGreaterThanOrEqual(1)
  })

  it("global day limit triggers after 5000 distinct-IP serial calls", async () => {
    const kv = new MemKV()
    for (let i = 0; i < 4990; i++) await runRateLimits(kv as any, `ip-${i}`, { perMin: 10000, perDay: 10000, globalPerDay: 5000 })
    let glob = 0
    for (let i = 4990; i < 5020; i++) {
      const r = await runRateLimits(kv as any, `ip-${i}`, { perMin: 10000, perDay: 10000, globalPerDay: 5000 })
      if (!r.ok && r.reason === "global_day") glob++
    }
    expect(glob).toBeGreaterThanOrEqual(1)
  })
})
