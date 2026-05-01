interface RawResp {
  result: Array<{ results?: any[]; meta?: any; success?: boolean }>
  success: boolean
  errors?: any[]
}

export interface D1Adapter {
  prepare(sql: string): D1AdapterStatement
}

export interface D1AdapterStatement {
  bind(...params: any[]): D1AdapterStatement
  all<T = any>(): Promise<{ results: T[] }>
  first<T = any>(): Promise<T | null>
  run(): Promise<{ success: boolean }>
}

class Statement implements D1AdapterStatement {
  private params: any[] = []
  constructor(private endpoint: string, private token: string, private sql: string) {}

  bind(...params: any[]): D1AdapterStatement {
    this.params = params
    return this
  }

  private async exec(): Promise<any[]> {
    // Skip real call for PRAGMA — D1 REST rejects multi-stmt; pragma is no-op here.
    if (/^\s*PRAGMA\b/i.test(this.sql)) return []
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ sql: this.sql, params: this.params }),
    })
    if (!res.ok) throw new Error(`[d1Adapter] HTTP ${res.status}: ${await res.text()}`)
    const json = (await res.json()) as RawResp
    if (!json.success) throw new Error(`[d1Adapter] D1 error: ${JSON.stringify(json.errors)}`)
    return json.result?.[0]?.results ?? []
  }

  async all<T = any>(): Promise<{ results: T[] }> {
    return { results: (await this.exec()) as T[] }
  }
  async first<T = any>(): Promise<T | null> {
    const rows = await this.exec()
    return (rows[0] as T) ?? null
  }
  async run(): Promise<{ success: boolean }> {
    await this.exec()
    return { success: true }
  }
}

export function makeD1Adapter(opts: { accountId: string; token: string; d1Id: string }): D1Adapter {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/d1/database/${opts.d1Id}/query`
  return {
    prepare(sql: string): D1AdapterStatement {
      return new Statement(endpoint, opts.token, sql)
    },
  }
}
