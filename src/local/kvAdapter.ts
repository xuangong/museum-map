export interface KVAdapter {
  get(key: string): Promise<string | null>
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>
}

export function makeKVAdapter(opts: { accountId: string; token: string; kvId: string }): KVAdapter {
  const base = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/storage/kv/namespaces/${opts.kvId}`
  return {
    async get(key: string): Promise<string | null> {
      const res = await fetch(`${base}/values/${encodeURIComponent(key)}`, {
        headers: { authorization: `Bearer ${opts.token}` },
      })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`[kvAdapter] GET ${res.status}: ${await res.text()}`)
      return await res.text()
    },
    async put(key: string, value: string, putOpts?: { expirationTtl?: number }): Promise<void> {
      const url = new URL(`${base}/values/${encodeURIComponent(key)}`)
      if (putOpts?.expirationTtl) url.searchParams.set("expiration_ttl", String(putOpts.expirationTtl))
      const res = await fetch(url, {
        method: "PUT",
        headers: { authorization: `Bearer ${opts.token}`, "content-type": "text/plain" },
        body: value,
      })
      if (!res.ok) throw new Error(`[kvAdapter] PUT ${res.status}: ${await res.text()}`)
    },
  }
}
