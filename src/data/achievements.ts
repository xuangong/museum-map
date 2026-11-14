// 打卡成就 — the catalog. Design and rules: docs/superpowers/specs/打卡成就.md.
// line: theme (专题收集) · region (区域) · era (朝代). Levels: 1 = 达成, 2 = 圆满.

export type Member = { museum: string } | { city: string }

export interface Achievement {
  id: string
  line: "theme" | "region" | "era"
  name: string
  seal: string
  hook: string
  why: string
  /** Title of the 展签 (the text itself is in achievement-labels.ts). */
  labelTitle: string
  /** Planned sound (not implemented in this phase). */
  sound: string
  // theme
  members?: Member[]
  reach?: number
  // region: a 大区 (provinces) — level 1 on the first visit, level 2 when every province with museums is visited
  provinces?: string[]
  // region milestone: share of all provinces that have museums (1/3, 2/3, 1)
  share?: number
  // era: a segment of layers [from, to] (1-based, inclusive) — every layer needs one visited museum
  layers?: [number, number]
  // era: longest run of consecutive layers ≥ chain
  chain?: number
}

const M = (museum: string): Member => ({ museum })
const C = (city: string): Member => ({ city })

export const REGIONS = [
  { id: "region-huabei", provinces: ["北京", "天津", "河北", "山西", "内蒙古"] },
  { id: "region-dongbei", provinces: ["辽宁", "吉林", "黑龙江"] },
  { id: "region-huadong", provinces: ["上海", "江苏", "浙江", "安徽", "福建", "江西", "山东"] },
  { id: "region-huazhong", provinces: ["河南", "湖北", "湖南"] },
  { id: "region-huanan", provinces: ["广东", "广西", "海南"] },
  { id: "region-xinan", provinces: ["四川", "重庆", "贵州", "云南", "西藏"] },
  { id: "region-xibei", provinces: ["陕西", "甘肃", "青海", "宁夏", "新疆"] },
  { id: "region-gangaotai", provinces: ["香港", "澳门", "台湾"] },
]
const prov = (id: string) => REGIONS.find((r) => r.id === id)!.provinces

