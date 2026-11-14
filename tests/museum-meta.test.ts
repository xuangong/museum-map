import { describe, expect, it } from "bun:test"
import { collectorRank, deriveCity, sealMarkup, sealSpec, COLLECTOR_RANKS } from "~/services/museum-meta"
import { computeCrossings, haversineKm } from "~/services/crossings"
import { rewriteFontCss } from "~/lib/cdn"
import type { DynastyFull } from "~/repo/types"

describe("deriveCity", () => {
  it("reads municipalities, province + city, and city-first addresses", () => {
    expect(deriveCity("北京市东城区东长安街16号")).toBe("北京")
    expect(deriveCity("河南省洛阳市偃师区首阳山街道")).toBe("洛阳")
    expect(deriveCity("南京市玄武区中山东路321号")).toBe("南京")
    expect(deriveCity("山西省朔州市应县老城西北角佛宫寺院内")).toBe("朔州")
    expect(deriveCity(null)).toBeNull()
  })
})

describe("sealSpec / sealMarkup", () => {
  it("uses the abbreviation museum-goers use, and is stable per id", () => {
    const a = sealSpec("guobo", "中国国家博物馆", "北京")
    expect(a.t).toBe("国博")
    expect(sealSpec("guobo", "中国国家博物馆", "北京")).toEqual(a)
    expect([0, 1, 2, 3]).toContain(a.s)
    expect(a.r).toBeGreaterThanOrEqual(-9)
    expect(a.r).toBeLessThanOrEqual(5)
  })

  it("never gives a four-character seal a round shape", () => {
    for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const s = sealSpec(id, "台北故宫博物院", "台北")
      expect(Array.from(s.t)).toHaveLength(4)
      expect([0, 1]).toContain(s.s)
    }
  })

  it("renders the same markup as the client and escapes the text", () => {
    const html = sealMarkup({ t: "<洛>", s: 2, y: 0, r: -4 }, "seal-sm")
    expect(html).toContain('class="seal seal-ci seal-n3 seal-yang seal-sm"')
    expect(html).toContain('style="--r:-4deg"')
    expect(html).toContain("&lt;洛&gt;")
  })
})

describe("collectorRank", () => {
  it("climbs through the titles and reports the next one", () => {
    expect(collectorRank(0).title).toBe(COLLECTOR_RANKS[0]!.title)
    expect(collectorRank(12)).toEqual({ title: "时空旅人", next: { at: 20, title: "文博行者" } })
    expect(collectorRank(500).next).toBeNull()
  })
})

describe("computeCrossings", () => {
  const dyn = (id: string, events: DynastyFull["events"] = [], linked: string[] = []): DynastyFull => ({
    id, name: id, period: null, center: { lat: null, lng: null }, overview: null,
    events, culture: [],
    recommendedMuseums: linked.map((museumId) => ({ museumId, name: museumId, location: null, reason: null })),
    relatedMuseums: [],
  })

  it("puts a museum on the ground of a dynasty's capital", () => {
    // 汉魏洛阳故城遗址博物馆 sits inside the old city — 北魏 capital 洛阳.
    const out = computeCrossings([{ id: "hanwei", lat: 34.7300, lng: 112.6270 }], [dyn("nanbeichao")])
    const c = out.hanwei?.find((x) => x.dynastyId === "nanbeichao")
    expect(c).toBeDefined()
    expect(c!.kind).toBe("capital")
    expect(c!.onSite).toBe(true)
  })

  it("only counts same-area (not on-site) matches for dynasties already linked to the museum", () => {
    const m = { id: "m", lat: 34.62, lng: 112.45 } // ~15 km from 汉魏洛阳故城
    expect(computeCrossings([m], [dyn("nanbeichao")]).m).toBeUndefined()
    const linked = computeCrossings([m], [dyn("nanbeichao", [], ["m"])]).m
    expect(linked?.[0]?.onSite).toBe(false)
  })

  it("matches recorded events by distance", () => {
    const ev = [{ date: "前770年", event: "周平王东迁洛邑", lat: 34.68, lng: 112.45 }]
    const out = computeCrossings([{ id: "m", lat: 34.681, lng: 112.451 }], [dyn("dongzhou-x", ev)])
    expect(out.m?.[0]).toMatchObject({ kind: "event", date: "前770年", onSite: true })
  })

  it("haversineKm is symmetric and roughly right", () => {
    const km = haversineKm(39.9042, 116.4074, 34.3416, 108.9398) // 北京 → 西安
    expect(km).toBeGreaterThan(880)
    expect(km).toBeLessThan(940)
    expect(haversineKm(34.3416, 108.9398, 39.9042, 116.4074)).toBeCloseTo(km, 6)
  })
})

describe("rewriteFontCss", () => {
  it("points font files at the same-origin proxy", () => {
    const css = "src: url(https://fonts.gstatic.com/s/notoserifsc/v36/a.woff2) format('woff2');"
    expect(rewriteFontCss(css)).toBe("src: url(/fonts/g/s/notoserifsc/v36/a.woff2) format('woff2');")
  })
})

import { readdirSync, readFileSync } from "node:fs"
import { deriveProvince } from "~/services/museum-meta"

describe("deriveProvince", () => {
  it("reads the province from common address shapes", () => {
    expect(deriveProvince("河南省洛阳市偃师区翟镇镇")).toBe("河南")
    expect(deriveProvince("北京市东城区景山前街4号")).toBe("北京")
    expect(deriveProvince("广西壮族自治区南宁市青秀区")).toBe("广西")
    expect(deriveProvince("内蒙古自治区呼和浩特市")).toBe("内蒙古")
    expect(deriveProvince("中国河北省承德市双桥区")).toBe("河北")
    expect(deriveProvince("香港九龙尖沙咀漆咸道南100号")).toBe("香港")
    expect(deriveProvince("澳门特别行政区花王堂区")).toBe("澳门")
    expect(deriveProvince("台湾省台北市士林区")).toBe("台湾")
    expect(deriveProvince("南京市玄武区中山东路")).toBe("江苏")
    expect(deriveProvince("扬州博物馆：江苏省扬州市邗江区")).toBe("江苏")
    expect(deriveProvince(null)).toBeNull()
  })

  it("resolves every museum in data/museums", () => {
    const missing: string[] = []
    for (const f of readdirSync("data/museums")) {
      const loc = readFileSync("data/museums/" + f, "utf8").match(/^location: (.*)$/m)?.[1] ?? null
      if (!deriveProvince(loc)) missing.push(f + " → " + loc)
    }
    expect(missing).toEqual([])
  })
})
