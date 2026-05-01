import { describe, it, expect, beforeAll } from "bun:test"
import { $ } from "bun"

const D1 = ["bunx", "wrangler", "d1", "execute", "museum-map-db", "--local"] as const

async function exec(cmd: string): Promise<string> {
  const result = await $`${D1} --command=${cmd}`.text()
  return result
}

async function count(table: string): Promise<number> {
  const out = await exec(`SELECT count(*) AS c FROM ${table}`)
  const m = out.match(/"c":\s*(\d+)/)
  if (!m) throw new Error(`could not parse count from: ${out}`)
  return Number(m[1])
}

describe("seed.ts", () => {
  beforeAll(async () => {
    await $`bun run seed`.quiet()
  }, 120000)

  it("loads exactly 64 museums and 20 dynasties", async () => {
    expect(await count("museums")).toBe(64)
    expect(await count("dynasties")).toBe(20)
  })

  it("loads exactly 441 museum_artifacts", async () => {
    expect(await count("museum_artifacts")).toBe(441)
  })

  it("preserves at least 340 artifacts with a non-null period", async () => {
    const out = await exec("SELECT count(*) AS c FROM museum_artifacts WHERE period IS NOT NULL AND period != ''")
    const m = out.match(/"c":\s*(\d+)/)
    expect(Number(m![1])).toBeGreaterThanOrEqual(340)
  })

  it("preserves dynasty_culture as rows (every dynasty has at least 1 entry)", async () => {
    const out = await exec(
      "SELECT count(*) AS c FROM dynasties WHERE id NOT IN (SELECT DISTINCT dynasty_id FROM dynasty_culture)",
    )
    const m = out.match(/"c":\s*(\d+)/)
    expect(Number(m![1])).toBe(0)
  })

  it("is idempotent — running seed again leaves identical row counts", async () => {
    const before = {
      museums: await count("museums"),
      dynasties: await count("dynasties"),
      artifacts: await count("museum_artifacts"),
      culture: await count("dynasty_culture"),
      sources: await count("museum_sources"),
    }
    await $`bun run seed`.quiet()
    const after = {
      museums: await count("museums"),
      dynasties: await count("dynasties"),
      artifacts: await count("museum_artifacts"),
      culture: await count("dynasty_culture"),
      sources: await count("museum_sources"),
    }
    expect(after).toEqual(before)
  }, 120000)

  it("cascades delete for museum child tables", async () => {
    // Must run DELETE and SELECT in same command for FK cascade to work
    const result = await exec(
      "DELETE FROM museums WHERE id='anhui';" +
      "SELECT count(*) AS treasures FROM museum_treasures WHERE museum_id='anhui';" +
      "SELECT count(*) AS artifacts FROM museum_artifacts WHERE museum_id='anhui';"
    )
    expect(result).toMatch(/"treasures":\s*0/)
    expect(result).toMatch(/"artifacts":\s*0/)
    await $`bun run seed`.quiet()
  }, 120000)

  it("SET NULL on dynasty_recommended_museums.museum_id when museum deleted", async () => {
    const before = await exec(
      "SELECT museum_id FROM dynasty_recommended_museums WHERE museum_id IS NOT NULL LIMIT 1",
    )
    const m = before.match(/"museum_id":\s*"([^"]+)"/)
    if (!m) {
      return
    }
    const id = m[1]
    // Must run DELETE and SELECT in same command for FK action to work
    const after = await exec(
      `DELETE FROM museums WHERE id='${id}';` +
      `SELECT count(*) AS c FROM dynasty_recommended_museums WHERE museum_id='${id}';`
    )
    expect(after).toMatch(/"c":\s*0/)
    await $`bun run seed`.quiet()
  }, 120000)
})
