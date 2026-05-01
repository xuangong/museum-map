import { describe, it, expect } from "bun:test"
import { getClientIp } from "~/lib/getClientIp"

describe("getClientIp", () => {
  it("prefers cf.connectingIp when present (Worker mode)", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "9.9.9.9" } })
    ;(req as any).cf = { connectingIp: "1.2.3.4" }
    expect(getClientIp(req)).toBe("1.2.3.4")
  })

  it("falls back to x-forwarded-for when cf missing (Bun mode)", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "5.6.7.8" } })
    expect(getClientIp(req)).toBe("5.6.7.8")
  })

  it("uses first IP in x-forwarded-for chain", () => {
    const req = new Request("http://x/", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" } })
    expect(getClientIp(req)).toBe("1.1.1.1")
  })

  it("returns 127.0.0.1 when nothing available", () => {
    const req = new Request("http://x/")
    expect(getClientIp(req)).toBe("127.0.0.1")
  })
})
