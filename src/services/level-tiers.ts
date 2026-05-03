/**
 * Map a free-text `level` string from `museums.level` into a set of canonical tier slugs.
 * A museum can match multiple tiers (e.g. 故宫 = 一级 + 世遗/国保).
 */
export function normalizeLevel(raw: string | null | undefined): string[] {
  if (!raw) return []
  const tiers: string[] = []
  if (/世界文化遗产|UNESCO|世界遗产|全国重点文物保护单位/i.test(raw)) tiers.push("heritage-site")
  if (/国家一级博物馆|国家级博物馆|世界级博物馆/.test(raw)) tiers.push("tier1")
  if (/国家二级博物馆/.test(raw)) tiers.push("tier2")
  if (tiers.length === 0) tiers.push("other")
  return tiers
}

export const LEVEL_TIERS: { id: string; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "tier1", label: "一级馆" },
  { id: "tier2", label: "二级馆" },
  { id: "heritage-site", label: "世遗/国保" },
]
