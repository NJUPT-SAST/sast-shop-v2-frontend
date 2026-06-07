"use client"

import { StaggerItem, StaggerList } from "@/components/motion/stagger"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonGrid } from "@/components/states/skeleton-grid"
import type { Listing } from "@/lib/api/types"
import { CrowdfundCard } from "./crowdfund-card"
import { ProductCard } from "./product-card"

type Variant = "auto" | "product" | "crowdfund"

export function ListingGrid({
  listings,
  isLoading,
  emptyText,
  variant = "auto",
}: {
  listings: Listing[] | undefined
  isLoading: boolean
  emptyText: string
  variant?: Variant
}) {
  if (isLoading) {
    return <SkeletonGrid variant={variant === "crowdfund" ? "crowdfund" : "product"} />
  }
  if (!listings || listings.length === 0) {
    return <EmptyState description={emptyText} title="暂无商品" />
  }
  return (
    <StaggerList
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      lazy={listings.length > 24}
    >
      {listings.map((l) => {
        const isCf = l.type === "crowdfund" && variant !== "product"
        const cardClass =
          isCf || variant === "crowdfund" ? "col-span-2 sm:col-span-3 lg:col-span-2" : ""
        return (
          <StaggerItem className={cardClass} key={l.id}>
            {isCf || variant === "crowdfund" ? (
              <CrowdfundCard listing={l} />
            ) : (
              <ProductCard listing={l} />
            )}
          </StaggerItem>
        )
      })}
    </StaggerList>
  )
}
