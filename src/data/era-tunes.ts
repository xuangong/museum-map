/**
 * The famous pieces (名曲) each stratum is remembered by, shown while 奏一曲 plays that era.
 *
 * Names and stories only — most of these melodies survive in much later scores (the "from"
 * field), and only tunes with verified notation are actually played (QUOTES in
 * src/ui/client/strata.ts). List follows 「中国古代十大名曲」 (《作家》2008年第4期, via 人教数字教育),
 * with stories checked against their classical sources; 广陵散 is placed under 三国 because
 * 嵇康 was executed in 262, before the 晋 (the article says 西晋).
 */
export interface EraTune {
  name: string
  story: string
  /** Where the version played today comes from. */
  from: string
}

export const ERA_TUNES: Record<string, EraTune[]> = {
  "eastern-zhou": [
    { name: "高山流水", story: "伯牙鼓琴，钟子期知音（《列子·汤问》）", from: "明《神奇秘谱》" },
    { name: "阳春白雪", story: "宋玉答楚王：曲高和寡", from: "后世琵琶谱" },
  ],
  "western-han": [
    { name: "十面埋伏", story: "楚汉垓下之战", from: "清代琵琶谱" },
    { name: "汉宫秋月", story: "汉宫秋夜，宫女的幽怨", from: "后世流传" },
  ],
  "eastern-han": [{ name: "胡笳十八拍", story: "蔡文姬归汉，与二子诀别", from: "明代琴谱" }],
  "three-kingdoms": [{ name: "广陵散", story: "嵇康临刑索琴：「广陵散于今绝矣」（《晋书》）", from: "明《神奇秘谱》" }],
  jin: [{ name: "梅花三弄", story: "桓伊为王徽之吹笛三调，客主不交一言（《晋书》）", from: "明《神奇秘谱》" }],
  tang: [{ name: "夕阳箫鼓", story: "又名《春江花月夜》，意境出自张若虚同名诗", from: "清代琵琶谱" }],
  ming: [
    { name: "平沙落雁", story: "借鸿鹄之远志，写逸士之心胸", from: "明代琴谱" },
    { name: "渔樵问答", story: "渔樵江渚，看淡古今", from: "明代琴谱" },
  ],
  qing: [{ name: "茉莉花", story: "江南鲜花调，清代传唱至今", from: "清代" }],
}
