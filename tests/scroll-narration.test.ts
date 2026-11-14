import { describe, it, expect } from "bun:test"
import { buildScroll } from "~/services/scroll-narration"

const dynasties: any[] = [
  { id: "neolithic", name: "远古与新石器时代（约公元前10000年—前2070年）", period: "约公元前10000年—前2070年", events: [], culture: [], recommendedMuseums: [{ museumId: "henan" }] },
  { id: "eastern-zhou", name: "东周：春秋与战国（公元前770年—前221年）", period: "公元前770年—前221年",
    events: [{ date: "前770年", event: "平王东迁洛邑" }], culture: [{ category: "百家争鸣", description: "诸子并起" }], recommendedMuseums: [{ museumId: "hubei" }] },
  { id: "tang", name: "唐朝（公元618年—907年）", period: "公元618年—907年",
    events: [{ date: "618年", event: "李渊建唐，定都长安" }], culture: [{ category: "唐诗", description: "中国古典诗歌的巅峰" }],
    recommendedMuseums: [{ museumId: "shaanxi" }], relatedMuseums: [{ museumId: "guobo" }] },
]
const museums: any[] = [
  { id: "henan", name: "河南博物院" }, { id: "hubei", name: "湖北省博物馆" },
  { id: "shaanxi", name: "陕西历史博物馆" }, { id: "guobo", name: "中国国家博物馆" },
]
const at = { ganzhi: "丙午", term: "立冬" }

describe("buildScroll", () => {
  it("tune: eras played, instruments with their source object, 名曲 with provenance", () => {
    const s = buildScroll({ kind: "tune", payload: { name: "小明", visitedIds: ["hubei", "shaanxi"], seed: 5, era: null, ...at } }, { museums, dynasties })
    expect(s.slip).toBe("东周·唐二代合奏")
    expect(s.yinshou).toBe("金石之声")
    expect(s.colophon).toBe("丙午年立冬，小明以二馆之印，奏东周、唐二代之音。")
    const zhou = s.notes.find((n) => n.dynastyId === "eastern-zhou")!
    expect(zhou.title).toBe("东周")
    expect(zhou.lines[0]).toBe("编钟 · 声取自湖北省博物馆「曾侯乙编钟」")
    expect(zhou.tunes[0]).toEqual({ name: "高山流水", story: "伯牙鼓琴，钟子期知音（《列子·汤问》）", from: "今所奏出自明《神奇秘谱》" })
    expect(s.notes.map((n) => n.dynastyId)).toEqual(["eastern-zhou", "tang"]) // only eras with stamps, old → new
    expect(s.seals.map((x) => x.name)).toEqual(["湖北省博物馆", "陕西历史博物馆"])
  })
  it("tune: lyrics-only tunes say so honestly", () => {
    const s = buildScroll({ kind: "tune", payload: { name: "小明", visitedIds: [], seed: 0, era: null, ...at } },
      { museums, dynasties: [{ id: "nanbeichao", name: "南北朝（公元420年—589年）", period: "", events: [], culture: [] }] as any })
    // no stamps → every era plays; 敕勒歌 is 仅存歌词
    const nb = s.notes.find((n) => n.dynastyId === "nanbeichao")!
    expect(nb.tunes[0]!.from).toBe("曲调已失传，仅存歌词")
  })
  it("voyage: one event, one culture line, capital, where you saw it; new → old", () => {
    const s = buildScroll({ kind: "voyage", payload: { name: "小明", visitedIds: ["shaanxi", "guobo"], ...at } }, { museums, dynasties })
    expect(s.slip).toBe("溯洄图卷")
    expect(s.yinshou).toBe("溯洄从之")
    expect(s.notes.map((n) => n.dynastyId)).toEqual(["tang", "eastern-zhou", "neolithic"])
    const tang = s.notes[0]!
    expect(tang.lines).toContain("618年 · 李渊建唐，定都长安")
    expect(tang.lines).toContain("唐诗 · 中国古典诗歌的巅峰")
    expect(tang.lines.some((l) => l.startsWith("都城 · "))).toBe(true)
    expect(tang.seen).toBe("TA 在 陕西历史博物馆、中国国家博物馆 见过这一层")
    expect(s.colophon).toBe("丙午年立冬，小明溯洄而上，自今及于新石器，所过一层。")
  })
  it("seal: 展签, 所见, colophon", () => {
    const s = buildScroll({ kind: "seal", payload: { name: "小明", visitedIds: ["yungang", "longmen", "mogao"], achId: "theme-shiku", ...at } },
      { museums: [{ id: "yungang", name: "云冈石窟" }, { id: "longmen", name: "龙门石窟" }, { id: "mogao", name: "莫高窟" }] as any, dynasties })
    expect(s.slip).toBe("石窟寺")
    expect(s.yinshou).toBe("佛光东渐")
    expect(s.seal?.labelTitle).toBe("佛像的脸，是怎么一点点变成中国人的脸的")
    expect(s.seal?.label.length).toBeGreaterThan(20)
    expect(s.seal?.seen).toEqual(["云冈石窟", "龙门石窟", "莫高窟"])
    expect(s.colophon).toBe("丙午年立冬，小明集云冈石窟、龙门石窟、莫高窟之印，得「石窟寺」。")
  })
  it("scroll: 长卷", () => {
    const s = buildScroll({ kind: "scroll", payload: { name: "小明", visitedIds: ["hubei", "shaanxi", "guobo"], ...at } }, { museums, dynasties })
    expect(s.slip).toBe("小明的长卷")
    expect(s.yinshou).toBe("平生所见")
    expect(s.colophon).toBe("丙午年立冬，小明集三馆之印，叠为二层。")
  })
  it("season line and title", () => {
    const s = buildScroll({ kind: "voyage", payload: { name: "小明", visitedIds: [], ...at } }, { museums, dynasties })
    expect(s.season).toEqual({ text: "晚来天欲雪，能饮一杯无", src: "白居易《问刘十九》" })
    expect(s.title).toBe("小明寄来一卷 ·《溯洄从之》")
  })
})
