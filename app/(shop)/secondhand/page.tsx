"use client"

import { CategoryChips } from "@/components/category/category-chips"
import { InfiniteList } from "@/components/infinite-list"
import { MobileHeader } from "@/components/layout/mobile-header"
import { StaggerItem, StaggerList } from "@/components/motion/stagger"
import { ProductCard } from "@/components/product-card"
import { SearchBar } from "@/components/search/search-bar"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonGrid } from "@/components/states/skeleton-grid"
import { useInfiniteListings } from "@/lib/api/infinite-queries"
import { type Category, listingMatchesCategory } from "@/lib/categories"
import { Alert, Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useMemo, useState } from "react"

const SORT_OPTIONS = [
  { v: "created_desc" as const, label: "最新", icon: "material-symbols:schedule-rounded" },
  { v: "price_asc" as const, label: "价格 ↑", icon: "material-symbols:arrow-upward-rounded" },
  { v: "price_desc" as const, label: "价格 ↓", icon: "material-symbols:arrow-downward-rounded" },
  { v: "popularity" as const, label: "人气", icon: "material-symbols:trending-up-rounded" },
]

export default function SecondhandPage() {
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["v"]>("created_desc")
  const [category, setCategory] = useState<Category | null>(null)

  const query = useInfiniteListings({ type: "secondhand", q: q || undefined, sort })
  const allItems = useMemo(
    () => (query.data ? query.data.pages.flatMap((p) => p.items) : []),
    [query.data]
  )
  const filteredItems = useMemo(
    () => (category ? allItems.filter((l) => listingMatchesCategory(l, category)) : allItems),
    [allItems, category]
  )

  return (
    <>
      <MobileHeader title="二手商城" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:gap-6 md:px-8 md:py-8">
        <header className="hidden md:flex md:items-baseline md:justify-between">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">二手集市</h1>
          <p className="text-[13px] text-shop-text-secondary">校园里同学们正在转让的物品</p>
        </header>

        <SearchBar onChange={setQ} placeholder="搜索商品 / 关键词…" value={q} />

        <CategoryChips onChange={setCategory} value={category} />

        {category ? (
          <Alert status="warning">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>
                分类筛选目前为前端本地匹配（标题/描述关键词），后端将于后续版本提供更精准的分类支持。
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        <div className="flex gap-2 overflow-x-auto">
          {SORT_OPTIONS.map((opt) => (
            <Button
              className="shrink-0 rounded-shop-pill"
              key={opt.v}
              onPress={() => setSort(opt.v)}
              size="sm"
              variant={sort === opt.v ? "primary" : "outline"}
            >
              <Icon className="size-3.5" icon={opt.icon} />
              {opt.label}
            </Button>
          ))}
        </div>

        <InfiniteList
          query={query}
          renderEmpty={
            <EmptyState
              description={category ? "试试切换其他分类，或清除关键词" : "还没有匹配的商品"}
              icon="material-symbols:storefront-rounded"
              title="暂无商品"
            />
          }
          renderItems={() => (
            <StaggerList
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              lazy={filteredItems.length > 24}
            >
              {filteredItems.length === 0 && allItems.length > 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    description="该分类下暂无商品（正基于标题描述匹配）"
                    icon="material-symbols:filter-alt-rounded"
                    title="本地分类筛选无结果"
                  />
                </div>
              ) : (
                filteredItems.map((l) => (
                  <StaggerItem key={l.id}>
                    <ProductCard listing={l} />
                  </StaggerItem>
                ))
              )}
            </StaggerList>
          )}
          renderSkeleton={<SkeletonGrid count={8} variant="product" />}
        />
      </div>
    </>
  )
}
