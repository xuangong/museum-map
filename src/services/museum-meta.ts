// Derived, presentation-level museum metadata shared by server pages and the
// client bootstrap: the city used for trip planning, and the museum's own seal
// (馆印) that a visitor collects when they check in.

const MUNICIPALITIES = ["北京", "上海", "天津", "重庆", "香港", "澳门"]

/** "河南省洛阳市偃师区…" → "洛阳"; "南京市玄武区…" → "南京"; "台湾省台北市…" → "台北". */
export function deriveCity(location: string | null | undefined): string | null {
  if (!location) return null
  const loc = location.replace(/^中国/, "").replace(/^[^：:]{2,12}[：:]/, "").trim()
  for (const m of MUNICIPALITIES) if (loc.startsWith(m)) return m
  const afterProvince = loc.match(/^.{2,8}?(?:省|自治区)(.{2,6}?)(?:市|地区|盟|自治州)/)
  if (afterProvince?.[1]) return afterProvince[1]
  const cityFirst = loc.match(/^(.{2,4}?)市/)
  if (cityFirst?.[1]) return cityFirst[1]
  return null
}

const PROVINCE_ABBR: Record<string, string> = {
  北京: "京", 天津: "津", 上海: "沪", 重庆: "渝", 河北: "冀", 山西: "晋", 辽宁: "辽", 吉林: "吉",
  黑龙江: "黑", 江苏: "苏", 浙江: "浙", 安徽: "皖", 福建: "闽", 江西: "赣", 山东: "鲁", 河南: "豫",
  湖北: "鄂", 湖南: "湘", 广东: "粤", 海南: "琼", 四川: "川", 贵州: "黔", 云南: "滇", 陕西: "陕",
  甘肃: "甘", 青海: "青", 台湾: "台", 内蒙古: "蒙", 广西: "桂", 西藏: "藏", 宁夏: "宁", 新疆: "新",
}

/** The abbreviations museum-goers actually use, where rules would cut badly. */
const SEAL_OVERRIDES: Record<string, string> = {
  中国国家博物馆: "国博",
  故宫博物院: "故宫",
  首都博物馆: "首博",
  上海博物馆: "上博",
  南京博物院: "南博",
  天津博物馆: "津博",
  陕西历史博物馆: "陕历博",
  台北故宫博物院: "台北故宫",
  中国人民革命军事博物馆: "军博",
  秦始皇兵马俑博物馆: "兵马俑",
  周口店北京人遗址博物馆: "周口店",
  汉景帝阳陵博物院: "汉阳陵",
  八达岭长城: "八达岭",
  响堂山石窟: "响堂山",
  大钟寺古钟博物馆: "大钟寺",
  中国国家典籍博物馆: "典籍",
  国家自然博物馆: "自然",
  北京孔庙和国子监博物馆: "国子监",
  妙应寺白塔: "白塔寺",
  景德镇中国陶瓷博物馆: "陶瓷",
  高碑店开善寺: "开善寺",
  保利美高梅博物馆: "保利",
  "扬州博物馆 / 中国大运河博物馆": "扬州",
  广东海上丝绸之路博物馆: "南海一号",
  南昌汉代海昏侯国遗址博物馆: "海昏侯",
  "中山古城遗址·中山国王陵陈列馆": "中山国",
  重庆中国三峡博物馆: "三峡",
  明十三陵定陵博物馆: "十三陵",
  民族文化宫博物馆: "民族宫",
  北京文博交流馆: "智化寺",
  承德避暑山庄博物院: "避暑山庄",
  敦煌莫高窟: "莫高窟",
  洛阳古代艺术博物馆: "古墓",
  天坛公园: "天坛",
  太原北齐壁画博物馆: "北齐壁画",
  二里头夏都遗址博物馆: "二里头",
  陈家祠广东民间工艺博物馆: "陈家祠",
  应县木塔: "应县木塔",
  香港历史博物馆: "港历博",
  沈阳故宫博物院: "沈阳故宫",
}

const PLACE_PREFIXES = ["正定", "蓟州", "义县", "涞源", "宝坻", "应县", "曲阜", "扶风", "临潼", "广东"]

