// Server-side pinyin annotator. Bundled into the Worker so we can attach
// pinyin (full + initials) to each museum at SSR time. Client then does
// plain substring match — no client-side pinyin lib needed.
import { pinyin } from "pinyin-pro"

export interface Pinyinable {
  name: string
}

export interface PinyinAnnotation {
  pinyin: string
  pinyinInitials: string
}

export function annotate<T extends Pinyinable>(item: T): T & PinyinAnnotation {
  const name = item.name || ""
  // Strip parens content for cleaner matching ("故宫博物院（北京）" → 故宫博物院)
  const clean = name.replace(/[（(][^)）]*[)）]/g, "").trim() || name
  const full = pinyin(clean, { toneType: "none", type: "string", separator: "" })
  const initials = pinyin(clean, { pattern: "first", toneType: "none", type: "string", separator: "" })
  return {
    ...item,
    pinyin: full.toLowerCase(),
    pinyinInitials: initials.toLowerCase(),
  }
}

export function annotateAll<T extends Pinyinable>(items: T[]): Array<T & PinyinAnnotation> {
  return items.map(annotate)
}
