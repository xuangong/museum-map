import type { Env } from "~/index"
import { deriveCity, sealSpec, type SealSpec } from "~/services/museum-meta"

const RECENT_SEALS = 6

export interface PlazaSeal extends SealSpec {
  id: string
  name: string
}

export interface PlazaEntry {
  handle: string
  displayName: string | null
  visitCount: number
  dynastyCount: number
  reviewCount: number          // number of dynasty reviews + 1 if total review exists
  lastVisitAt: number | null
  joinedAt: number
  /** Latest seals collected, newest first (up to RECENT_SEALS). */
  recentSeals?: PlazaSeal[]
}

// One D1 query that aggregates everything we need; only includes users that
// (a) have a handle, (b) opted in to plaza, and (c) have at least 1 visit.
//
// dynasty count uses dynasty_recommended_museums + museum_dynasty_connections to
// approximate "dynasties touched" without re-implementing the dynasty filter logic.
export async function listPlaza(
  env: Env,
  opts: { sort?: "visits" | "recent" | "newest"; limit?: number; offset?: number } = {},
): Promise<{ entries: PlazaEntry[]; total: number }> {
  const sort = opts.sort ?? "visits"
  const limit = Math.max(1, Math.min(opts.limit ?? 60, 100))
  const offset = Math.max(0, opts.offset ?? 0)

  const order =
    sort === "recent"
      ? "last_visit_at DESC NULLS LAST, visit_count DESC"
      : sort === "newest"
        ? "joined_at DESC"
        : "visit_count DESC, dynasty_count DESC, last_visit_at DESC"

  // Subqueries kept simple — D1 handles them in one round-trip.
  const sql = `
    SELECT
      u.handle           AS handle,
      u.display_name     AS display_name,
      u.created_at       AS joined_at,
      COALESCE(v.cnt, 0) AS visit_count,
      COALESCE(v.last_at, 0) AS last_visit_at,
      COALESCE(d.cnt, 0) AS dynasty_count,
      COALESCE(rc.cnt, 0) + CASE WHEN rev.user_id IS NULL THEN 0 ELSE 1 END AS review_count
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS cnt, MAX(visited_at) AS last_at
      FROM visits GROUP BY user_id
    ) v ON v.user_id = u.id
    LEFT JOIN (
      SELECT v.user_id, COUNT(DISTINCT dr.dynasty_id) AS cnt
      FROM visits v
      JOIN dynasty_recommended_museums dr ON dr.museum_id = v.museum_id
      GROUP BY v.user_id
    ) d ON d.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS cnt FROM dynasty_review_cache GROUP BY user_id
    ) rc ON rc.user_id = u.id
    LEFT JOIN review_cache rev ON rev.user_id = u.id
    WHERE u.handle IS NOT NULL
      AND u.show_on_plaza = 1
      AND COALESCE(v.cnt, 0) > 0
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `
  const r = await env.DB.prepare(sql).bind(limit, offset).all<{
    handle: string
    display_name: string | null
    joined_at: number
    visit_count: number
    last_visit_at: number
    dynasty_count: number
    review_count: number
  }>()

  const entries: PlazaEntry[] = (r.results ?? []).map((row) => ({
    handle: row.handle,
    displayName: row.display_name,
    visitCount: row.visit_count,
    dynastyCount: row.dynasty_count,
    reviewCount: row.review_count,
    lastVisitAt: row.last_visit_at || null,
    joinedAt: row.joined_at,
  }))

  // Each card shows the person's latest few seals — one more round-trip, capped per user.
  if (entries.length) {
    const handles = entries.map((e) => e.handle)
    const seals = await env.DB.prepare(`
      SELECT handle, museum_id, name, location FROM (
        SELECT u.handle AS handle, v.museum_id AS museum_id, m.name AS name, m.location AS location,
               ROW_NUMBER() OVER (PARTITION BY v.user_id ORDER BY v.visited_at DESC) AS rn
          FROM visits v
          JOIN users u ON u.id = v.user_id
          JOIN museums m ON m.id = v.museum_id
         WHERE u.handle IN (${handles.map(() => "?").join(",")})
      ) WHERE rn <= ${RECENT_SEALS}
      ORDER BY handle, rn
    `).bind(...handles).all<{ handle: string; museum_id: string; name: string; location: string | null }>()
    const byHandle = new Map<string, PlazaSeal[]>()
    for (const r of seals.results ?? []) {
      const list = byHandle.get(r.handle) ?? []
      list.push({ id: r.museum_id, name: r.name, ...sealSpec(r.museum_id, r.name, deriveCity(r.location)) })
      byHandle.set(r.handle, list)
    }
    for (const e of entries) e.recentSeals = byHandle.get(e.handle) ?? []
  }

  // Total count for pagination footer.
  const totalRow = await env.DB.prepare(`
    SELECT COUNT(*) AS n FROM users u
    WHERE u.handle IS NOT NULL AND u.show_on_plaza = 1
      AND EXISTS (SELECT 1 FROM visits v WHERE v.user_id = u.id)
  `).first<{ n: number }>()
  return { entries, total: totalRow?.n ?? entries.length }
}
