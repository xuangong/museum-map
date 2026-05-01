import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { createApp } from "~/index"

async function makeEnv() {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: "764ebd41-0f3b-442b-934f-a537f63b9fc6" },
    d1Persist: ".wrangler/state/v3/d1",
    kvNamespaces: ["RATE"],
  })
  const DB = await mf.getD1Database("DB")
  const RATE = await mf.getKVNamespace("RATE")
  return { DB, RATE } as any
}

describe("GET /api/museums", () => {
  it("returns 64 list items each with corePeriod and dynastyCoverage", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/museums"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as any[]
    expect(body).toHaveLength(64)
    expect(body[0]).toHaveProperty("corePeriod")
    expect(body[0]).toHaveProperty("dynastyCoverage")
    expect(body[0]).toHaveProperty("lat")
    expect(body[0]).toHaveProperty("lng")
  })
})

describe("GET /api/museums/:id", () => {
  it("returns full museum with all child arrays", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/museums/anhui"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.id).toBe("anhui")
    expect(Array.isArray(body.treasures)).toBe(true)
    expect(Array.isArray(body.artifacts)).toBe(true)
    expect(Array.isArray(body.dynastyConnections)).toBe(true)
    expect(Array.isArray(body.sources)).toBe(true)
    expect(body.artifacts[0]).toHaveProperty("period")
  })

  it("returns 404 for unknown id", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/museums/nope"))
    expect(res.status).toBe(404)
  })
})

describe("GET /api/dynasties", () => {
  it("returns 20 dynasties with culture as array of {category,description}", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/dynasties"))
    expect(res.status).toBe(200)
    const body = (await res.json()) as any[]
    expect(body).toHaveLength(20)
    for (const d of body) {
      expect(Array.isArray(d.culture)).toBe(true)
      expect(d.culture.length).toBeGreaterThan(0)
      expect(typeof d.culture[0].category).toBe("string")
    }
  })

  it("each dynasty has events and recommendedMuseums arrays", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/dynasties"))
    const body = (await res.json()) as any[]
    for (const d of body) {
      expect(Array.isArray(d.events)).toBe(true)
      expect(Array.isArray(d.recommendedMuseums)).toBe(true)
    }
  })
})

describe("GET /api/dynasties/:id", () => {
  it("returns same shape as list item", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const listRes = await app.handle(new Request("http://localhost/api/dynasties"))
    const list = (await listRes.json()) as any[]
    const fromList = list.find((d) => d.id === "tang")

    const oneRes = await app.handle(new Request("http://localhost/api/dynasties/tang"))
    expect(oneRes.status).toBe(200)
    const one = await oneRes.json()
    expect(one).toEqual(fromList)
  })

  it("returns 404 for unknown id", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(new Request("http://localhost/api/dynasties/nope"))
    expect(res.status).toBe(404)
  })
})

describe("POST /api/chat", () => {
  it("returns 503 when COPILOT_GATEWAY_URL/KEY missing", async () => {
    const env = await makeEnv()
    const app = createApp(env)
    const res = await app.handle(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
      }),
    )
    expect(res.status).toBe(503)
    const body = (await res.json()) as any
    expect(body.error).toContain("not configured")
  })

  it("returns 400 for empty body", async () => {
    const env = await makeEnv()
    const envWithChat = { ...env, COPILOT_GATEWAY_URL: "https://up.example", COPILOT_GATEWAY_KEY: "k" }
    const app = createApp(envWithChat)
    const res = await app.handle(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    )
    expect(res.status).toBe(400)
  })
})
