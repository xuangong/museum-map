import { loadLocalEnv, readEnvFile } from "~/local/env"
import { makeD1Adapter } from "~/local/d1Adapter"
import { makeKVAdapter } from "~/local/kvAdapter"
import { createApp, type Env } from "~/index"

const colors = {
  reset: "\x1b[0m", dim: "\x1b[2m",
  green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", cyan: "\x1b[36m",
}

function statusColor(s: number): string {
  if (s >= 500) return colors.red
  if (s >= 400) return colors.yellow
  if (s >= 300) return colors.cyan
  return colors.green
}

async function main() {
  let env
  try {
    const fileEnv = await readEnvFile(".env.local")
    env = loadLocalEnv(fileEnv, process.env as any)
  } catch (e: any) {
    console.error(e?.message ?? String(e))
    process.exit(1)
  }

  console.log(`${colors.dim}[local]${colors.reset} D1 ${env.cf.d1Id.slice(0, 8)}…  KV ${env.cf.kvId.slice(0, 8)}…  chat ${
    env.disableChat ? colors.yellow + "disabled" : env.gatewayUrl ? colors.green + "enabled" : colors.yellow + "no-gateway"
  }${colors.reset}`)

  const DB = makeD1Adapter(env.cf) as any as D1Database
  const RATE = makeKVAdapter(env.cf) as any as KVNamespace

  const appEnv: Env = {
    DB, RATE,
    IMAGES: undefined as any as R2Bucket,
    RATE_PER_MIN: "10", RATE_PER_DAY: "100", GLOBAL_PER_DAY: "5000",
    COPILOT_GATEWAY_URL: env.gatewayUrl,
    COPILOT_GATEWAY_KEY: env.gatewayKey,
    ...(env.disableChat ? { DISABLE_CHAT: "1" } as any : {}),
  } as any

  // Smoke check: SELECT count(*) so the user gets an early error if the DB is empty
  try {
    const result = await DB.prepare("SELECT count(*) AS c FROM museums").first<{ c: number }>()
    if (!result || result.c === 0) {
      console.warn(`${colors.yellow}[local] museums table is empty — run \`bun run seed --target=remote\`${colors.reset}`)
    } else {
      console.log(`${colors.dim}[local] museums: ${result.c}${colors.reset}`)
    }
  } catch (e: any) {
    console.error(`${colors.red}[local] DB check failed: ${e?.message ?? e}${colors.reset}`)
  }

  const app = createApp(appEnv)

  // simple per-request log
  const wrapped = {
    async fetch(req: Request): Promise<Response> {
      const t0 = performance.now()
      const path = new URL(req.url).pathname
      const res = await app.handle(req)
      const dt = (performance.now() - t0).toFixed(1)
      console.log(
        `${colors.dim}${new Date().toISOString().slice(11, 19)}${colors.reset} ${req.method.padEnd(6)} ${statusColor(res.status)}${res.status}${colors.reset} ${dt}ms ${path}`,
      )
      return res
    },
  }

  Bun.serve({ port: env.port, fetch: wrapped.fetch })
  console.log(`${colors.green}🍵 museum-map (local) at http://localhost:${env.port}${colors.reset}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
