import { describe, it, expect } from "bun:test"
import { parseCookies, serializeCookie } from "~/lib/cookies"

describe("parseCookies", () => {
  it("parses simple header", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" })
  })
  it("trims spaces around values", () => {
    expect(parseCookies("a = 1 ;  b=2")).toEqual({ a: "1", b: "2" })
  })
  it("handles empty / null", () => {
    expect(parseCookies(null)).toEqual({})
    expect(parseCookies("")).toEqual({})
  })
  it("decodes URL-encoded values", () => {
    expect(parseCookies("x=hello%20world")).toEqual({ x: "hello world" })
  })
})

describe("serializeCookie", () => {
  it("serializes with HttpOnly+Secure+SameSite", () => {
    const c = serializeCookie("sid", "abc", {
      httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 60,
    })
    expect(c).toBe("sid=abc; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax")
  })
  it("serializes Max-Age=0 to expire", () => {
    const c = serializeCookie("sid", "", { maxAge: 0, path: "/" })
    expect(c).toContain("Max-Age=0")
  })
})
