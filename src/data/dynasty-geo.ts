// Where each dynasty "stood": capitals (and, for the Neolithic, the scattered cultural
// centres — 满天星斗). Hand-curated; coordinates are WGS-84, accurate to a few km,
// which is all the 3D strata view and the 「此地即彼时」 matching need.
//
// `trail` is the ordered path of the political centre inside the dynasty (迁都),
// e.g. 北宋汴京 → 南宋临安. The strata view connects one dynasty's last trail site
// to the next dynasty's first one, so the whole thread shows how the centre of
// Chinese civilisation moved through time. `chains` are parallel centres
// (三国、南北朝) drawn as side threads.

export interface DynastySite {
  name: string
  lat: number
  lng: number
  role: "capital" | "secondary" | "culture"
  note?: string
}

export interface DynastyGeo {
  sites: DynastySite[]
  trail: number[]
  chains?: number[][]
  /** Neolithic: many centres converge into the next dynasty instead of one trail. */
  converge?: boolean
}

export const DYNASTY_GEO: Record<string, DynastyGeo> = {
  neolithic: {
    sites: [
      { name: "半坡（仰韶）", lat: 34.27, lng: 109.05, role: "culture" },
      { name: "陶寺", lat: 35.88, lng: 111.5, role: "culture" },
      { name: "大汶口", lat: 35.97, lng: 117.08, role: "culture" },
      { name: "良渚", lat: 30.4, lng: 119.99, role: "culture" },
      { name: "河姆渡", lat: 30.02, lng: 121.36, role: "culture" },
      { name: "红山", lat: 42.27, lng: 118.96, role: "culture" },
    ],
    trail: [],
    converge: true,
  },
  xia: {
    sites: [{ name: "二里头", lat: 34.7, lng: 112.69, role: "capital", note: "斟鄩" }],
    trail: [0],
  },
  shang: {
    sites: [
      { name: "亳（郑州商城）", lat: 34.76, lng: 113.68, role: "capital" },
      { name: "殷（安阳）", lat: 36.13, lng: 114.31, role: "capital", note: "盘庚迁殷" },
    ],
    trail: [0, 1],
  },
  "western-zhou": {
    sites: [
      { name: "丰镐", lat: 34.23, lng: 108.77, role: "capital" },
      { name: "成周洛邑", lat: 34.67, lng: 112.45, role: "secondary", note: "东都" },
    ],
    trail: [0],
    chains: [[0, 1]],
  },
  "eastern-zhou": {
    sites: [{ name: "洛邑", lat: 34.67, lng: 112.42, role: "capital", note: "平王东迁" }],
    trail: [0],
  },
  qin: {
    sites: [{ name: "咸阳", lat: 34.38, lng: 108.71, role: "capital" }],
    trail: [0],
  },
  "western-han": {
    sites: [{ name: "长安", lat: 34.3, lng: 108.88, role: "capital" }],
    trail: [0],
  },
  "eastern-han": {
    sites: [{ name: "洛阳", lat: 34.72, lng: 112.61, role: "capital" }],
    trail: [0],
  },
  "three-kingdoms": {
    sites: [
      { name: "洛阳（魏）", lat: 34.72, lng: 112.61, role: "capital" },
      { name: "成都（蜀）", lat: 30.66, lng: 104.07, role: "capital" },
      { name: "建业（吴）", lat: 32.05, lng: 118.78, role: "capital" },
    ],
    trail: [0],
    chains: [[0, 1], [0, 2]],
  },
  jin: {
    sites: [
      { name: "洛阳（西晋）", lat: 34.72, lng: 112.61, role: "capital" },
      { name: "建康（东晋）", lat: 32.05, lng: 118.78, role: "capital", note: "衣冠南渡" },
    ],
    trail: [0, 1],
  },
  nanbeichao: {
    sites: [
      { name: "建康（南朝）", lat: 32.05, lng: 118.78, role: "capital" },
      { name: "平城（北魏）", lat: 40.08, lng: 113.3, role: "capital" },
      { name: "洛阳（北魏）", lat: 34.72, lng: 112.61, role: "capital", note: "孝文帝迁都" },
      { name: "邺（东魏·北齐）", lat: 36.33, lng: 114.47, role: "capital" },
      { name: "长安（西魏·北周）", lat: 34.3, lng: 108.88, role: "capital" },
    ],
    trail: [0, 4],
    chains: [[1, 2, 3], [2, 4]],
  },
  sui: {
    sites: [
      { name: "大兴（长安）", lat: 34.26, lng: 108.94, role: "capital" },
      { name: "东都洛阳", lat: 34.62, lng: 112.45, role: "secondary" },
    ],
    trail: [0],
    chains: [[0, 1]],
  },
  tang: {
    sites: [
      { name: "长安", lat: 34.26, lng: 108.94, role: "capital" },
      { name: "东都洛阳", lat: 34.62, lng: 112.45, role: "secondary" },
    ],
    trail: [0],
    chains: [[0, 1]],
  },
  wudai: {
    sites: [
      { name: "汴梁（开封）", lat: 34.79, lng: 114.31, role: "capital" },
      { name: "洛阳（后唐）", lat: 34.62, lng: 112.45, role: "secondary" },
    ],
    trail: [0],
    chains: [[1, 0]],
  },
  song: {
    sites: [
      { name: "东京汴梁", lat: 34.79, lng: 114.31, role: "capital" },
      { name: "临安（杭州）", lat: 30.25, lng: 120.16, role: "capital", note: "宋室南渡" },
    ],
    trail: [0, 1],
  },
  liao: {
    sites: [
      { name: "上京临潢府", lat: 43.98, lng: 119.39, role: "capital" },
      { name: "南京析津府（北京）", lat: 39.88, lng: 116.35, role: "secondary" },
    ],
    trail: [0],
    chains: [[0, 1]],
  },
  "jin-jurchen": {
    sites: [
      { name: "上京会宁府", lat: 45.51, lng: 126.96, role: "capital" },
      { name: "中都（北京）", lat: 39.87, lng: 116.33, role: "capital", note: "海陵王迁都" },
    ],
    trail: [0, 1],
  },
  yuan: {
    sites: [
      { name: "大都（北京）", lat: 39.95, lng: 116.4, role: "capital" },
      { name: "上都", lat: 42.36, lng: 116.18, role: "secondary" },
    ],
    trail: [0],
    chains: [[1, 0]],
  },
  ming: {
    sites: [
      { name: "应天（南京）", lat: 32.04, lng: 118.8, role: "capital" },
      { name: "顺天（北京）", lat: 39.91, lng: 116.39, role: "capital", note: "永乐迁都" },
    ],
    trail: [0, 1],
  },
  qing: {
    sites: [
      { name: "盛京（沈阳）", lat: 41.8, lng: 123.45, role: "capital" },
      { name: "北京", lat: 39.91, lng: 116.39, role: "capital" },
    ],
    trail: [0, 1],
  },
}
