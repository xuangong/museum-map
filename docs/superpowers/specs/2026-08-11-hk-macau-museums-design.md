# 补充港澳三馆：香港历史博物馆 / 澳门博物馆 / 保利美高梅博物馆

日期：2026-08-11

## 目标

museum-map 现有 94 个馆全部位于内地与台湾，港澳为空白。本次补入三条：

| id | 馆名 | 坐标 (WGS-84) |
|---|---|---|
| `hk-history` | 香港历史博物馆 | 22.3016, 114.1772 |
| `macau` | 澳门博物馆 | 22.1975, 113.5411 |
| `poly-mgm` | 保利美高梅博物馆 | 22.1902, 113.5497 |

内容深度与现有条目（参照 `data/museums/zhongguo-kaogu.yaml`）一致：museums 主表字段 +
treasures / halls / artifacts / dynasty_connections / sources 全套。

## 事实来源

全部取自官网原文，不依赖模型记忆：

- 香港历史博物馆：`hk.history.museum/sc/web/mh/about-us/introduction.html`、
  `.../exhibition/Hong-Kong-Story-main.html`、`.../collections/collections.html`
- 澳门博物馆：`macaumuseum.gov.mo/zh-hans/visit/about-us`、`.../exhibitions/75001`
- 保利美高梅博物馆：`museum.mgm.mo/sc/about/the-museum/`、`.../about/design/`、
  `.../exhibition/silk-roads-beyond-borders/`
- 补充：百度百科 LemmaCardApi（李郑屋汉墓、大炮台）

已核实的关键事实（易错处）：

- 「澳门美高梅博物馆」并非官方名，正式名为**保利美高梅博物馆 Poly MGM Museum**
  （保利文化 × 美高梅合办，澳门美高梅二楼）。
- 澳门博物馆开幕日为 **1998-04-18**（官网），百度百科写的 4 月 19 日不采用。
- 香港历史博物馆现有分馆为 **4 家**（李郑屋汉墓博物馆 / 罗屋民俗馆 / 葛量洪号灭火轮
  展览馆 / 孙中山纪念馆）；百科所载「香港海防博物馆」已独立，不采用。
- 「香港故事」常设展 **2026-04-01 起以全新版本重开**（逾 2,800 件展品、四大篇章），
  不是 2020 年关闭后的旧版。
- 馆藏量以官网 **逾 170,000 件** 为准（百科的 90,000 件为旧数）。

## 各馆内容要点

### hk-history 香港历史博物馆

- level：`香港特区政府康乐及文化事务署辖下综合性历史博物馆（香港规模最大的历史类博物馆）`
- 沿革：1962 大会堂美术博物馆 → 1969 香港博物美术馆 → 1975 分拆为香港艺术馆 + 香港博物馆
  → 1998-07 迁尖沙咀漆咸道南现址（总楼面 17,500㎡，港府拨款 3.9 亿港元，巴马丹拿建筑设计）
  → 1998-04-01 更名香港历史博物馆 → 2026-04-01「香港故事」全新版重开
- dynasty_coverage：新石器（南丫岛等沿海遗址）→ 东汉（李郑屋汉墓）→ 唐（屯门军镇）→
  宋（官富场盐务）→ 明清（迁海令、新界宗族）→ 近现代（开埠、抗战、回归）
- artifacts 主线：李郑屋汉墓「大吉番禺」墓砖与随葬陶器（东汉）、南丫岛/大湾史前遗物、
  新界宗族与传统民俗器物、开埠至战前维多利亚城历史照片、梦周文教基金会早期中国影像藏品
  （2024 年获捐逾 24,000 件）、渔业/艇户生活实物
- dynasty_connections：东汉、宋、明、清

### macau 澳门博物馆

- level：`澳门特别行政区文化局辖下综合性博物馆；馆址大炮台为世界文化遗产「澳门历史城区」组成部分`
  （命中 `heritage-site` tier）
- 建筑：建于 1617 年耶稣会兴建的大炮台之上，三层中两层埋于炮台平台之下，最上层由原气象台
  地面建筑改建，最大限度保留炮台原貌。总面积 2,800㎡、展面约 2,100㎡。1998-04-18 开幕。
- halls：一楼「澳门地区文明的原始」、二楼「澳门民间艺术与传统」、三楼「当代澳门」
- artifacts 主线：路环黑沙遗址出土石英环玦与彩陶片（新石器，1972—2006 年历次发掘）、
  明清中葡贸易外销瓷、17 世纪澳门铸炮厂大炮（1625 年设厂，供应中日及东南亚）、
  爆竹/火柴/神香三大传统行业实物、粤剧与木偶戏（广东杖头/潮州铁枝/福建提线）、
  土生葡人生活文化
