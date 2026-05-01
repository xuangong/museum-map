export interface LocalEnv {
  cf: { accountId: string; token: string; d1Id: string; kvId: string }
  gatewayUrl?: string
  gatewayKey?: string
  disableChat: boolean
  port: number
}

const REQUIRED = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "D1_DATABASE_ID", "KV_RATE_NAMESPACE_ID"] as const

/** dotenv: keys override file; file overrides nothing — caller passes whichever they want as authority. */
export function loadLocalEnv(fileEnv: Record<string, string>, processEnv: Record<string, string | undefined>): LocalEnv {
  const merged: Record<string, string | undefined> = { ...fileEnv, ...processEnv }
  const missing = REQUIRED.filter((k) => !merged[k] || merged[k] === "")
  if (missing.length > 0) {
    throw new Error(`[local] missing env: ${missing.join(", ")}`)
  }
  return {
    cf: {
      accountId: merged.CLOUDFLARE_ACCOUNT_ID!,
      token: merged.CLOUDFLARE_API_TOKEN!,
      d1Id: merged.D1_DATABASE_ID!,
      kvId: merged.KV_RATE_NAMESPACE_ID!,
    },
    gatewayUrl: merged.COPILOT_GATEWAY_URL,
    gatewayKey: merged.COPILOT_GATEWAY_KEY,
    disableChat: merged.DISABLE_CHAT === "1",
    port: Number(merged.PORT ?? "4242"),
  }
}

export async function readEnvFile(path = ".env.local"): Promise<Record<string, string>> {
  const file = Bun.file(path)
  if (!(await file.exists())) return {}
  const text = await file.text()
  const out: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}
