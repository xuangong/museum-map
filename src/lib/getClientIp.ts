export function getClientIp(req: Request): string {
  const cf = (req as any).cf
  if (cf?.connectingIp && typeof cf.connectingIp === "string") return cf.connectingIp
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return "127.0.0.1"
}