- dynasty_connections：新石器、明、清

### poly-mgm 保利美高梅博物馆

- level：`保利文化与美高梅合办的民办博物馆，按国家一级文物展陈标准建造（免费参观）`
- 建筑：前厅穹顶数字艺术《丝路沙痕》；非遗工艺柱（官式古建筑营造技艺 + 景泰蓝掐丝珐琅斗拱）；
  地板镶嵌 12 款丝路沿线国家图腾，自东向西排列。获 2025 德国 iF 设计奖、2024 MUSE 设计奖、
  2024 伦敦设计奖铂金奖、2024 纽约建筑设计奖金奖。
- 年度大展《丝路》：2025 年 10 月—2026 年 8 月，四个主题空间，自西周至当代逾 200 件展品。
- artifacts 借展标注：每件 description **必须写明「《丝路》特展借展，现藏 XX，展期至 2026 年 8 月」**，
  避免用户误认为常设馆藏。清单：铜车马仪仗队（汉·甘肃省博物馆）、东汉铜摇钱树（绵阳市博物馆）、
  唐人物纹八棱金杯（陕西历史博物馆）、雍正款蓝色玻璃八棱瓶（故宫博物院）、常玉《粉瓶小野菊》
  （1931，香港私人收藏）、卡纳莱托《从圣马可湾眺望码头》（1733–1734，意大利赞尼基金会）。
  自有藏品：龙纹宝座毯（约明或清，美高梅藏，山羊毛/羊羔毛/丝线织造，双龙献珠图）。
- dynasty_connections：西汉/东汉（丝路开通与铜车马、摇钱树）、唐（金银器与胡风）、明清（宫廷织毯与外销）

## 朝代挂载（dynasty_recommended_museums）

| dynasty_id | museum_id | reason 要点 |
|---|---|---|
| `eastern-han` | `hk-history` | 李郑屋汉墓——香港唯一汉代墓葬，墓砖铭文实证 2000 年前香港属番禺县 |
| `ming` | `macau` | 16 世纪中葡贸易与大炮台防御体系，明代海上丝路的西端窗口 |
| `qing` | `macau` | 清代外销瓷、澳门开埠后中西文化并存的实物现场 |
| `tang` | `poly-mgm` | 《丝路》大展的唐代金银器（人物纹八棱金杯）与胡风艺术 |
| `western-han` | `poly-mgm` | 汉代铜车马仪仗队等丝路开通期文物集中展陈 |

写法：追加到对应 `data/dynasties/<id>.yaml` 的 `recommended_museums` 末尾。

## 配图

- 只用 Wikimedia Commons，通过已部署的 `/api/admin/wikimedia/commons` 与
  `/api/admin/wikimedia/fetch` 代理（本机直连 Commons 的 TLS 被拦截）。
- 每张图**下载后必须肉眼核对主体**再入库（历史教训：attribution 正确但 R2 实际内容跑题）。
  主体对不上就留空，不硬凑。
- 入库路径：`wrangler r2 object put museum-images/<sha256-16>.<ext>` →
  `POST /api/admin/set-artifact-image` → 同步写 `data/museums/*.yaml` 的
  `image_url/image_license/image_attribution` 与 `data/field-provenance.yaml` 的
  `artifacts[N].image` source_url。
- 已验证存在的候选：`File:Lei Cheng Uk Han Tomb Museum Interior.jpg`（CC-BY-SA-2.5, Baycrest）、
  `File:Fortaleza del Monte, Macao, 2013-08-08, DD 01.jpg`（CC-BY-SA-3.0, Diego Delso）。

## 落地流程

1. 写 `data/museums/{hk-history,macau,poly-mgm}.yaml`
2. 追加 `data/dynasties/{eastern-han,ming,qing,tang,western-han}.yaml` 的 recommended_museums
3. 配图：Commons 检索 → 代理下载 → 肉眼核对 → R2 → set-artifact-image → 回写 yaml + field-provenance
4. **纯增量 SQL** 打到 remote D1：`INSERT ... ON CONFLICT DO NOTHING` +
   `UPDATE dynasty_recommended_museums SET museum_id=... WHERE ... AND museum_id IS NULL`
5. `bun run snapshot -- --target=remote` 后 `git diff` 应为空（本地 yaml 与线上一致）
6. `bun test` + `bun run typecheck`

## 明确不做

- **不跑 `bun run restore --target=remote`**。restore 是 DELETE-then-INSERT 整表，
  museums 表 DELETE 会触发 FK CASCADE，带走用户 visits 派生数据。
- 不新增 migration，不改 schema，不动前端代码。三条数据完全套用现有结构。
- 不为常玉《粉瓶小野菊》等在版权保护期内的现代作品找图。
