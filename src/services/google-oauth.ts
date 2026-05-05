// src/services/google-oauth.ts
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
const SCOPES = "openid email profile"

export interface GoogleUser {
  sub: string
  email: string
  emailVerified: boolean
  name?: string
  picture?: string
}

export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL(AUTH_URL)
  u.searchParams.set("client_id", opts.clientId)
  u.searchParams.set("redirect_uri", opts.redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("scope", SCOPES)
  u.searchParams.set("state", opts.state)
  u.searchParams.set("access_type", "online")
  u.searchParams.set("prompt", "select_account")
  return u.toString()
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

export async function exchangeCode(opts: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
  fetcher?: Fetcher
}): Promise<GoogleUser> {
  const fetcher = opts.fetcher ?? ((u, i) => fetch(u, i))
  const tokenBody = new URLSearchParams()
  tokenBody.set("code", opts.code)
  tokenBody.set("client_id", opts.clientId)
  tokenBody.set("client_secret", opts.clientSecret)
  tokenBody.set("redirect_uri", opts.redirectUri)
  tokenBody.set("grant_type", "authorization_code")
  const tokenRes = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody as any,
  })
  if (!tokenRes.ok) throw new Error("token_exchange_failed")
  const tokenJson: any = await tokenRes.json()
  const accessToken = tokenJson.access_token
  if (!accessToken) throw new Error("token_exchange_failed")
  const infoRes = await fetcher(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!infoRes.ok) throw new Error("userinfo_failed")
  const info: any = await infoRes.json()
  if (!info.sub || !info.email) throw new Error("userinfo_invalid")
  return {
    sub: String(info.sub),
    email: String(info.email),
    emailVerified: !!info.email_verified,
    name: info.name,
    picture: info.picture,
  }
}
