// 寄 · 手卷的文字：干支、汉字数字、题跋、签条、引首、季节句。Design: docs/superpowers/specs/寄.md §4.
import { currentSolarTerm } from "~/services/solar-term"

const STEMS = "甲乙丙丁戊己庚辛壬癸"
const BRANCHES = "子丑寅卯辰巳午未申酉戌亥"

export function ganzhi(year: number): string {
  const k = year - 4
  return STEMS[((k % 10) + 10) % 10]! + BRANCHES[((k % 12) + 12) % 12]!
}

const D = "零一二三四五六七八九"
export function numZh(n: number): string {
  n = Math.max(0, Math.floor(n))
  if (n < 10) return D[n]!
  if (n < 20) return "十" + (n % 10 ? D[n % 10] : "")
  if (n < 100) return D[Math.floor(n / 10)] + "十" + (n % 10 ? D[n % 10] : "")
  const h = Math.floor(n / 100), r = n % 100
  if (!r) return D[h] + "百"
  return D[h] + "百" + (r < 10 ? "零" + D[r] : r < 20 ? "一" + numZh(r) : numZh(r))
}

/** 「唐朝（公元618年—907年）」→「唐」; 远古与新石器时代 → 新石器. */
export function eraShort(name: string): string {
  let n = String(name || "")
  const i = n.search(/[（(]/)
  if (i >= 0) n = n.slice(0, i)
  n = n.replace(/^东周：.*/, "东周").trim()
  if (/新石器/.test(n)) return "新石器"
  if (n.length === 2 && n.endsWith("朝") && n !== "南朝" && n !== "北朝") n = n.slice(0, 1)
  return n
}

const SEASON_OF: Record<string, "春" | "夏" | "秋" | "冬"> = {
  立春: "春", 雨水: "春", 惊蛰: "春", 春分: "春", 清明: "春", 谷雨: "春",
  立夏: "夏", 小满: "夏", 芒种: "夏", 夏至: "夏", 小暑: "夏", 大暑: "夏",
  立秋: "秋", 处暑: "秋", 白露: "秋", 秋分: "秋", 寒露: "秋", 霜降: "秋",
  立冬: "冬", 小雪: "冬", 大雪: "冬", 冬至: "冬", 小寒: "冬", 大寒: "冬",
}
export function seasonOf(term: string): "春" | "夏" | "秋" | "冬" {
  return SEASON_OF[term] ?? "春"
}

export const SEASON_LINES = {
  春: { text: "江南无所有，聊赠一枝春", src: "陆凯《赠范晔》" },
  夏: { text: "感此怀故人，中宵劳梦想", src: "孟浩然《夏日南亭怀辛大》" },
  秋: { text: "海上生明月，天涯共此时", src: "张九龄《望月怀远》" },
  冬: { text: "晚来天欲雪，能饮一杯无", src: "白居易《问刘十九》" },
} as const

/** 干支 and 节气 for the moment the scroll is sealed, in Beijing time. */
export function chinaNow(now: Date = new Date()): { ganzhi: string; term: string } {
  const bj = new Date(now.getTime() + 8 * 3600 * 1000)
  const local = new Date(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate())
  return { ganzhi: ganzhi(bj.getUTCFullYear()), term: currentSolarTerm(local).name }
}

export function museumList(names: string[]): string {
  if (names.length <= 3) return names.join("、")
  return names.slice(0, 2).join("、") + "等" + numZh(names.length) + "馆"
}

export type ColophonInput =
  | { kind: "tune"; ganzhi: string; term: string; name: string; museums: number; eras: string[] }
  | { kind: "voyage"; ganzhi: string; term: string; name: string; layers: number }
  | { kind: "seal"; ganzhi: string; term: string; name: string; museumNames: string[]; achName: string }
  | { kind: "scroll"; ganzhi: string; term: string; name: string; museums: number; layers: number }

export function colophon(c: ColophonInput): string {
  const head = c.ganzhi + "年" + c.term + "，" + c.name
  if (c.kind === "tune") {
    const what = c.eras.length && c.eras.length <= 4 ? c.eras.join("、") + numZh(c.eras.length) + "代" : numZh(c.eras.length || 20) + "代"
    return head + "以" + numZh(c.museums) + "馆之印，奏" + what + "之音。"
  }
  if (c.kind === "voyage") return head + "溯洄而上，自今及于新石器" + (c.layers ? "，所过" + numZh(c.layers) + "层。" : "。")
  if (c.kind === "seal") return head + "集" + museumList(c.museumNames) + "之印，得「" + c.achName + "」。"
  return head + "集" + numZh(c.museums) + "馆之印，叠为" + numZh(c.layers) + "层。"
}

export function titleSlip(t: { kind: "tune"; eras: string[] } | { kind: "voyage" } | { kind: "seal"; achName: string } | { kind: "scroll"; name: string }): string {
  if (t.kind === "voyage") return "溯洄图卷"
  if (t.kind === "seal") return t.achName
  if (t.kind === "scroll") return t.name + "的长卷"
  if (!t.eras.length) return "百代合奏"
  if (t.eras.length > 4) return numZh(t.eras.length) + "代合奏"
  const sep = t.eras.every((e) => e.length === 1) ? "" : "·"
  return t.eras.join(sep) + numZh(t.eras.length) + "代合奏"
}

const TUNE_YINSHOU = ["百代遗音", "金石之声", "丝竹余韵", "弦上千年"]
export function tuneYinshou(seed: number): string {
  return TUNE_YINSHOU[Math.abs(Math.floor(seed)) % TUNE_YINSHOU.length]!
}
export const VOYAGE_YINSHOU = "溯洄从之"
export const SCROLL_YINSHOU = "平生所见"

export function pageTitle(name: string, yinshou: string): string {
  return name + "寄来一卷 ·《" + yinshou + "》"
}
