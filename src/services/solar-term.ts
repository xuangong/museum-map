// Approximate Chinese solar term (二十四节气) for a given date. Uses a fixed
// table per year (2026 only — close enough for poster decoration; actual term
// dates shift ±1 day). Returns the nearest preceding term name + Chinese era
// year string (二〇二六).

const TERMS_2026: Array<{ md: [number, number]; name: string }> = [
  { md: [1, 5], name: "小寒" },
  { md: [1, 20], name: "大寒" },
  { md: [2, 4], name: "立春" },
  { md: [2, 18], name: "雨水" },
  { md: [3, 5], name: "惊蛰" },
  { md: [3, 20], name: "春分" },
  { md: [4, 5], name: "清明" },
  { md: [4, 20], name: "谷雨" },
  { md: [5, 5], name: "立夏" },
  { md: [5, 21], name: "小满" },
  { md: [6, 5], name: "芒种" },
  { md: [6, 21], name: "夏至" },
  { md: [7, 7], name: "小暑" },
  { md: [7, 22], name: "大暑" },
  { md: [8, 7], name: "立秋" },
  { md: [8, 23], name: "处暑" },
  { md: [9, 7], name: "白露" },
  { md: [9, 23], name: "秋分" },
  { md: [10, 8], name: "寒露" },
  { md: [10, 23], name: "霜降" },
  { md: [11, 7], name: "立冬" },
  { md: [11, 22], name: "小雪" },
  { md: [12, 7], name: "大雪" },
  { md: [12, 22], name: "冬至" },
]

const DIGIT_ZH: Record<string, string> = {
  "0": "〇", "1": "一", "2": "二", "3": "三", "4": "四",
  "5": "五", "6": "六", "7": "七", "8": "八", "9": "九",
}

export function chineseYear(year: number): string {
  return String(year).split("").map((d) => DIGIT_ZH[d] ?? d).join("")
}

export function currentSolarTerm(now: Date = new Date()): { name: string; year: number } {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  // For non-2026 years, just use 2026 table (poster decoration, ±day acceptable).
  const table = TERMS_2026
  let last = table[0]!
  for (const t of table) {
    if (t.md[0] < m || (t.md[0] === m && t.md[1] <= d)) last = t
    else break
  }
  return { name: last.name, year: y }
}
