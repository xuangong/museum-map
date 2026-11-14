/**
 * The instrument each stratum plays in 奏一曲, and the real object it is drawn from.
 *
 * `src` names an artifact or treasure recorded on one of our museums (data/museums/<id>.yaml),
 * so the tune doubles as an invitation: the sound you hear is on display there.
 * Eras without a recorded instrument carry no `src` and are shown as 示意 — don't invent one;
 * add the artifact to the museum first (scripts/add-artifacts.ts), then point `src` at it.
 * `voice` is a synth patch in src/ui/client/strata.ts (VOICES).
 * tests/era-voices.test.ts checks every `src` against the data.
 */
export interface EraVoice {
  voice: string
  inst: string
  src?: { museumId: string; artifact: string }
}

export const ERA_VOICES: Record<string, EraVoice> = {
  neolithic: { voice: "gudi", inst: "骨笛", src: { museumId: "henan", artifact: "贾湖骨笛" } },
  xia: { voice: "qing", inst: "石磬", src: { museumId: "erlitou", artifact: "石磬" } },
  shang: { voice: "nao", inst: "铙", src: { museumId: "jiangxi", artifact: "商代青铜大铙" } },
  "western-zhou": { voice: "zhong", inst: "编钟", src: { museumId: "shanghai", artifact: "晋侯稣钟" } },
  "eastern-zhou": { voice: "zhong", inst: "编钟", src: { museumId: "hubei", artifact: "曾侯乙编钟" } },
  qin: { voice: "zhu", inst: "筑" },
  "western-han": { voice: "se", inst: "瑟", src: { museumId: "hunan", artifact: "马王堆汉墓乐器（瑟、竽、竽律）" } },
  "eastern-han": { voice: "tonggu", inst: "铜鼓", src: { museumId: "232d4da5-550c-49eb-89e0-042c913657c8", artifact: "东汉四耳蹲蛙青铜鼓" } },
  "three-kingdoms": { voice: "qin", inst: "古琴" },
  jin: { voice: "qin", inst: "古琴", src: { museumId: "nanjing", artifact: "竹林七贤与荣启期砖画" } },
  nanbeichao: { voice: "paixiao", inst: "排箫", src: { museumId: "yungang", artifact: "第12窟\"音乐窟\"" } },
  sui: { voice: "tongqing", inst: "编磬", src: { museumId: "yangzhou", artifact: "隋炀帝墓铜编钟铜编磬" } },
  tang: { voice: "pipa", inst: "琵琶", src: { museumId: "shaanxi", artifact: "唐三彩骆驼载乐俑" } },
  wudai: { voice: "di", inst: "笛", src: { museumId: "gugong", artifact: "韩熙载夜宴图" } },
  song: { voice: "qin", inst: "古琴", src: { museumId: "gugong", artifact: "听琴图" } },
  liao: { voice: "huqin", inst: "胡琴" },
  "jin-jurchen": { voice: "huqin", inst: "胡琴" },
  yuan: { voice: "huqin", inst: "胡琴" },
  ming: { voice: "guan", inst: "管子", src: { museumId: "2f91b70e-838a-4af4-97f0-5511dad3373c", artifact: "九孔管" } },
  qing: { voice: "zhong", inst: "编钟", src: { museumId: "gugong", artifact: "清宫中和韶乐编钟" } },
}
