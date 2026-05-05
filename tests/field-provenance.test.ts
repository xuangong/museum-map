import { describe, it, expect } from "bun:test"
import { Miniflare } from "miniflare"
import { flattenProvenance, type MuseumPayload, type Provenance } from "~/services/import-schema"
import { classifySource } from "~/services/review"
import { FieldProvenanceRepo } from "~/repo/field-provenance"
import { MuseumsRepo } from "~/repo/museums"
import { MuseumsPendingRepo } from "~/repo/museums-pending"
import { createApp } from "~/index"

async function freshDb(): Promise<D1Database> {
  const mf = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('') } }",
    d1Databases: { DB: ":memory:" },
  })
  const db = await mf.getD1Database("DB")
  await db.batch([
    db.prepare(
      "CREATE TABLE museums (id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, location TEXT, level TEXT, core_period TEXT, specialty TEXT, dynasty_coverage TEXT, timeline TEXT)",
    ),
    db.prepare(
      "CREATE TABLE museum_treasures (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_halls (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_artifacts (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, name TEXT NOT NULL, period TEXT, description TEXT, image_url TEXT, image_license TEXT, image_attribution TEXT, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_dynasty_connections (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, dynasty TEXT NOT NULL, description TEXT, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museum_sources (museum_id TEXT NOT NULL REFERENCES museums(id) ON DELETE CASCADE, order_index INTEGER NOT NULL, source TEXT NOT NULL, PRIMARY KEY(museum_id, order_index))",
    ),
    db.prepare(
      "CREATE TABLE museums_pending (id TEXT PRIMARY KEY, query TEXT NOT NULL, payload TEXT NOT NULL, provenance TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, reviewed_at INTEGER, notes TEXT)",
    ),
    db.prepare(
      "CREATE TABLE field_provenance (museum_id TEXT NOT NULL, field_path TEXT NOT NULL, source_url TEXT, authority TEXT, recorded_at INTEGER NOT NULL, PRIMARY KEY (museum_id, field_path), FOREIGN KEY (museum_id) REFERENCES museums(id) ON DELETE CASCADE)",
    ),
    db.prepare(
      "CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, email_normalized TEXT NOT NULL, password_hash TEXT, google_sub TEXT UNIQUE, display_name TEXT, avatar_url TEXT, is_admin INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, last_login_at INTEGER)",
    ),
    db.prepare(
      "CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, user_agent TEXT, ip TEXT)",
    ),
  ])
  return db as unknown as D1Database
}

async function makeAdminSession(db: D1Database): Promise<string> {
  const now = Date.now()
  const uid = "admin-test-user"
  const sid = "admin-test-session-" + now
  await db
    .prepare(
      "INSERT INTO users (id, email, email_normalized, is_admin, created_at) VALUES (?, ?, ?, 1, ?)",
    )
    .bind(uid, `admin-${now}@example.com`, `admin-${now}@example.com`, now)
    .run()
  await db
    .prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(sid, uid, now, now + 86400000, now)
    .run()
  return sid
}

describe("flattenProvenance", () => {
  it("emits one row per scalar with matching URL + classified authority", () => {
    const payload: MuseumPayload = {
      name: "苏州博物馆",
      lat: 31.32,
      lng: 120.62,
      location: "江苏苏州",
      level: "一级博物馆",
    }
    const prov: Provenance = {
      name: "https://www.szmuseum.com/",
      lat: "https://www.szmuseum.com/",
      lng: "https://www.szmuseum.com/",
      location: "https://baike.baidu.com/item/苏州博物馆",
      level: "https://www.ncha.gov.cn/foo",
    }
    const rows = flattenProvenance(payload, prov, classifySource, () => 1700)
    const byPath = Object.fromEntries(rows.map((r) => [r.field_path, r]))
    expect(byPath.name?.source_url).toBe("https://www.szmuseum.com/")
    expect(byPath.name?.authority).toBe("official")
    expect(byPath.location?.authority).toBe("encyclopedia")
    // .gov. matches government before association regex.
    expect(byPath.level?.authority).toBe("government")
    expect(byPath.lat?.recorded_at).toBe(1700)
    expect(rows.find((r) => r.field_path === "specialty")).toBeUndefined()
  })

  it("emits array indexed paths and per-item provenance", () => {
    const payload: MuseumPayload = {
      name: "X",
      lat: 0,
      lng: 0,
      treasures: ["A", "B"],
      artifacts: [{ name: "甲", period: "唐", description: "desc" }, { name: "乙" }],
      dynastyConnections: [{ dynasty: "唐", description: "盛世" }],
    }
    const prov: Provenance = {
      treasures: ["https://a.example/", "https://b.example/"],
      artifacts: ["https://www.foo-museum.org/", ""],
      dynastyConnections: ["https://wiki.example/"],
    }
    const rows = flattenProvenance(payload, prov, classifySource, () => 1)
    const paths = rows.map((r) => r.field_path)
    expect(paths).toContain("treasures[0]")
    expect(paths).toContain("treasures[1]")
    expect(paths).toContain("artifacts[0].name")
    expect(paths).toContain("artifacts[0].period")
    expect(paths).toContain("artifacts[0].description")
    expect(paths).toContain("artifacts[1].name")
    expect(paths).not.toContain("artifacts[1].period")
    expect(paths).toContain("dynastyConnections[0].dynasty")
    expect(paths).toContain("dynastyConnections[0].description")
    const a1 = rows.find((r) => r.field_path === "artifacts[1].name")!
    expect(a1.source_url).toBeNull()
    expect(a1.authority).toBeNull()
  })

  it("never emits provenance for sources array", () => {
    const payload: MuseumPayload = { name: "X", lat: 0, lng: 0, sources: ["https://a.example/"] }
    const prov: Provenance = { sources: ["https://a.example/"] }
    const rows = flattenProvenance(payload, prov, classifySource)
    expect(rows.find((r) => r.field_path.startsWith("sources"))).toBeUndefined()
  })
})

