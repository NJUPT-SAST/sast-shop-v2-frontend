// Frontend-only category MVP.
//
// The API does not yet expose a category/tags field on listings. Until it
// does, we expose a `Categorizer` interface so consumers don't need to know
// about the heuristic implementation; once a backend `category` field lands,
// only this file needs replacing.

import type { Listing } from "@/lib/api/types"

export const CATEGORIES = ["books", "electronics", "apparel", "cards", "merch", "other"] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABELS: Record<Category, string> = {
  books: "书籍教材",
  electronics: "电子产品",
  apparel: "服饰配件",
  cards: "游戏卡牌",
  merch: "动漫周边",
  other: "其他闲置",
}

export const CATEGORY_ICONS: Record<Category, string> = {
  books: "material-symbols:menu-book-rounded",
  electronics: "material-symbols:devices-rounded",
  apparel: "material-symbols:checkroom-rounded",
  cards: "material-symbols:style-rounded",
  merch: "material-symbols:auto-awesome-rounded",
  other: "material-symbols:category-rounded",
}

const HEURISTICS: Record<Category, RegExp[]> = {
  books: [/书|教材|考研|笔记|资料|教辅|课件|参考/i, /\bbook|textbook|notes?\b/i],
  electronics: [
    /手机|平板|电脑|笔电|耳机|键盘|鼠标|相机|主机|显示器|switch|ipad|kindle|ssd|硬盘|路由/i,
    /\bphone|tablet|laptop|earbud|keyboard|mouse|camera|monitor|router\b/i,
  ],
  apparel: [/衣|鞋|裤|帽|包|外套|卫衣|t恤|裙|围巾/i, /\bjacket|hoodie|tee|shoe|bag|hat\b/i],
  cards: [/卡牌|游戏王|宝可梦|魔法风云|万智牌|球星卡|psa|宝可梦卡/i, /\bcard|tcg|mtg\b/i],
  merch: [/手办|周边|徽章|海报|抱枕|挂件|figma|nendoroid|动漫|二次元/i, /\bfigure|merch\b/i],
  other: [/.*/], // matches everything as last resort
}

export type Categorizer = {
  matches(listing: Listing): Category[]
}

const heuristicCategorizer: Categorizer = {
  matches(listing: Listing): Category[] {
    const haystack = `${listing.title}\n${listing.description}`.toLowerCase()
    const hits = (Object.entries(HEURISTICS) as Array<[Category, RegExp[]]>)
      .filter(([key]) => key !== "other")
      .filter(([, patterns]) => patterns.some((p) => p.test(haystack)))
      .map(([key]) => key)
    return hits.length > 0 ? hits : ["other"]
  },
}

export const categorizer: Categorizer = heuristicCategorizer

export function listingMatchesCategory(listing: Listing, category: Category | null): boolean {
  if (!category) return true
  return categorizer.matches(listing).includes(category)
}
