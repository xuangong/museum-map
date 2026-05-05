export function normalizeEmail(raw: string): string {
  const s = (raw || "").trim().toLowerCase()
  const at = s.lastIndexOf("@")
  if (at < 1 || at === s.length - 1) return ""
  let local = s.slice(0, at)
  let domain = s.slice(at + 1)
  if (!domain.includes(".")) return ""
  if (domain === "googlemail.com") domain = "gmail.com"
  const plus = local.indexOf("+")
  if (plus >= 0) local = local.slice(0, plus)
  if (domain === "gmail.com") local = local.replace(/\./g, "")
  if (!local) return ""
  return local + "@" + domain
}
