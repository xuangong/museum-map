import { Elysia } from "elysia"
import type { Env } from "~/index"
import { sessionMiddleware } from "~/middleware/session"
import type { UserRow } from "~/repo/users"
import { ScrollsRepo, type ScrollKind } from "~/repo/scrolls"
import { MuseumsRepo } from "~/repo/museums"
import { DynastiesRepo } from "~/repo/dynasties"
import { ACHIEVEMENTS } from "~/data/achievements"
import { cleanLine, cleanName } from "~/lib/sensitive"
import { chinaNow } from "~/services/scroll-text"
import { checkAndIncrement } from "~/lib/rateLimit"
import { getClientIp } from "~/lib/getClientIp"
import { buildScroll } from "~/services/scroll-narration"
import { ScrollPage, LostPage } from "~/ui/scroll-page"

interface Ctx { env: Env; body: any; set: any; params: Record<string, string>; request: Request; user: UserRow | null }
const KINDS = new Set<ScrollKind>(["tune", "voyage", "seal", "scroll"])
const ACH = new Set(ACHIEVEMENTS.map((a) => a.id))
const day = () => new Date().toISOString().slice(0, 10).replace(/-/g, "")
const ID_RE = /^[a-hjkmnp-z2-9]{8}$/

export const scrollsRoute = new Elysia()
  .use(sessionMiddleware)
  .post("/api/scrolls", async (ctx) => {
    const c = ctx as unknown as Ctx
    const b = c.body || {}
    const kind = b.kind as ScrollKind
    if (!KINDS.has(kind)) { c.set.status = 400; return { error: "bad kind" } }
    const seed = Number(b.seed)
    if (kind === "tune" && !(Number.isInteger(seed) && seed >= 0 && seed < 2147483647)) { c.set.status = 400; return { error: "bad seed" } }
    if (kind === "seal" && !ACH.has(String(b.achId))) { c.set.status = 400; return { error: "bad achievement" } }
    const ip = getClientIp(c.request)
    const rate = await checkAndIncrement(c.env.RATE, "rate:scroll:" + ip + ":" + day(), 30, 86400)
    if (!rate.ok) { c.set.status = 429; return { error: "今日封卷已多，明日再寄" } }
    const [museums, dynasties] = await Promise.all([new MuseumsRepo(c.env.DB).list(), kind === "tune" && b.era ? new DynastiesRepo(c.env.DB).listFull() : Promise.resolve([])])
    const known = new Set(museums.map((m) => m.id))
    const raw: unknown[] = Array.isArray(b.visitedIds) ? b.visitedIds.slice(0, 400) : []
    const visitedIds = [...new Set(raw.map(String))].filter((id) => known.has(id))
    const u = c.user
    const name = cleanName(b.name, 12) || (u ? cleanName(u.display_name || u.handle, 12) : "") || "无名氏"
    const payload: Record<string, unknown> = { name, line: cleanLine(b.line, 40), visitedIds, ...chinaNow() }
    if (kind === "tune") {
      payload.seed = seed
      payload.era = b.era && dynasties.some((d: any) => d.id === b.era) ? String(b.era) : null
    }
    if (kind === "seal") payload.achId = String(b.achId)
    const id = await new ScrollsRepo(c.env.DB).create({ kind, payload, userId: u ? u.id : null })
    return { id, url: "/s/" + id }
  })
  .get("/s/:id", async (ctx) => {
    const c = ctx as unknown as Ctx
    const html = { "content-type": "text/html; charset=utf-8" }
    const repo = new ScrollsRepo(c.env.DB)
    const id = String(c.params.id || "")
    const row = ID_RE.test(id) ? await repo.get(id) : null
    if (!row) return new Response(LostPage(), { status: 404, headers: html })
    const [museums, dynasties, guan] = await Promise.all([new MuseumsRepo(c.env.DB).list(), new DynastiesRepo(c.env.DB).listFull(), repo.listGuan(id, 30)])
    const built = buildScroll({ kind: row.kind, payload: row.payload }, { museums, dynasties: dynasties as any })
    return new Response(ScrollPage({ id, built, guan, museums, dynasties }), { headers: { ...html, "cache-control": "no-cache" } })
  })
  .get("/api/s/:id/guan", async (ctx) => {
    const c = ctx as unknown as Ctx
    const repo = new ScrollsRepo(c.env.DB)
    const id = String(c.params.id || "")
    if (!ID_RE.test(id) || !(await repo.get(id))) { c.set.status = 404; return { error: "此卷已佚" } }
    return await repo.listGuan(id, 30)
  })
  .post("/api/s/:id/guan", async (ctx) => {
    const c = ctx as unknown as Ctx
    const repo = new ScrollsRepo(c.env.DB)
    const id = String(c.params.id || "")
    if (!ID_RE.test(id) || !(await repo.get(id))) { c.set.status = 404; return { error: "此卷已佚" } }
    const ip = getClientIp(c.request)
    const once = "guan:" + id + ":" + ip
    if (await c.env.RATE.get(once)) { c.set.status = 409; return { error: "已钤过" } }
    const rate = await checkAndIncrement(c.env.RATE, "rate:guan:" + ip + ":" + day(), 40, 86400)
    if (!rate.ok) { c.set.status = 429; return { error: "今日钤印已多" } }
    await c.env.RATE.put(once, "1", { expirationTtl: 30 * 86400 })
    await repo.addGuan(id, cleanName(c.body?.name, 8) || null)
    return await repo.listGuan(id, 30)
  })
  .get("/u/:handle/share", (ctx) => {
    const c = ctx as unknown as Ctx
    return new Response(null, { status: 301, headers: { location: "/u/" + encodeURIComponent(String(c.params.handle || "")) } })
  })
