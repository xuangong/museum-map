// 寄 · 手卷的画心旁注与全部文字。Only checked data — dynasty yaml, era voices, 名曲, 展签.
import { ERA_VOICES } from "~/data/era-voices"
import { ERA_TUNES } from "~/data/era-tunes"
import { DYNASTY_GEO } from "~/data/dynasty-geo"
import { ACHIEVEMENTS } from "~/data/achievements"
import { ACHIEVEMENT_LABELS } from "~/data/achievement-labels"
import {
  colophon, eraShort, pageTitle, seasonOf, SEASON_LINES, titleSlip, tuneYinshou, VOYAGE_YINSHOU, SCROLL_YINSHOU,
} from "~/services/scroll-text"
import type { ScrollKind } from "~/repo/scrolls"

export interface ScrollPayload {
  name: string
  line?: string
  visitedIds: string[]
  ganzhi: string
  term: string
  seed?: number
  /** tune: dynasty id the performance was focused on, or null for the whole stack */
  era?: string | null
  achId?: string
}
export interface Note {
  dynastyId: string
  title: string
  period: string
  lines: string[]
  tunes: { name: string; story: string; from: string }[]
  seen: string
}
export interface BuiltScroll {
  kind: ScrollKind
  name: string
  line: string
  slip: string
  yinshou: string
  season: { text: string; src: string }
  title: string
  colophon: string
  notes: Note[]
  seal: { id: string; name: string; seal: string; labelTitle: string; label: string; why: string; seen: string[] } | null
  seals: { id: string; name: string }[]
  visitedIds: string[]
  seed: number | null
  era: string | null
}

type Dyn = { id: string; name: string; period?: string; events?: { date: string; event: string }[]; culture?: { category: string; description: string }[]; recommendedMuseums?: { museumId: string }[]; relatedMuseums?: { museumId: string }[] }
type Mus = { id: string; name: string }

function shortSite(n: string): string { const i = n.search(/[（(]/); return (i >= 0 ? n.slice(0, i) : n).trim() }

function capitalLine(id: string): string {
  const g = DYNASTY_GEO[id]
  if (!g || !g.sites.length) return ""
  if (g.sites.every((s) => s.role === "culture")) return "满天星斗 · " + g.sites.slice(0, 4).map((s) => shortSite(s.name)).join("、") + (g.sites.length > 4 ? " 等" : "")
  const names: string[] = []
  g.trail.forEach((k) => { const s = g.sites[k]; const n = s && shortSite(s.name); if (n && !names.includes(n)) names.push(n) })
  return names.length ? "都城 · " + names.join(" → ") : ""
}

function period(p?: string): string {
  return String(p || "").replace(/约?公元/g, "").replace(/年/g, "").replace(/—/g, "–")
}

export function buildScroll(s: { kind: ScrollKind; payload: ScrollPayload }, cat: { museums: Mus[]; dynasties: Dyn[] }): BuiltScroll {
  const p = s.payload
  const name = p.name || "无名氏"
  const museumById = new Map(cat.museums.map((m) => [m.id, m]))
  const visited = (p.visitedIds || []).filter((id) => museumById.has(id))
  const visitedSet = new Set(visited)
  const at = { ganzhi: p.ganzhi, term: p.term }
  // layer membership, same rule as the strata view
  const byLayer = new Map<string, string[]>()
  for (const d of cat.dynasties) {
    const ids = [...(d.recommendedMuseums || []), ...(d.relatedMuseums || [])].map((r) => r.museumId)
    byLayer.set(d.id, [...new Set(ids)].filter((id) => visitedSet.has(id)))
  }
  const stampedLayers = cat.dynasties.filter((d) => (byLayer.get(d.id) || []).length)
  const seals = visited.map((id) => ({ id, name: museumById.get(id)!.name }))
  const seenLine = (d: Dyn) => {
    const ms = (byLayer.get(d.id) || []).map((id) => museumById.get(id)!.name)
    return ms.length ? "TA 在 " + ms.slice(0, 2).join("、") + (ms.length > 2 ? " 等" + ms.length + "馆" : "") + " 见过这一层" : ""
  }
  let slip = "", yinshou = "", colo = "", notes: Note[] = [], seal: BuiltScroll["seal"] = null

  if (s.kind === "tune") {
    const focus = p.era ? cat.dynasties.filter((d) => d.id === p.era) : stampedLayers.length ? stampedLayers : cat.dynasties
    const eras = focus.map((d) => eraShort(d.name))
    slip = titleSlip({ kind: "tune", eras: stampedLayers.length || p.era ? eras : [] })
    yinshou = tuneYinshou(p.seed ?? 0)
    colo = colophon({ kind: "tune", ...at, name, museums: visited.length, eras: stampedLayers.length || p.era ? eras : [] })
    notes = focus.map((d) => {
      const v = ERA_VOICES[d.id]
      const src = v?.src ? museumById.get(v.src.museumId) : null
      const lines = v ? [v.inst + (v.src && src ? " · 声取自" + src.name + "「" + v.src.artifact + "」" : " · 示意")] : []
      const tunes = (ERA_TUNES[d.id] || []).map((t) => ({
        name: t.name, story: t.story,
        from: t.from === "仅存歌词" ? "曲调已失传，仅存歌词" : "今所奏出自" + t.from,
      }))
      return { dynastyId: d.id, title: eraShort(d.name), period: period(d.period), lines, tunes, seen: seenLine(d) }
    })
  } else if (s.kind === "voyage") {
    slip = titleSlip({ kind: "voyage" }); yinshou = VOYAGE_YINSHOU
    colo = colophon({ kind: "voyage", ...at, name, layers: stampedLayers.length })
    notes = [...cat.dynasties].reverse().map((d) => {
      const lines: string[] = []
      const ev = (d.events || [])[0]; if (ev) lines.push(ev.date + " · " + ev.event)
      const cu = (d.culture || [])[0]; if (cu) lines.push(cu.category + " · " + cu.description)
      const cap = capitalLine(d.id); if (cap) lines.push(cap)
      return { dynastyId: d.id, title: eraShort(d.name), period: period(d.period), lines, tunes: [], seen: seenLine(d) }
    })
  } else if (s.kind === "seal") {
    const a = ACHIEVEMENTS.find((x) => x.id === p.achId)
    if (!a) throw new Error("unknown achievement")
    const memberIds = (a.members || []).map((m) => ("museum" in m ? m.museum : null)).filter(Boolean) as string[]
    const seenIds = memberIds.length ? memberIds.filter((id) => visitedSet.has(id)) : visited
    const seen = seenIds.map((id) => museumById.get(id)?.name).filter(Boolean) as string[]
    slip = titleSlip({ kind: "seal", achName: a.name }); yinshou = a.yinshou
    colo = colophon({ kind: "seal", ...at, name, museumNames: seen.length ? seen : seals.map((x) => x.name), achName: a.name })
    seal = { id: a.id, name: a.name, seal: a.seal, labelTitle: a.labelTitle, label: ACHIEVEMENT_LABELS[a.id] || "", why: a.why, seen }
  } else {
    slip = titleSlip({ kind: "scroll", name }); yinshou = SCROLL_YINSHOU
    colo = colophon({ kind: "scroll", ...at, name, museums: visited.length, layers: stampedLayers.length })
  }
  return {
    kind: s.kind, name, line: p.line || "", slip, yinshou,
    season: { ...SEASON_LINES[seasonOf(p.term)] }, title: pageTitle(name, yinshou), colophon: colo,
    notes, seal, seals, visitedIds: visited, seed: p.seed ?? null, era: p.era ?? null,
  }
}
