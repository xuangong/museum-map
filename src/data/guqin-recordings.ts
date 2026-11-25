/**
 * 听原曲 — real guqin performances behind 奏一曲's quotes, one 50 s excerpt per era.
 *
 * All four are by Charlie Huang on Wikimedia Commons, licensed CC BY / CC BY-SA (NOT public
 * domain — attribution is required wherever they play). Excerpts: the opening 50 s, mono,
 * faded in 1 s / out 3 s, loudness-normalised to −20 LUFS, 96 kbps MP3; stored in the R2
 * bucket and served by /img/<key> (key = name + first 16 hex of the file sha256).
 *
 * `kind`: "original" = the very piece 奏一曲 quotes for that era (same source score);
 *         "contemporary" = a piece of that era where the quoted one has no free recording.
 */
export interface GuqinRecording {
  piece: string
  kind: "original" | "contemporary"
  /** where the score comes from / who it is attributed to */
  about: string
  src: string
  performer: string
  license: string
  commons: string
}

export const GUQIN_RECORDINGS: Record<string, GuqinRecording> = {
  "eastern-zhou": {
    piece: "流水",
    kind: "original",
    about: "据《天闻阁琴谱》（1876），川派",
    src: "/img/guqin-liu-shui-5fafefb174717fa3.mp3",
    performer: "Charlie Huang",
    license: "CC BY 2.5",
    commons: "https://commons.wikimedia.org/wiki/File:Liu_Shui.ogg",
  },
  "three-kingdoms": {
    piece: "酒狂",
    kind: "contemporary",
    about: "相传阮籍作，与嵇康《广陵散》同出竹林 · 据《神奇秘谱》（1425）",
    src: "/img/guqin-jiu-kuang-5d4793f3dcac1338.mp3",
    performer: "Charlie Huang",
    license: "CC BY 2.5",
    commons: "https://commons.wikimedia.org/wiki/File:Jiu_Kuang.ogg",
  },
  tang: {
    piece: "阳关三叠",
    kind: "original",
    about: "王维诗谱成的琴曲 · 据《琴学入门》（1867）",
    src: "/img/guqin-yangguan-sandie-7fcc562a334ed9bd.mp3",
    performer: "Charlie Huang",
    license: "CC BY-SA 3.0",
    commons: "https://commons.wikimedia.org/wiki/File:Guqin-Yangguan_Sandie.ogg",
  },
  ming: {
    piece: "平沙落雁",
    kind: "original",
    about: "据《蕉庵琴谱》",
    src: "/img/guqin-pingsha-luoyan-ea1854ba409ac88e.mp3",
    performer: "Charlie Huang",
    license: "CC BY 2.5",
    commons: "https://commons.wikimedia.org/wiki/File:Pingsha_Luoyan.ogg",
  },
}
