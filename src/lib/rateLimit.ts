export interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

export type Bucket = "min" | "day" | "global-day"

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0")
}

export function bucketKey(bucket: Bucket, ip: string | null, when: Date = new Date()): string {
  const y = when.getUTCFullYear()
  const m = pad(when.getUTCMonth() + 1)
  const d = pad(when.getUTCDate())
  const h = pad(when.getUTCHours())
  const min = pad(when.getUTCMinutes())
  if (bucket === "min") return `rate:ip:${ip}:min:${y}${m}${d}${h}${min}`
  if (bucket === "day") return `rate:ip:${ip}:day:${y}${m}${d}`
  return `rate:global:day:${y}${m}${d}`
}

export interface RateResult {
  ok: boolean
  count: number
}

export async function checkAndIncrement(
  kv: KVLike,
  key: string,
  limit: number,
  ttlSec: number,
): Promise<RateResult> {
  const cur = Number((await kv.get(key)) ?? "0")
  if (cur >= limit) return { ok: false, count: cur }
  const next = cur + 1
  await kv.put(key, String(next), { expirationTtl: ttlSec })
  return { ok: true, count: next }
}
