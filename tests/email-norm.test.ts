import { describe, it, expect } from "bun:test"
import { normalizeEmail } from "~/lib/email-norm"

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Foo@Bar.COM  ")).toBe("foo@bar.com")
  })
  it("strips dots and +alias for gmail", () => {
    expect(normalizeEmail("f.o.o+spam@gmail.com")).toBe("foo@gmail.com")
    expect(normalizeEmail("Foo.Bar+x@googlemail.com")).toBe("foobar@gmail.com")
  })
  it("strips +alias only for non-gmail", () => {
    expect(normalizeEmail("a.b+x@example.com")).toBe("a.b@example.com")
  })
  it("returns empty for invalid input", () => {
    expect(normalizeEmail("not-an-email")).toBe("")
    expect(normalizeEmail("")).toBe("")
  })
})