export const ACHIEVEMENTS: Achievement[] = [
  // ── 专题收集 ──
  { id: "theme-shiku", line: "theme", name: "石窟寺", seal: "石窟", reach: 3,
    members: [M("yungang"), M("longmen"), M("mogao"), M("6312bdbd-cc07-456a-a5d0-472e502a5154")],
    hook: "佛教东传，一路凿进山里。",
    why: "四处石窟跨了一千年、三种风格：云冈的雄浑、龙门的秀骨清像、北齐的丰圆。连起来看，是一种外来艺术怎样变成中国的。",
    labelTitle: "佛像的脸，是怎么一点点变成中国人的脸的", sound: "磬" },
  { id: "theme-qiandu", line: "theme", name: "从平城到洛阳", seal: "迁都", reach: 4,
    members: [M("shanxi-datong"), M("yungang"), M("hanwei-luoyang"), M("longmen")],
    hook: "公元 494 年，北魏把都城从大同搬到了洛阳。",
    why: "一次迁都，四个地点：前后两座都城、两处皇家石窟，正好成对。走完，就是走了一遍孝文帝的改革。",
    labelTitle: "孝文帝为什么要迁都，云冈和龙门的佛像为什么换了衣服", sound: "胡笳转入琴" },
  { id: "theme-gudu", line: "theme", name: "七大古都", seal: "古都", reach: 5,
    members: [C("西安"), C("洛阳"), C("南京"), C("北京"), C("开封"), C("杭州"), C("安阳")],
    hook: "中国古都的主干，七座城。",
    why: "这七座城加起来，覆盖了从商到清的大半部都城史，每一座都当过某个时代的中心。",
    labelTitle: "都城为什么一路从西往东、从北往南挪", sound: "晨钟暮鼓" },
  { id: "theme-sandai", line: "theme", name: "三代之源", seal: "三代", reach: 4,
    members: [M("erlitou"), M("yinxu"), M("wenzi"), M("4dc89822-84e4-4b0a-91dd-798aa762981b"), M("054543c3-1850-471d-be28-e611f77ba9c4")],
    hook: "夏都、商都、甲骨文，还有周人起家的地方。",
    why: "「最早的中国」从哪里来？这五座馆是最直接的现场。",
    labelTitle: "从二里头的绿松石龙，到何尊上的「宅兹中国」", sound: "陶埙" },
  { id: "theme-gushu", line: "theme", name: "古蜀文明", seal: "古蜀", reach: 4,
    members: [M("sanxingdui"), M("jinsha"), M("sichuan"), M("chengdu")],
    hook: "三星堆之后，古蜀人去了哪里？",
    why: "三星堆和金沙是同一个文明的前后两段，连起来才是完整的古蜀。",
    labelTitle: "从青铜纵目面具到太阳神鸟", sound: "青铜铃" },
  { id: "theme-diling", line: "theme", name: "帝王陵寝", seal: "帝陵", reach: 4,
    members: [M("bingmayong"), M("8d05e910-ec8f-4d99-8cba-140f10bd9ef2"), M("b27bc4cc-0ca1-4cf9-a934-9370b40c0732"),
      M("817569a4-234c-46ce-9bcd-89ef8f271011"), M("ebd9f374-6925-48ef-a456-13e0fd61fcd4"), M("c9b31e6a-c677-468d-913e-ce8f400f459a")],
    hook: "从秦到明，皇帝怎么安排自己的身后事。",
    why: "陵墓是一个朝代最舍得花钱的工程。从陶俑大军到无字碑，看得见每个时代的世界观。",
    labelTitle: "从「事死如事生」到明朝的地宫", sound: "大鼓" },
  { id: "theme-liaogou", line: "theme", name: "辽代木构", seal: "辽构", reach: 5,
    members: [M("dulesi"), M("ef6658c6-03b4-4edb-98ca-e19523bdaaa7"), M("fengguosi"), M("9b3cf4df-a9f9-42b7-9418-adc2560c13c5"),
      M("shanhuasi"), M("geyuansi"), M("guangjisi-baodi"), M("kaishansi")],
    hook: "梁思成一座座找到的，千年的木头房子。",
    why: "中国现存最早的木构建筑，多数是辽代的，散在京津冀晋辽的县城里。集齐它们，等于重走一遍营造学社的考察路线。",
    labelTitle: "1932 年，梁思成在蓟县看到了独乐寺", sound: "风铎" },
  { id: "theme-qingtong", line: "theme", name: "青铜时代", seal: "青铜", reach: 5,
    members: [M("054543c3-1850-471d-be28-e611f77ba9c4"), M("52857eb0-ccb7-46af-a887-79501e299e42"), M("hubei"), M("yinxu"),
      M("shanghai"), M("sanxingdui"), M("zhongshanguo")],
    hook: "礼器、编钟、神树，各有各的青铜。",
    why: "中原的礼器、楚地的编钟、古蜀的神像、中山国的错金银——同一种金属，四种审美。",
    labelTitle: "青铜为什么没做成农具，而是做成了礼器", sound: "编钟（真声）" },
  { id: "theme-silu", line: "theme", name: "陆上丝路", seal: "丝路", reach: 4,
    members: [M("shaanxi"), M("gansu"), M("mogao"), M("xinjiang"), M("qinghai"), M("ningxia")],
    hook: "从长安出发，一路向西。",
    why: "起点、河西走廊、敦煌、西域，再加上唐蕃古道和西夏——一条路上的六个路口。",
    labelTitle: "铜奔马、胡商俑，和一封写给家里的信", sound: "驼铃 · 琵琶" },
  { id: "theme-haisi", line: "theme", name: "海上丝路", seal: "海丝", reach: 4,
    members: [M("quanzhou"), M("nanhai"), M("guangdong"), M("fujian"), M("hainan"), M("macau-museum")],
    hook: "宋元时期，世界最大的港口在泉州。",
    why: "从港口到沉船，再到水下考古。海上的那条路，比陆上的更少人知道。",
    labelTitle: "南海一号沉没时，船上装着什么、要去哪里", sound: "海螺号" },
  { id: "theme-ci", line: "theme", name: "瓷之路", seal: "瓷", reach: 4,
    members: [M("jingdezhen"), M("1f59db8a-b242-494f-aba4-7f02ed14f48c"), M("dingzhou"), M("nanhai"), M("jiangxi")],
    hook: "从窑口到御窑，再到一整船出海。",
    why: "定窑、官窑、景德镇，再到沉船里成摞的瓷器——从烧出来到运出去的全过程。",
    labelTitle: "「china」这个词是怎么来的", sound: "瓷瓯" },
  { id: "theme-zhuhouwang", line: "theme", name: "汉代诸侯王", seal: "王侯", reach: 4,
    members: [M("nanyue"), M("haihunhou"), M("xuzhou"), M("hebei"), M("hunan"), M("dingzhou")],
    hook: "天子之外，各地诸侯王的地下世界。",
    why: "金缕玉衣、马王堆帛画、海昏侯的金饼。天子的陵很少发掘，诸侯王墓才是了解汉代贵族生活的窗口。",
    labelTitle: "当了 27 天皇帝的海昏侯，带走了什么", sound: "瑟" },
  { id: "theme-sanguo", line: "theme", name: "三国鼎立", seal: "三国", reach: 3,
    members: [M("232d4da5-550c-49eb-89e0-042c913657c8"), M("jiangsu"), M("hanwei-luoyang")],
    hook: "魏、蜀、吴，各去一处。",
    why: "三国是最多人熟悉的一段历史，却很少有人真的把三家都去一遍。",
    labelTitle: "小说之外，三国真正留下了什么", sound: "琴" },
  { id: "theme-beichao", line: "theme", name: "北朝风华", seal: "北朝", reach: 4,
    members: [M("311c5f1f-d67d-4e79-a891-253baced913b"), M("6312bdbd-cc07-456a-a5d0-472e502a5154"), M("cixian-beichao"),
      M("qingzhou"), M("shanxi-datong"), M("yungang")],
    hook: "被低估的北朝艺术。",
    why: "北齐的壁画、青州的微笑佛，是隋唐之前最有个性的一段艺术，很多人没听说过。",
    labelTitle: "青州龙兴寺那一窖佛像，是怎么被埋、又怎么被找到的", sound: "曲项琵琶" },
  { id: "theme-huangjia", line: "theme", name: "明清皇家", seal: "皇家", reach: 5,
    members: [M("gugong"), M("shenyang-gugong"), M("799daa55-94c0-4ef7-bdf8-21cff39e6c6b"), M("40b9932c-a873-4aa4-85fe-392abe12ef50"),
      M("706747f5-3e5a-4883-ad52-67c7169d70fc"), M("bfd76fa2-1343-4649-91f0-a8bcc3b0b690"), M("taipei-gugong")],
    hook: "宫殿、园林、坛庙，一个王朝怎么生活。",
    why: "两座故宫，加上台北的那一座，再加夏宫、祭天的地方和一座废墟，就是明清皇家生活的全貌。",
    labelTitle: "同一批文物，为什么分在北京和台北", sound: "编磬" },
  { id: "theme-gucha", line: "theme", name: "古刹", seal: "古刹", reach: 4,
    members: [M("6d90c01d-efe7-45e5-a39a-e28a10298fa2"), M("famensi"), M("2622e024-00eb-4a11-8b65-036b820f89d1"),
      M("d07ca61f-47b5-4b8f-b061-ab0b67017ae9"), M("da80ec30-88cf-4f4f-ae53-1d277f18c96a"), M("2f91b70e-838a-4af4-97f0-5511dad3373c")],
    hook: "从中国第一座官办寺院，到皇家供奉的地宫。",
    why: "白马寺是起点，法门寺地宫是巅峰，智化寺还留着明代的京音乐。寺庙里藏着另一部中国史。",
    labelTitle: "法门寺地宫打开的那天", sound: "云锣 · 木鱼" },
  { id: "theme-shuguang", line: "theme", name: "文明曙光", seal: "曙光", reach: 4,
    members: [M("09fc018e-37d8-4aef-a17c-d9e3c0ac04cc"), M("banpo"), M("liangzhu"), M("anhui"), M("shandong")],
    hook: "文字出现之前的中国。",
    why: "从北京人到良渚古城，人怎样从洞穴走进城市。",
    labelTitle: "良渚玉琮上的神人兽面，是谁", sound: "骨笛" },
  { id: "theme-duoyuan", line: "theme", name: "多元一体", seal: "多元", reach: 6,
    members: [M("xizang"), M("xinjiang"), M("neimenggu"), M("ningxia"), M("yunnan"), M("guizhou"), M("guangxi"), M("jilin"),
      M("heilongjiang"), M("ccb305e9-5097-423f-b188-3314412b9ffd")],
    hook: "中原之外的中国。",
    why: "吐蕃、西夏、古滇、渤海、高句丽……这些名字在课本里一笔带过，在当地是整整一部历史。",
    labelTitle: "「中国」是怎样由许多个中心拼起来的", sound: "铜鼓" },

  // ── 区域 ──
  { id: "region-huabei", line: "region", name: "长城内外", seal: "长城", provinces: prov("region-huabei"),
    hook: "一道长城，两种生活。", why: "农耕和游牧在这里相遇了两千年，长城、都城、草原都在这一片。",
    labelTitle: "长城两边的人，其实一直在来往", sound: "唢呐 · 笙" },
  { id: "region-dongbei", line: "region", name: "白山黑水", seal: "白山", provinces: prov("region-dongbei"),
    hook: "渤海国、金、后金，都从这里起家。", why: "好几个改变了中国的政权从这里出发，往南走进了历史的中心。",
    labelTitle: "从白山黑水到紫禁城", sound: "马头琴" },
  { id: "region-huadong", line: "region", name: "东海之滨", seal: "东海", provinces: prov("region-huadong"),
    hook: "吴越、齐鲁、六朝和宋韵。", why: "孔子的故乡、六朝的金陵、南宋的临安，这里是中国最会过日子的地方。",
    labelTitle: "经济重心为什么一路南移", sound: "二胡" },
  { id: "region-huazhong", line: "region", name: "中原荆楚", seal: "中原", provinces: prov("region-huazhong"),
    hook: "一半的古都，和整个楚文化。", why: "「逐鹿中原」的中原，加上浪漫的楚地，中国历史有一半是在这里写的。",
    labelTitle: "中原和楚，两种中国", sound: "编钟" },
  { id: "region-huanan", line: "region", name: "岭南", seal: "岭南", provinces: prov("region-huanan"),
    hook: "南越国、海丝、广府。", why: "山的那一边自成一体，又最早面向大海。",
    labelTitle: "岭南为什么总是最先看见世界", sound: "高胡" },
  { id: "region-xinan", line: "region", name: "西南万山", seal: "万山", provinces: prov("region-xinan"),
    hook: "古蜀、古滇、夜郎、吐蕃。", why: "崇山峻岭隔出了许多个各自灿烂的文明。",
    labelTitle: "大山里的四个古国", sound: "竹笛 · 三弦" },
  { id: "region-xibei", line: "region", name: "大漠长河", seal: "大漠", provinces: prov("region-xibei"),
    hook: "周秦汉唐的根，丝路的路。", why: "中国最强盛的几个朝代从这里出发，也从这里走向世界。",
    labelTitle: "为什么周秦汉唐都选了关中", sound: "板胡" },
  { id: "region-gangaotai", line: "region", name: "海峡与港湾", seal: "海港", provinces: prov("region-gangaotai"),
    hook: "另一种方式保存下来的中国。", why: "这里的博物馆用不同的眼光讲同一部历史。",
    labelTitle: "离开和回来", sound: "洞箫 · 南音琵琶" },
  { id: "miles-1", line: "region", name: "行万里路 · 一", seal: "万里", share: 1 / 3,
    hook: "走过三分之一的省份。", why: "读万卷书，也要行万里路。三分之一，已经比大多数人走得远。",
    labelTitle: "第一段路", sound: "" },
  { id: "miles-2", line: "region", name: "行万里路 · 二", seal: "万里二", share: 2 / 3,
    hook: "走过三分之二的省份。", why: "大半个中国已经在你的集章册里了。", labelTitle: "第二段路", sound: "" },
  { id: "miles-3", line: "region", name: "行万里路 · 三", seal: "万里三", share: 1,
    hook: "走遍收录里的每一个省份。", why: "从东北到岭南，从东海到大漠，一个不落。", labelTitle: "走遍", sound: "" },

  // ── 朝代 · 断代 ──
  { id: "era-xianqin", line: "era", name: "礼乐之始", seal: "礼乐", layers: [1, 5],
    hook: "从陶罐到青铜鼎，中国的样子是怎么定下来的。", why: "新石器、夏、商、西周、东周，五层地层连在一起，是中国文明的前传。",
    labelTitle: "「礼」到底是什么", sound: "先秦乐章" },
  { id: "era-qinhan", line: "era", name: "大一统", seal: "一统", layers: [6, 8],
    hook: "车同轨、书同文，然后是四百年的汉。", why: "秦定下了框架，两汉把它活成了一个文明。",
    labelTitle: "为什么我们叫「汉」人", sound: "秦汉乐章" },
  { id: "era-weijin", line: "era", name: "魏晋风度", seal: "风度", layers: [9, 11],
    hook: "最乱的时代，最自由的艺术。", why: "三国、两晋、南北朝，四百年分裂，佛像、书法和山水画都在这时长了出来。",
    labelTitle: "乱世里长出来的东西", sound: "魏晋南北朝乐章" },
  { id: "era-suitang", line: "era", name: "盛唐气象", seal: "盛唐", layers: [12, 14],
    hook: "从运河到长安，再到碎成十国。", why: "隋修运河，唐开盛世，五代把它拆开，一整段大起大落。",
    labelTitle: "长安城有多大", sound: "隋唐五代乐章" },
  { id: "era-songyuan", line: "era", name: "宋韵与草原", seal: "宋韵", layers: [15, 18],
    hook: "最精致的宋，和最辽阔的元，同时存在。", why: "宋、辽、金、元并立又更替，是中国最多元的一段。",
    labelTitle: "宋人的生活，比你想的更像现在", sound: "宋辽金元乐章" },
  { id: "era-mingqing", line: "era", name: "最后的帝国", seal: "帝国", layers: [19, 20],
    hook: "紫禁城、长城、大运河，留到今天最多的那一段。", why: "我们今天看到的「古代」，多半是明清的样子。",
    labelTitle: "我们看到的古代，多半是明清", sound: "明清乐章" },
  // ── 朝代 · 连续 ──
  { id: "chain-5", line: "era", name: "连成一段", seal: "一段", chain: 5,
    hook: "五个朝代，一口气连上了。", why: "历史不是一个个孤岛，你已经走出了一段不断的线。", labelTitle: "接上的那一刻", sound: "" },
  { id: "chain-10", line: "era", name: "半部通史", seal: "半部", chain: 10,
    hook: "中国史的一半，没有断过。", why: "十个朝代连在一起，足够看出兴衰的节奏。", labelTitle: "兴衰的节奏", sound: "" },
  { id: "chain-20", line: "era", name: "一脉相承", seal: "相承", chain: 20,
    hook: "从新石器到清，一根弦上没有空着的地方。", why: "二十层地层全部集齐，这是整部历史。", labelTitle: "一脉相承", sound: "大套" },
]