describe("FieldProvenanceRepo", () => {
  it("replaceAll round-trips and overwrites previous rows", async () => {
    const db = await freshDb()
    await db.prepare("INSERT INTO museums (id, name, lat, lng) VALUES (?, ?, ?, ?)").bind("m1", "X", 0, 0).run()
    const repo = new FieldProvenanceRepo(db)
    await repo.replaceAll("m1", [
      { field_path: "name", source_url: "https://a/", authority: "official", recorded_at: 1 },
      { field_path: "lat", source_url: null, authority: null, recorded_at: 1 },
    ])
    let rows = await repo.listFor("m1")
    expect(rows).toHaveLength(2)
    await repo.replaceAll("m1", [
      { field_path: "lng", source_url: "https://b/", authority: "encyclopedia", recorded_at: 2 },
    ])
    rows = await repo.listFor("m1")
    expect(rows).toHaveLength(1)
    expect(rows[0]!.field_path).toBe("lng")
    expect(rows[0]!.authority).toBe("encyclopedia")
  })
})

describe("approve flow persists provenance + GET ?withProvenance=1", () => {
  it("end-to-end: pending → approve → fetch with _provenance", async () => {
    const db = await freshDb()
    const env: any = { DB: db, DISABLE_CHAT: "1" }
    const app = createApp(env)
    const sid = await makeAdminSession(db)

    const pending = new MuseumsPendingRepo(db)
    const payload: MuseumPayload = {
      name: "测试馆",
      lat: 30,
      lng: 120,
      location: "上海",
      treasures: ["甲"],
    }
    const provenance: Provenance = {
      name: "https://www.test-museum.org/",
      lat: "https://www.test-museum.org/",
      lng: "https://www.test-museum.org/",
      location: "https://baike.baidu.com/item/test",
      treasures: ["https://www.test-museum.org/"],
    }
    await pending.insert({ id: "test-1", query: "测试", payload, provenance, createdAt: 1 })

    const approveRes = await app.handle(
      new Request("http://localhost/api/pending/test-1/approve", {
        method: "POST",
        headers: { cookie: `sid=${sid}`, "content-type": "application/json", origin: "http://localhost", host: "localhost" },
        body: "{}",
      }),
    )
    expect(approveRes.status).toBe(200)

    const r1 = await app.handle(new Request("http://localhost/api/museums/test-1"))
    const j1: any = await r1.json()
    expect(j1.name).toBe("测试馆")
    expect(j1._provenance).toBeUndefined()

    const r2 = await app.handle(new Request("http://localhost/api/museums/test-1?withProvenance=1"))
    const j2: any = await r2.json()
    expect(j2._provenance).toBeDefined()
    expect(j2._provenance.name?.sourceUrl).toBe("https://www.test-museum.org/")
    expect(j2._provenance.name?.authority).toBe("official")
    expect(j2._provenance.location?.authority).toBe("encyclopedia")
    expect(j2._provenance["treasures[0]"]?.sourceUrl).toBe("https://www.test-museum.org/")
  })

  it("approve succeeds even when pending row has null provenance (legacy)", async () => {
    const db = await freshDb()
    const env: any = { DB: db, DISABLE_CHAT: "1" }
    const app = createApp(env)
    const sid = await makeAdminSession(db)

    const pending = new MuseumsPendingRepo(db)
    const payload: MuseumPayload = { name: "Legacy", lat: 30, lng: 120 }
    await pending.insert({ id: "legacy-1", query: "x", payload, createdAt: 1 })

    const res = await app.handle(
      new Request("http://localhost/api/pending/legacy-1/approve", {
        method: "POST",
        headers: { cookie: `sid=${sid}`, "content-type": "application/json", origin: "http://localhost", host: "localhost" },
        body: "{}",
      }),
    )
    expect(res.status).toBe(200)
    const repo = new FieldProvenanceRepo(db)
    expect(await repo.listFor("legacy-1")).toHaveLength(0)
    const museums = new MuseumsRepo(db)
    expect(await museums.get("legacy-1")).not.toBeNull()
  })
})
