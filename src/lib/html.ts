const RAW = Symbol("raw")
type Raw = { [RAW]: true; value: string; toString(): string }
type Part = string | number | boolean | null | undefined | Raw | Part[]

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function isRaw(p: unknown): p is Raw {
  return typeof p === "object" && p !== null && (p as Raw)[RAW] === true
}

function render(p: Part): string {
  if (p == null || p === false) return ""
  if (Array.isArray(p)) return p.map(render).join("")
  if (isRaw(p)) return p.value
  return escapeHtml(String(p))
}

function makeRaw(s: string): Raw {
  return { [RAW]: true, value: s, toString() { return s } }
}

export function raw(s: string): Raw {
  return makeRaw(s)
}

/**
 * `html` tagged template — auto-escapes interpolated values.
 *
 * Returns a Raw object that stringifies to the rendered markup. Nested
 * `html\`...\`` interpolations pass through unescaped. Plain strings in
 * interpolations are escaped.
 *
 * For test/assertion purposes, the returned value's `.value` (or
 * `String(result)`) yields the plain markup string.
 */
export function html(strings: TemplateStringsArray, ...parts: Part[]): Raw {
  let out = strings[0] ?? ""
  for (let i = 0; i < parts.length; i++) {
    out += render(parts[i] ?? "") + (strings[i + 1] ?? "")
  }
  return makeRaw(out)
}
