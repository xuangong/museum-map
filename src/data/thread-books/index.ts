import type { ThreadBook } from "../threads"
import zhangqian from "./zhangqian"
import xuanzang from "./xuanzang"
import libai from "./libai"
import dufu_763 from "./dufu-763"
import wentianxiang from "./wentianxiang"
import libai_baidi from "./libai-baidi"
import wangwei_anxi from "./wangwei-anxi"

/** Each thread's book lives in its own file so they can be written independently; merged into THREADS by id. */
const all: Record<string, ThreadBook | null> = { "zhangqian": zhangqian, "xuanzang": xuanzang, "libai": libai, "dufu-763": dufu_763, "wentianxiang": wentianxiang, "libai-baidi": libai_baidi, "wangwei-anxi": wangwei_anxi }
export const BOOKS: Record<string, ThreadBook> = Object.fromEntries(Object.entries(all).filter(([, b]) => b)) as Record<string, ThreadBook>
