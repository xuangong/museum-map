import type { ThreadImage } from "../threads"

/**
 * Verified art for the 循迹 books, kept apart from the text so images can be curated on their own.
 * `cover` becomes the book's cover; each chapter entry inserts a full-page image page into that chapter
 * (before its map page, never next to another image). Files live only in R2 (/img/xj-…), made with
 * scripts/thread-images.ts; every image was viewed before use.
 */
export interface BookImages {
  cover?: ThreadImage
  chapters?: Record<number, { image: ThreadImage; caption: string }[]>
}
export const BOOK_IMAGES: Record<string, BookImages> = {
  "zhangqian": {
    chapters: {
      0: [{ image: { src: "/img/xj-zhangqian-changan-relief-d5664816b77e9965.jpg", work: "《车马出行画像石》", by: "东汉 · 佚名（摄影 Daderot）", where: "东京国立博物馆", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Queen_Mother_of_the_West,_chariot,_&_hunting,_excavatedfrom_Jinyangshan,_Shandong,_China,_Eastern_Han_dynasty,_1st-2nd_century_AD,_stone_-_Tokyo_National_Museum_-_Tokyo,_Japan_-_DSC08344.jpg", w: 1119, h: 1200 }, caption: "东汉画像石上的车马出行。它比张骞晚了两百来年，但汉代人出远门的排场，大抵如此。" }],
      1: [{ image: { src: "/img/xj-zhangqian-xiongnu-deer-fittings-023f96509a74c9a3.jpg", work: "《匈奴青铜鹿形车饰》", by: "约前4—前3世纪 · 草原工匠（摄影 Daderot）", where: "瑞典远东古物博物馆", license: "CC0", commons: "https://commons.wikimedia.org/wiki/File:Two_chariot_fittings_in_the_shape_of_deer,_Xiongnu,_400-200_BC,_bronze_-_Östasiatiska_museet,_Stockholm_-_DSC09560.JPG", w: 1200, h: 829 }, caption: "匈奴贵族车上的青铜鹿饰，草原工匠的手艺。张骞在这个世界里生活了十年。" }],
      2: [{ image: { src: "/img/xj-zhangqian-cover-galloping-horse-fe1a539be46d39b9.jpg", work: "《铜奔马》", by: "东汉 · 佚名工匠（摄影 Gary Todd）", where: "甘肃省博物馆", license: "CC0", commons: "https://commons.wikimedia.org/wiki/File:Eastern_Han_Bronze_Galloping_Horse_(10095360593).jpg", w: 1200, h: 800 }, caption: "甘肃武威出土的东汉铜奔马，汉代人心中「天马」的样子。张骞带回大宛产好马的消息，汉武帝从此念念不忘。" }],
      3: [{ image: { src: "/img/xj-zhangqian-daxia-tillya-crown-ecf5871fe8019773.jpg", work: "《黄金之丘六号墓金冠》", by: "约1世纪 · 佚名（摄影 Artacoana）", where: "阿富汗国家博物馆", license: "CC BY-SA 3.0", commons: "https://commons.wikimedia.org/wiki/File:TillyaTepeCrown.jpg", w: 1200, h: 1012 }, caption: "阿富汗黄金之丘出土的金冠，约公元1世纪。一般认为墓主是迁居巴克特里亚的游牧贵族，与月氏有关。" }],
      4: [{ image: { src: "/img/xj-zhangqian-daxia-bactrian-coins-dc9f0363ab1ee3be.jpg", work: "《希腊-巴克特里亚王国钱币》", by: "前3—前2世纪（展品，摄影 Davide Mauro）", where: "见 Commons 说明", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:Coins_of_Greek-Bactrian_Kingdom.jpg", w: 1192, h: 1200 }, caption: "希腊-巴克特里亚王国的钱币。张骞到大夏时，这个说希腊语的王国刚被月氏击败不久。" }],
      5: [{ image: { src: "/img/xj-zhangqian-return-han-cart-e3130c5b988d8d4d.jpg", work: "《陶马车》", by: "东汉 · 佚名（摄影 Gary Todd）", where: "上海震旦博物馆", license: "CC0", commons: "https://commons.wikimedia.org/wiki/File:Eastern_Han_Pottery_Horse_&_Cart.jpg", w: 1200, h: 800 }, caption: "东汉陶马车。张骞走通的这条路上，后来车马不绝。" }],
    },
  },
  "xuanzang": {
    cover: { src: "/img/xj-xuanzang-cover-fuji-scroll-e320cd35d589b9af.jpg", work: "《玄奘负笈图》", by: "镰仓时代 · 佚名", where: "东京国立博物馆", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Xuanzang_w.jpg", w: 536, h: 1200 },
    chapters: {
      0: [{ image: { src: "/img/xj-xuanzang-liangzhou-guazhou-dunhuang-66969c25ae084b79.jpg", work: "《行脚僧图》", by: "唐末 · 佚名", where: "敦煌藏经洞出土", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Xuan_Zang.jpg", w: 876, h: 1200 }, caption: "敦煌出土的行脚僧图（唐末），常被看作玄奘的样子：背着经笈，身边跟着一只虎。" }],
      1: [{ image: { src: "/img/xj-xuanzang-yumen-pass-5e80818f1b12089f.jpg", work: "《玉门关遗址》", by: "摄影 Raki_Man", where: "甘肃敦煌", license: "CC BY 3.0", commons: "https://commons.wikimedia.org/wiki/File:Remains_of_Great_Wall-_Jade_Gate_Pass_-_panoramio.jpg", w: 1200, h: 900 }, caption: "今天看到的玉门关遗址是汉代的。玄奘偷越的唐玉门关在瓜州以北，早已湮没在戈壁里。" }],
      2: [{ image: { src: "/img/xj-xuanzang-gaochang-jiaohe-754f2bfec7942880.jpg", work: "《交河故城》", by: "摄影 Scott Newman", where: "新疆吐鲁番", license: "CC BY-SA 2.0", commons: "https://commons.wikimedia.org/wiki/File:Jiaohe_-_Yarkhoto_ruins.jpg", w: 1200, h: 797 }, caption: "吐鲁番的交河故城。玄奘停留过的高昌故城在几十公里外，同属这片绿洲。" }],
      3: [{ image: { src: "/img/xj-xuanzang-samarkand-afrasiab-e39ba200cb9c9f7b.jpg", work: "《阿弗拉西阿卜壁画（局部）》", by: "7世纪 · 粟特画师（摄影 ALFGRN）", where: "撒马尔罕阿弗拉西阿卜博物馆", license: "CC BY-SA 2.0", commons: "https://commons.wikimedia.org/wiki/File:Afrasiyab_mural.jpg", w: 1200, h: 442 }, caption: "撒马尔罕的粟特壁画，画着来朝的各国使者，与玄奘路过这座城同在七世纪。" }],
      4: [{ image: { src: "/img/xj-xuanzang-nalanda-temple3-0530a2ecb9006665.jpg", work: "《那烂陀寺遗址第三号塔寺》", by: "摄影 Sumitsurai", where: "印度比哈尔邦", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:Temple_3_-_Sariputta_Stupa_-_Nalanda_Mahavihara_(10).jpg", w: 1200, h: 800 }, caption: "那烂陀寺遗址。玄奘在这里跟随戒贤学习了约五年。" }],
      5: [{ image: { src: "/img/xj-xuanzang-return-mogao103-847618f56f3076ef.jpg", work: "《莫高窟第103窟壁画（局部）》", by: "盛唐 · 佚名", where: "敦煌莫高窟", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Eighth_century_Dunhuang_cave_mural_depicting_Xuanzang_returning_from_India.jpg", w: 1200, h: 737 }, caption: "莫高窟第103窟的盛唐壁画。旧说画的是玄奘东归，学界对此有不同看法。" }],
      6: [{ image: { src: "/img/xj-xuanzang-changan-return-yanta-8a8d1b3f17bbd655.jpg", work: "《大雁塔》", by: "摄影 Alexey Komarov", where: "陕西西安", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:Giant_Wild_Goose_Pagoda,_Xi'an,_May,_2018-1.jpg", w: 1200, h: 822 }, caption: "西安大雁塔。652年，玄奘为安放带回的经像主持修建。" }],
    },
  },
  "libai": {
    cover: { src: "/img/xj-libai-liangkai-xingyin-b2c282f0215693fe.jpg", work: "《李白行吟图》", by: "南宋 · 梁楷", where: "东京国立博物馆", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Li_Bai_in_stroll.jpg", w: 469, h: 1200 },
    chapters: {
      0: [{ image: { src: "/img/xj-libai-sanxia-zhidian-ef96264d4dec387e.jpg", work: "《三峡之巅》", by: "摄影 Zhaojundong", where: "重庆奉节", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:重庆奉节-三峡之巅_Peak_of_the_Three_Gorges.jpg", w: 1200, h: 662 }, caption: "奉节一带的瞿塘峡口。二十五岁的李白，就从这里顺江出蜀。" }],
      1: [{ image: { src: "/img/xj-libai-xiayong-huanghelou-2b1dc186d52e4427.jpg", work: "《黄鹤楼图》", by: "元 · 夏永", where: "见 Commons 说明", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Xia_Yong_-_Huang_He_Lou.jpg", w: 1200, h: 912 }, caption: "元代夏永界画中的黄鹤楼。李白在这里送孟浩然东下扬州。" }],
      2: [{ image: { src: "/img/xj-libai-suliupeng-taibai-zuijiu-960b411dea0d130a.jpg", work: "《太白醉酒图》", by: "清 · 苏六朋（1844）", where: "见 Commons 说明", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:苏六朋_太白醉酒图轴.jpg", w: 545, h: 1200 }, caption: "清代苏六朋的《太白醉酒图》。醉中的李白，是后世画家最爱画的样子。" }],
      3: [{ image: { src: "/img/xj-libai-shangyangtai-tie-192e68bea0ba659e.jpg", work: "《上阳台帖（局部）》", by: "唐 · 李白", where: "故宫博物院", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:上阳台帖_(cropped).jpg", w: 1200, h: 789 }, caption: "《上阳台帖》，一般认为是李白唯一传世的墨迹。" }],
      5: [{ image: { src: "/img/xj-libai-dangtu-tomb-b115a681b2101b81.jpg", work: "《李白墓》", by: "摄影 Sancho Zheng", where: "安徽当涂青山", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:李白墓Li_bai's_tomb.jpg", w: 888, h: 1200 }, caption: "当涂青山的李白墓。他死后五十多年，范传正把他迁葬到这里。" }],
    },
  },
  "libai-baidi": {
    cover: { src: "/img/xj-libai-baidi-kuimen-7d714d682326e903.jpg", work: "《夔门》", by: "摄影 Liuxingy", where: "重庆奉节", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:白帝城·瞿塘峡_夔门_02.jpg", w: 1200, h: 800 },
    chapters: {
      1: [{ image: { src: "/img/xj-libai-baidi-qutang-cliffs-4fc780c3f40bac46.jpg", work: "《瞿塘峡》", by: "摄影 Liuxingy", where: "重庆奉节", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:白帝城·瞿塘峡_03.jpg", w: 1200, h: 800 }, caption: "瞿塘峡的两岸峭壁。三峡里它最短，也最险。" }],
      2: [{ image: { src: "/img/xj-libai-baidi-wushan-1870s-a8e4f823d3439369.jpg", work: "《四川巫山峡》", by: "约翰·汤姆逊 摄（19世纪后期）", where: "见 Commons 说明", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:WU-SHAN_GORGE,_PROVINCE_OF_SZECHUAN.jpg", w: 1200, h: 895 }, caption: "十九世纪后期约翰·汤姆逊拍下的巫峡。那时江上没有大坝，和李白见过的样子更接近。" }],
      3: [{ image: { src: "/img/xj-libai-baidi-xiling-dc717b6677621708.jpg", work: "《西陵峡》", by: "摄影 Vmenkov", where: "湖北秭归", license: "CC BY-SA 3.0", commons: "https://commons.wikimedia.org/wiki/File:Zigui-Xiling-Gorge-4983.jpg", w: 1200, h: 900 }, caption: "西陵峡。出了这里，江面一下子宽了，江陵就在前面。" }],
      4: [{ image: { src: "/img/xj-libai-baidi-jingzhou-binyanglou-9d7cc8e12519c1e3.jpg", work: "《荆州古城宾阳楼》", by: "摄影 Fxqf", where: "湖北荆州", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:荆州古城宾阳楼.jpg", w: 1200, h: 675 }, caption: "荆州古城的宾阳楼（城楼为后世重建）。江陵，就是这里。" }],
    },
  },
  "dufu-763": {
    cover: { src: "/img/xj-dufu-763-wangshimin-cover-831ff01143871d0a.jpg", work: "《杜甫诗意图册（第五开）》", by: "清 · 王时敏", where: "故宫博物院", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:王时敏杜甫诗意图册-5.png", w: 815, h: 1200 },
    chapters: {
      0: [{ image: { src: "/img/xj-dufu-763-zhao-portrait-zizhou-ed97a6dd22e98444.jpg", work: "《杜甫像轴（局部）》", by: "传元 · 赵孟頫", where: "故宫博物院", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:赵孟頫画杜甫像轴.png", w: 766, h: 1200 }, caption: "传为元代赵孟頫画的杜甫像。杜甫真实的样貌已无从知道，这是后人心中的他。" }, { image: { src: "/img/xj-dufu-763-li-zhaodao-shu-4efafd5282c45bcc.jpg", work: "《明皇幸蜀图》", by: "传唐 · 李昭道", where: "台北故宫博物院", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Li_Zhaodao_Minhuan_travel.jpg", w: 881, h: 1200 }, caption: "传为唐人所作的《明皇幸蜀图》，画安史之乱中唐玄宗西逃入蜀。杜甫半生的流离，就从这场战乱开始。" }],
      1: [{ image: { src: "/img/xj-dufu-763-wangshimin-baxia-972710584bb531a3.jpg", work: "《杜甫诗意图册（第七开）》", by: "清 · 王时敏", where: "故宫博物院", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:王时敏杜甫诗意图册-7.png", w: 798, h: 1200 }, caption: "清初王时敏依杜诗画成的山水册页。三百多年后，画家还在替杜甫看那一路江山。" }],
      2: [{ image: { src: "/img/xj-dufu-763-wangshimin-wuxia-db26d48d989b22f2.jpg", work: "《杜甫诗意图册（第十开）》", by: "清 · 王时敏", where: "故宫博物院", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:王时敏杜甫诗意图册-10.png", w: 800, h: 1200 }, caption: "同一本《杜甫诗意图册》中的另一开：峡深水急，正是诗里要穿过的地方。" }],
      3: [{ image: { src: "/img/xj-dufu-763-xiangyang-02a10935ddb7adfa.jpg", work: "《襄阳古城墙》", by: "摄影 Fxqf", where: "湖北襄阳", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:Xiangyang_City_Wall_03.jpg", w: 1200, h: 900 }, caption: "襄阳古城墙（明清重修）。杜甫的祖籍在这里，诗里要「便下襄阳」，也是回到祖辈的地方。" }],
      4: [{ image: { src: "/img/xj-dufu-763-longmen-bc2ba5c37a8498d5.jpg", work: "《龙门石窟奉先寺》", by: "摄影 Zhangzhugang", where: "河南洛阳", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:Luoyang_Longmen_Shiku_2018.12.16_09-43-06.jpg", w: 1200, h: 799 }, caption: "洛阳龙门奉先寺的唐代大佛，造成于杜甫出生前三十多年。这是他终究没能再回去的洛阳。" }],
    },
  },
  "wentianxiang": {
    cover: { src: "/img/xj-wentianxiang-ming-portrait-cover-cda73d588e184bfd.jpg", work: "《文天祥像（局部）》", by: "明 · 佚名", where: "见 Commons 说明", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:明人《文天祥像》.jpg", w: 1094, h: 1200 },
    chapters: {
      0: [{ image: { src: "/img/xj-wentianxiang-ganzhou-wall-fb40428c0b688604.jpg", work: "《赣州古城墙》", by: "摄影 Underbar dk", where: "江西赣州", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:Ganzhou_city_wall_near_Yugu_Pavilion.jpg", w: 1200, h: 900 }, caption: "赣州古城墙（宋代始筑，后世重修）。1275年，文天祥在这里起兵勤王。" }],
      1: [{ image: { src: "/img/xj-wentianxiang-yeyanlan-portrait-17a27ef2f7006ef5.jpg", work: "《文天祥肖像》", by: "清 · 叶衍兰", where: "见 Commons 说明", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:文天祥肖像.jpg", w: 753, h: 1200 }, caption: "清代叶衍兰画的文天祥像，收在他所绘的历代名人像中。" }],
      2: [{ image: { src: "/img/xj-wentianxiang-lingdingyang-7b465f958d4ef3e8.jpg", work: "《伶仃洋》", by: "摄影 Huangdan2060", where: "广东珠海外伶仃岛", license: "CC0", commons: "https://commons.wikimedia.org/wiki/File:Seascape_of_Wai_Lingding_Island_in_Zhuhai,_Guangdong,_China5.jpg", w: 1200, h: 387 }, caption: "今天的伶仃洋。1279年正月，文天祥被押在元军船上，从这片海上经过。" }, { image: { src: "/img/xj-wentianxiang-yashan-stele-a8e7b3edcddc24c4.jpg", work: "《宋王台碑》", by: "摄影 N509FZ", where: "香港九龙", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:Sung_Wong_Toi_stele_(20181204114442).jpg", w: 1200, h: 849 }, caption: "香港九龙的宋王台碑，纪念南宋末年的小皇帝流亡到此。几个月后，宋室亡于崖山。" }],
      3: [{ image: { src: "/img/xj-wentianxiang-dadu-statue-f8c7457747ce39fb.jpg", work: "《文丞相祠文天祥像（旧照）》", by: "黑龙会《亚细亚大观》", where: "北京文丞相祠", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:亜細亜大観_02_058_\"文天祥像_（文相丞祠の本尊）\".jpg", w: 860, h: 1200 }, caption: "北京文丞相祠里的文天祥像（旧照）。这座祠堂相传就建在他被囚三年的地方。" }],
    },
  },
  "wangwei-anxi": {
    cover: { src: "/img/xj-wangwei-anxi-wangchuan-cover-c5515bd76f70ff9e.jpg", work: "《辋川图（局部）》", by: "传摹王维 · 佚名", where: "芝加哥艺术博物馆", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Anonymous_-_The_Wangchuan_Villa_-_1950.1369_-_Art_Institute_of_Chicago.jpg", w: 1200, h: 1036 },
    chapters: {
      0: [{ image: { src: "/img/xj-wangwei-anxi-snowy-river-0f0252867d0a923a.jpg", work: "《雪溪图（局部）》", by: "传唐 · 王维", where: "普林斯顿大学艺术博物馆", license: "公有领域", commons: "https://commons.wikimedia.org/wiki/File:Wang_Wei_王維_-_Snowy_River_-_y1947-126_-_Princeton_University_Art_Museum.jpg", w: 762, h: 1200 }, caption: "传为王维所作的《雪溪图》。王维不只写诗，后来还被奉为文人画的始祖。" }],
      2: [{ image: { src: "/img/xj-wangwei-anxi-yangguan-beacon-b2ed1a08206396a1.jpg", work: "《阳关烽燧遗址》", by: "摄影 三猎", where: "甘肃敦煌", license: "CC BY-SA 4.0", commons: "https://commons.wikimedia.org/wiki/File:阳关烽燧遗址1.jpg", w: 1200, h: 798 }, caption: "阳关一带的烽燧遗址。「西出阳关无故人」，说的就是这片戈壁。" }],
      3: [{ image: { src: "/img/xj-wangwei-anxi-kizil-54e170b4a87d1f27.jpg", work: "《克孜尔千佛洞》", by: "摄影 Hiroki Ogawa", where: "新疆拜城", license: "CC BY 3.0", commons: "https://commons.wikimedia.org/wiki/File:Kizil_Caves_Kuqa_Xinjiang_China_新疆_库车_克孜尔千佛洞_-_panoramio.jpg", w: 1200, h: 900 }, caption: "龟兹故地的克孜尔千佛洞。唐代安西都护府就设在龟兹，元二要去的，就是这片绿洲。" }],
    },
  },
}
