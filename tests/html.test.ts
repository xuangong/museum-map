import { describe, it, expect } from "bun:test"
import { html, raw } from "~/lib/html"

describe("html tag template", () => {
  it("escapes interpolated strings", () => {
    const name = `<script>x</script>`
    expect(String(html`<div>${name}</div>`)).toBe(`<div>&lt;script&gt;x&lt;/script&gt;</div>`)
  })

  it("escapes ampersands and quotes", () => {
    expect(String(html`<a title="${`a & "b"`}">x</a>`)).toBe(`<a title="a &amp; &quot;b&quot;">x</a>`)
  })

  it("raw() bypasses escaping", () => {
    expect(String(html`<div>${raw("<b>bold</b>")}</div>`)).toBe(`<div><b>bold</b></div>`)
  })

  it("flattens arrays", () => {
    expect(String(html`<ul>${[1, 2, 3].map((n) => html`<li>${n}</li>`)}</ul>`)).toBe(`<ul><li>1</li><li>2</li><li>3</li></ul>`)
  })
})