/** The text carved on a museum's seal: 2–4 characters. */
export function sealText(name: string, city?: string | null): string {
  const base = name.replace(/[（(].*?[)）]/g, "").trim()
  if (SEAL_OVERRIDES[base]) return SEAL_OVERRIDES[base]!
  const prov = base.match(/^(内蒙古|黑龙江|.{2})(?:省|自治区|壮族自治区|回族自治区|维吾尔自治区)?(?:博物馆|博物院)$/)
  if (prov && PROVINCE_ABBR[prov[1]!]) return PROVINCE_ABBR[prov[1]!] + "博"
  let core = base
    .replace(/(遗址博物馆|遗址博物院|博物馆|博物院|纪念馆|陈列馆|珍宝馆)$/, "")
    .replace(/(遗址|故城|石窟|公园)$/, "")
    .trim()
  // "西安碑林" → "碑林", "南京鸡鸣寺" → "鸡鸣寺" — but a bare city ("洛阳博物馆") keeps its name.
  for (const p of [city, ...PLACE_PREFIXES]) {
    if (!p) continue
    const m = core.match(new RegExp("^" + p + "市?(.{2,})$"))
    if (m) { core = m[1]!; break }
  }
  core = core.replace(/市$/, "").replace(/^(中国|国家)(?=.{2,})/, "")
  const chars = Array.from(core)
  if (chars.length <= 1) return Array.from(base).slice(0, 2).join("")
  return chars.slice(0, 4).join("")
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface SealSpec {
  /** carved text */
  t: string
  /** shape: 0 square, 1 rounded square, 2 circle, 3 oval */
  s: number
  /** 1 = 阴文 (light text on cinnabar), 0 = 阳文 (cinnabar text, outlined) */
  y: number
  /** rotation in degrees */
  r: number
}

/** Collector titles by seal count — shared by the app's 集章册, the public profile and the plaza. */
export const COLLECTOR_RANKS: ReadonlyArray<{ at: number; title: string }> = [
  { at: 0, title: "初入展厅" },
  { at: 1, title: "持证观众" },
  { at: 5, title: "博物馆常客" },
  { at: 10, title: "时空旅人" },
  { at: 20, title: "文博行者" },
  { at: 40, title: "地层考古家" },
  { at: 70, title: "镇馆之宝级" },
]

export function collectorRank(n: number): { title: string; next: { at: number; title: string } | null } {
  let cur = COLLECTOR_RANKS[0]!
  let next: { at: number; title: string } | null = null
  for (const r of COLLECTOR_RANKS) {
    if (n >= r.at) cur = r
    else { next = r; break }
  }
  return { title: cur.title, next }
}

/** Server-side twin of the client's sealHtml() — same markup, styled by .seal in theme.ts. */
export function sealMarkup(seal: SealSpec, extraCls = ""): string {
  const chars = Array.from(seal.t)
  const shape = ["sq", "rd", "ci", "ov"][seal.s] ?? "sq"
  const cls = `seal seal-${shape} seal-n${Math.min(4, chars.length)} ${seal.y ? "seal-yin" : "seal-yang"}${extraCls ? " " + extraCls : ""}`
  const text = seal.t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return `<span class="${cls}" style="--r:${seal.r}deg"><span class="seal-t">${text}</span></span>`
}

export function sealSpec(id: string, name: string, city?: string | null): SealSpec {
  const t = sealText(name, city)
  const h = hash(id)
  const len = Array.from(t).length
  // 4-character seals read best square; circles suit 2–3 characters.
  const shapes = len >= 4 ? [0, 1, 0, 1] : [0, 1, 2, 3]
  return {
    t,
    s: shapes[h % 4]!,
    y: (h >>> 3) % 3 === 0 ? 0 : 1,
    r: ((h >>> 6) % 15) - 9,
  }
}

const PROVINCES = [
  "北京", "天津", "上海", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江", "江苏", "浙江", "安徽", "福建", "江西",
  "山东", "河南", "湖北", "湖南", "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾",
  "内蒙古", "广西", "西藏", "宁夏", "新疆", "香港", "澳门",
]
/** Addresses that start with a city instead of a province. Extend when a new museum fails the data test. */
const CITY_PROVINCE: Record<string, string> = {
  南京: "江苏", 苏州: "江苏", 扬州: "江苏", 徐州: "江苏", 杭州: "浙江", 广州: "广东", 佛山: "广东",
  西安: "陕西", 洛阳: "河南", 成都: "四川", 武汉: "湖北", 长沙: "湖南", 济南: "山东", 太原: "山西",
  大同: "山西", 沈阳: "辽宁", 兰州: "甘肃", 福州: "福建", 泉州: "福建",
}

/** "河南省洛阳市…" → "河南"; "南京市玄武区…" → "江苏"; "香港九龙…" → "香港". */
export function deriveProvince(location: string | null | undefined): string | null {
  if (!location) return null
  const loc = location.replace(/^中国/, "").replace(/^[^：:]{2,12}[：:]/, "").trim()
  for (const p of PROVINCES) if (loc.startsWith(p)) return p
  const city = deriveCity(loc)
  if (city && CITY_PROVINCE[city]) return CITY_PROVINCE[city]
  for (const [c, p] of Object.entries(CITY_PROVINCE)) if (loc.startsWith(c)) return p
  return null
}
