import { describe, it, expect } from "bun:test"
import {
  ganzhi, numZh, eraShort, seasonOf, SEASON_LINES, chinaNow, colophon, titleSlip, tuneYinshou, pageTitle, museumList,
} from "~/services/scroll-text"

describe("scroll-text", () => {
  it("干支", () => {
    expect(ganzhi(2024)).toBe("甲辰")
    expect(ganzhi(2025)).toBe("乙巳")
    expect(ganzhi(2026)).toBe("丙午")
    expect(ganzhi(1984)).toBe("甲子")
  })
  it("汉字数字", () => {
    expect(numZh(0)).toBe("零")
    expect(numZh(3)).toBe("三")
    expect(numZh(10)).toBe("十")
    expect(numZh(14)).toBe("十四")
    expect(numZh(20)).toBe("二十")
    expect(numZh(37)).toBe("三十七")
    expect(numZh(129)).toBe("一百二十九")
    expect(numZh(105)).toBe("一百零五")
  })
  it("era short names", () => {
    expect(eraShort("唐朝（公元618年—907年）")).toBe("唐")
    expect(eraShort("东周：春秋与战国（公元前770年—前221年）")).toBe("东周")
    expect(eraShort("远古与新石器时代（约公元前10000年—前2070年）")).toBe("新石器")
    expect(eraShort("五代十国（公元907年—960年）")).toBe("五代十国")
    expect(eraShort("西汉（公元前202年—公元9年）")).toBe("西汉")
  })
  it("season from 节气", () => {
    expect(seasonOf("立春")).toBe("春")
    expect(seasonOf("谷雨")).toBe("春")
    expect(seasonOf("大暑")).toBe("夏")
    expect(seasonOf("霜降")).toBe("秋")
    expect(seasonOf("立冬")).toBe("冬")
    expect(seasonOf("小寒")).toBe("冬")
    expect(SEASON_LINES.冬.text).toBe("晚来天欲雪，能饮一杯无")
    expect(SEASON_LINES.冬.src).toBe("白居易《问刘十九》")
  })
  it("chinaNow uses Beijing time", () => {
    // 2026-12-31 20:00 UTC is 2027-01-01 04:00 in Beijing
    const r = chinaNow(new Date(Date.UTC(2026, 11, 31, 20)))
    expect(r.ganzhi).toBe("丁未")
  })
  it("museum list shortens past three", () => {
    expect(museumList(["殷墟", "二里头"])).toBe("殷墟、二里头")
    expect(museumList(["殷墟", "二里头", "郑州", "偃师", "安阳"])).toBe("殷墟、二里头等五馆")
  })
  it("colophons", () => {
    const at = { ganzhi: "丙午", term: "立冬" }
    expect(colophon({ kind: "tune", ...at, name: "小明", museums: 14, eras: ["西汉", "唐", "宋"] }))
      .toBe("丙午年立冬，小明以十四馆之印，奏西汉、唐、宋三代之音。")
    expect(colophon({ kind: "tune", ...at, name: "小明", museums: 14, eras: Array(17).fill("唐") }))
      .toBe("丙午年立冬，小明以十四馆之印，奏十七代之音。")
    expect(colophon({ kind: "voyage", ...at, name: "小明", layers: 20 }))
      .toBe("丙午年立冬，小明溯洄而上，自今及于新石器，所过二十层。")
    expect(colophon({ kind: "seal", ...at, name: "小明", museumNames: ["殷墟", "二里头", "郑州"], achName: "三代之源" }))
      .toBe("丙午年立冬，小明集殷墟、二里头、郑州之印，得「三代之源」。")
    expect(colophon({ kind: "scroll", ...at, name: "小明", museums: 14, layers: 20 }))
      .toBe("丙午年立冬，小明集十四馆之印，叠为二十层。")
    expect(colophon({ kind: "voyage", ...at, name: "小明", layers: 0 }))
      .toBe("丙午年立冬，小明溯洄而上，自今及于新石器。")
  })
  it("title slips", () => {
    expect(titleSlip({ kind: "tune", eras: ["唐", "宋", "明"] })).toBe("唐宋明三代合奏")
    expect(titleSlip({ kind: "tune", eras: ["西汉", "唐", "宋"] })).toBe("西汉·唐·宋三代合奏")
    expect(titleSlip({ kind: "tune", eras: Array(17).fill("唐") })).toBe("十七代合奏")
    expect(titleSlip({ kind: "tune", eras: [] })).toBe("百代合奏")
    expect(titleSlip({ kind: "voyage" })).toBe("溯洄图卷")
    expect(titleSlip({ kind: "seal", achName: "三代之源" })).toBe("三代之源")
    expect(titleSlip({ kind: "scroll", name: "小明" })).toBe("小明的长卷")
  })
  it("tune 引首 is picked by seed from the 遗音 set", () => {
    expect(["百代遗音", "金石之声", "丝竹余韵", "弦上千年"]).toContain(tuneYinshou(12345))
    expect(tuneYinshou(0)).toBe("百代遗音")
    expect(tuneYinshou(5)).toBe("金石之声")
  })
  it("page title", () => {
    expect(pageTitle("小明", "汉唐遗音")).toBe("小明寄来一卷 ·《汉唐遗音》")
  })
})
