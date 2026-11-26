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
}
