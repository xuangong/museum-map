import { describe, it, expect } from "bun:test"
import { buildAuthUrl, exchangeCode } from "~/services/google-oauth"

describe("buildAuthUrl", () => {
  it("includes required oauth parameters", () => {
    const url = new URL(
      buildAuthUrl({ clientId: "cid.apps.googleusercontent.com", redirectUri: "https://x.test/cb", state: "S1" }),
    )
    expect(url.host).toBe("accounts.google.com")
    expect(url.searchParams.get("client_id")).toBe("cid.apps.googleusercontent.com")
    expect(url.searchParams.get("redirect_uri")).toBe("https://x.test/cb")
    expect(url.searchParams.get("state")).toBe("S1")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("scope")).toBe("openid email profile")
  })
})

describe("exchangeCode", () => {
  it("posts code+secret and parses userinfo", async () => {
    const calls: any[] = []
    const fetcher = async (url: string, init: any) => {
      calls.push({ url, init })
      if (url.includes("/token")) {
        return new Response(JSON.stringify({ access_token: "AT", id_token: "IT" }), {
          headers: { "content-type": "application/json" },
        })
      }
      return new Response(
        JSON.stringify({ sub: "g-1", email: "u@example.com", email_verified: true, name: "U", picture: "https://x/y" }),
        { headers: { "content-type": "application/json" } },
      )
    }
    const u = await exchangeCode({
      code: "C1", clientId: "CID", clientSecret: "SEC", redirectUri: "https://x.test/cb", fetcher,
    })
    expect(u.sub).toBe("g-1")
    expect(u.email).toBe("u@example.com")
    expect(u.emailVerified).toBe(true)
    expect(calls).toHaveLength(2)
    const tokenBody = calls[0].init.body as URLSearchParams
    expect(tokenBody.get("code")).toBe("C1")
    expect(tokenBody.get("client_secret")).toBe("SEC")
  })

  it("throws if token endpoint fails", async () => {
    const fetcher = async () => new Response("nope", { status: 400 })
    await expect(
      exchangeCode({ code: "C", clientId: "CID", clientSecret: "S", redirectUri: "https://x/cb", fetcher }),
    ).rejects.toThrow(/token_exchange_failed/)
  })
})
