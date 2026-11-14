import { describe, it, expect } from "bun:test"
import { cleanName, cleanLine } from "~/lib/sensitive"

describe("sensitive", () => {
  it("cleans names", () => {
    expect(cleanName("  小明 ", 8)).toBe("小明")
    expect(cleanName("", 8)).toBe("")
    expect(cleanName("一二三四五六七八九", 8)).toBe("一二三四五六七八")
    expect(cleanName("<b>x</b>", 8)).toBe("bxb")
    expect(cleanName("http://spam.com", 8)).toBe("")
    expect(cleanName("加我微信", 8)).toBe("")
  })
  it("cleans lines", () => {
    expect(cleanLine("今天在洛阳，雪很大。", 40)).toBe("今天在洛阳，雪很大。")
    expect(cleanLine("a\n\nb", 40)).toBe("a b")
    expect(cleanLine("www.x.cn 优惠", 40)).toBe("")
  })
})
