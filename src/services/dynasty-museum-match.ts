/**
 * Match museums to dynasties based on structured signals:
 *  - museum.core_period / museum.dynasty_coverage substring match
 *  - museum_artifacts.period substring match
 *
 * Returns evidence per (dynasty, museum) pair, used as input for LLM-generated reasons.
 */

export interface DynastyKey {
  id: string
  name: string // display name
}

export interface MuseumSignal {
  id: string
  name: string
  corePeriod: string | null
  dynastyCoverage: string | null
}

export interface ArtifactSignal {
  museum_id: string
  name: string
  period: string | null
}

export interface MatchEvidence {
  museumId: string
  museumName: string
  /** Reasons in plain Chinese for the matcher's own bookkeeping. */
  signals: {
    type: "core_period" | "dynasty_coverage" | "artifact_period"
    text: string
  }[]
  /** Up to 5 artifact names whose period matched this dynasty. */
  artifactHits: { name: string; period: string }[]
}

/** Strip the trailing 朝/国 and parens to get a stable short name. */
export function dynastyShortName(name: string): string {
  if (!name) return ""
  const i = name.search(/[（(]/)
  const head = (i >= 0 ? name.slice(0, i) : name).trim()
  return head
}

/** Hand-tuned extra aliases keyed by stripped dynasty name. Captures common
 * coverage-string compounds like "隋唐" / "唐宋" / "明清" / "夏商周" / "南朝" etc. */
const EXTRA_ALIASES: Record<string, string[]> = {
  夏: ["夏朝", "夏代", "夏商", "夏商周"],
  商: ["商朝", "商代", "商周", "夏商", "夏商周", "殷商", "殷"],
  秦: ["秦", "秦朝", "秦代", "秦汉", "先秦"],
  隋: ["隋朝", "隋代", "隋唐"],
  唐: ["唐朝", "唐代", "唐宋", "隋唐", "盛唐", "晚唐", "初唐", "中唐"],
  宋: ["宋朝", "宋代", "宋元", "唐宋", "北宋", "南宋"],
  元: ["元朝", "元代", "宋元", "元明", "蒙元"],
  明: ["明朝", "明代", "明清", "元明"],
  清: ["清朝", "清代", "明清", "晚清"],
  辽: ["辽朝", "辽代", "辽金", "契丹"],
  金: ["金朝", "金代", "辽金", "金元", "女真"],
  两晋: ["两晋", "西晋", "东晋", "晋代", "晋"],
  南北朝: ["南北朝", "南朝", "北朝", "魏晋南北朝", "宋齐梁陈", "北魏", "东魏", "西魏", "北齐", "北周"],
  五代十国: ["五代十国", "五代", "十国", "吴越", "南唐", "前蜀", "后蜀"],
  三国: ["三国", "曹魏", "蜀汉", "东吴"],
  西汉: ["西汉", "前汉", "西汉时期"],
  东汉: ["东汉", "后汉"],
  西周: ["西周", "周代", "成康", "西周早期", "西周晚期"],
  东周: ["东周", "春秋", "战国", "春秋战国"],
}

/** Return list of substrings to look for in haystacks. Disambiguates single-char
 * dynasty names by attaching period suffixes (朝/代) so that "宁夏"/"西夏" don't match 夏朝. */
export function dynastyAliases(name: string): string[] {
  const head = dynastyShortName(name)
  if (!head) return []
  const aliases = new Set<string>()
  const parts = head.split(/[：:、，,与/]/g).map((s) => s.trim()).filter(Boolean)
  for (const p of parts) {
    aliases.add(p)
    const stripped = p.replace(/(朝|国)$/, "")
    if (stripped && stripped !== p) {
      aliases.add(stripped + "代")
      if (stripped.length >= 2) aliases.add(stripped)
    }
    // Hand-tuned compounds for the stripped form
    const extras = EXTRA_ALIASES[stripped] || EXTRA_ALIASES[p]
    if (extras) for (const e of extras) aliases.add(e)
  }
  return [...aliases]
}

function periodMentionsDynasty(period: string, aliases: string[]): boolean {
  for (const a of aliases) if (period.indexOf(a) >= 0) return true
  return false
}

export function buildEvidence(
  dynasty: DynastyKey,
  museums: MuseumSignal[],
  artifacts: ArtifactSignal[],
): MatchEvidence[] {
  const aliases = dynastyAliases(dynasty.name)
  if (aliases.length === 0) return []

  // Index artifacts by museum.
  const artByMuseum = new Map<string, ArtifactSignal[]>()
  for (const a of artifacts) {
    const arr = artByMuseum.get(a.museum_id)
    if (arr) arr.push(a)
    else artByMuseum.set(a.museum_id, [a])
  }

  const out: MatchEvidence[] = []
  for (const m of museums) {
    const signals: MatchEvidence["signals"] = []
    if (m.corePeriod && periodMentionsDynasty(m.corePeriod, aliases)) {
      signals.push({ type: "core_period", text: m.corePeriod })
    }
    if (m.dynastyCoverage && periodMentionsDynasty(m.dynastyCoverage, aliases)) {
      signals.push({ type: "dynasty_coverage", text: m.dynastyCoverage })
    }
    const hits: { name: string; period: string }[] = []
    for (const a of artByMuseum.get(m.id) ?? []) {
      if (!a.period) continue
      if (periodMentionsDynasty(a.period, aliases)) {
        hits.push({ name: a.name, period: a.period })
        if (hits.length >= 5) break
      }
    }
    if (hits.length > 0) {
      signals.push({ type: "artifact_period", text: `${hits.length} 件文物` })
    }
    if (signals.length > 0) {
      out.push({ museumId: m.id, museumName: m.name, signals, artifactHits: hits })
    }
  }
  return out
}
