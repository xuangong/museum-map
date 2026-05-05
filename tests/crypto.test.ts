import { describe, it, expect } from "bun:test"
import { hashPassword, verifyPassword, generateToken } from "~/lib/crypto"

describe("hashPassword/verifyPassword", () => {
  it("verifies the same password", () => {
    const h = hashPassword("hunter2")
    expect(verifyPassword("hunter2", h)).toBe(true)
  })
  it("rejects wrong password", () => {
    const h = hashPassword("hunter2")
    expect(verifyPassword("wrong", h)).toBe(false)
  })
  it("produces different hashes for the same password (random salt)", () => {
    const h1 = hashPassword("hunter2")
    const h2 = hashPassword("hunter2")
    expect(h1).not.toBe(h2)
    expect(verifyPassword("hunter2", h1)).toBe(true)
    expect(verifyPassword("hunter2", h2)).toBe(true)
  })
  it("returns false for malformed stored hash", () => {
    expect(verifyPassword("x", "garbage")).toBe(false)
    expect(verifyPassword("x", "")).toBe(false)
  })
})

describe("generateToken", () => {
  it("generates hex of 2*byteLen length", () => {
    const t = generateToken(16)
    expect(t).toMatch(/^[0-9a-f]{32}$/)
  })
  it("is unique across calls", () => {
    expect(generateToken(16)).not.toBe(generateToken(16))
  })
})
