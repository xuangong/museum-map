/**
 * Map a free-text `level` string from `museums.level` into a set of canonical tier slugs.
 * A museum can match multiple tiers (e.g. 故宫 = 一级 + 世遗).
 */
export function normalizeLevel(raw: string | null | undefined): string[] {
  if (!raw) return []
  const tiers: string[] = []
  if (/世界文化遗产|UNESCO|世界遗产/i.test(raw)) tiers.push("world-heritage")
  if (/国家一级博物馆|国家级博物馆|世界级博物馆/.test(raw)) tiers.push("tier1")
  if (/国家二级博物馆/.test(raw)) tiers.push("tier2")
  if (/全国重点文物保护单位/.test(raw)) tiers.push("protected")
  if (tiers.length === 0) tiers.push("other")
  return tiers
}

export const LEVEL_TIERS: { id: string; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "tier1", label: "一级" },
  { id: "tier2", label: "二级" },
  { id: "world-heritage", label: "世遗" },
  { id: "protected", label: "重点单位" },
  { id: "other", label: "其他" },
]
