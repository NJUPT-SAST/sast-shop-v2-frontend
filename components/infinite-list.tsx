"use client"

import { ErrorState } from "@/components/states/error-state"
import { Spinner } from "@heroui/react"
import { type ReactNode, useEffect, useRef } from "react"

type InfiniteState<T> = {
  data?: { pages: { items: T[] }[] }
  isLoading: boolean
  isError: boolean
  error: unknown
  hasNextPage?: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
  refetch: () => unknown
}

type Props<T> = {
  query: InfiniteState<T>
  renderItems: (items: T[]) => ReactNode
  renderSkeleton?: ReactNode
  renderEmpty?: ReactNode
  className?: string
  /** Hide the "load more" button when auto-scroll loading is enough. */
  hideManualLoadMore?: boolean
}

// Generic infinite list shell:
// - Shows skeleton while initial load is in flight
// - Shows error state with retry button on failure
// - Shows empty state when zero items
// - Renders items via renderItems(allItems)
// - Auto-loads next page when sentinel scrolls into view (rootMargin 200px)
// - Manual fallback "加载更多" button (a11y + slow connections)
export function InfiniteList<T>({
  query,
  renderItems,
  renderSkeleton,
  renderEmpty,
  className,
  hideManualLoadMore,
}: Props<T>) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage()
          }
        }
      },
      { rootMargin: "200px 0px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [query])

  if (query.isLoading) {
    return <div className={className}>{renderSkeleton}</div>
  }
  if (query.isError) {
    return (
      <div className={className}>
        <ErrorState error={query.error} onRetry={() => query.refetch()} title="加载失败" />
      </div>
    )
  }
  const items: T[] = query.data ? query.data.pages.flatMap((p) => p.items) : []
  if (items.length === 0) {
    return <div className={className}>{renderEmpty}</div>
  }
  return (
    <div className={className}>
      {renderItems(items)}
      <div className="flex flex-col items-center gap-3 py-6" ref={sentinelRef}>
        {query.isFetchingNextPage ? (
          <Spinner aria-label="加载更多" />
        ) : query.hasNextPage ? (
          hideManualLoadMore ? null : (
            <button
              className="rounded-shop-pill border border-shop-border bg-shop-bg-white px-4 py-1.5 text-[13px] text-shop-text-secondary transition hover:bg-shop-bg-tinted"
              onClick={() => query.fetchNextPage()}
              type="button"
            >
              加载更多
            </button>
          )
        ) : (
          <span className="text-[12px] text-shop-text-tertiary">— 已经到底啦 —</span>
        )}
      </div>
    </div>
  )
}
