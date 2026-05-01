import { describe, it, expect } from "bun:test"
import { loadLocalEnv } from "~/local/env"

describe("loadLocalEnv", () => {
  it("throws if D1/KV credentials missing", () => {
    expect(() =>
      loadLocalEnv({}, {
        CLOUDFLARE_ACCOUNT_ID: undefined,
        CLOUDFLARE_API_TOKEN: undefined,
        D1_DATABASE_ID: undefined,
        KV_RATE_NAMESPACE_ID: undefined,
      } as any),
    ).toThrow(/missing env/i)
  })

  it("returns parsed env when all required vars present", () => {
    const env = loadLocalEnv({}, {
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_API_TOKEN: "tok",
      D1_DATABASE_ID: "db",
      KV_RATE_NAMESPACE_ID: "kv",
    } as any)
    expect(env.cf.accountId).toBe("acc")
    expect(env.cf.token).toBe("tok")
    expect(env.cf.d1Id).toBe("db")
    expect(env.cf.kvId).toBe("kv")
    expect(env.disableChat).toBe(false)
    expect(env.gatewayUrl).toBeUndefined()
  })

  it("DISABLE_CHAT=1 marks chat disabled", () => {
    const env = loadLocalEnv({}, {
      CLOUDFLARE_ACCOUNT_ID: "a",
      CLOUDFLARE_API_TOKEN: "t",
      D1_DATABASE_ID: "d",
      KV_RATE_NAMESPACE_ID: "k",
      DISABLE_CHAT: "1",
    } as any)
    expect(env.disableChat).toBe(true)
  })

  it("PORT defaults to 4242 if missing", () => {
    const env = loadLocalEnv({}, {
      CLOUDFLARE_ACCOUNT_ID: "a", CLOUDFLARE_API_TOKEN: "t",
      D1_DATABASE_ID: "d", KV_RATE_NAMESPACE_ID: "k",
    } as any)
    expect(env.port).toBe(4242)
  })
})
