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
export const BOOK_IMAGES: Record<string, BookImages> = {}
