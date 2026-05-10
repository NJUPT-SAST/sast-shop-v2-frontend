"use client"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { MobileHeader } from "@/components/layout/mobile-header"
import { EmptyState } from "@/components/states/empty-state"
import { ErrorState } from "@/components/states/error-state"
import { SkeletonList } from "@/components/states/skeleton-list"
import { ListingStatusBadge, ListingTypeBadge } from "@/components/status-badge"
import { isApiError } from "@/lib/api/errors"
import { useAuthMe, useDeleteListing, useListings } from "@/lib/api/queries"
import type { Listing, ListingStatus } from "@/lib/api/types"
import { notify } from "@/lib/utils/toast"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type FilterKey = "all" | "active" | "voting" | "pending_review" | "draft" | "closed"

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "all", label: "全部" },
  { key: "active", label: "进行中" },
  { key: "voting", label: "投票中" },
  { key: "pending_review", label: "审核中" },
  { key: "draft", label: "草稿" },
  { key: "closed", label: "已结束" },
]

const STATUS_GROUPS: Partial<Record<FilterKey, ListingStatus[]>> = {
  active: ["active", "funded"],
  closed: ["completed", "closed", "rejected"],
}

export default function MyListingsPage() {
  const router = useRouter()
  const { data: me } = useAuthMe()
  const [filter, setFilter] = useState<FilterKey>("all")

  const { data, isPending, isError, refetch } = useListings({
    seller_id: me?.id,
    limit: 100,
  })

  function passesFilter(l: Listing) {
    if (filter === "all") return true
    const group = STATUS_GROUPS[filter]
    if (group) return group.includes(l.status)
    return l.status === filter
  }

  const items = (data?.items ?? []).filter(passesFilter)

  return (
    <>
      <MobileHeader showBack title="我发布的商品" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 md:px-8 md:py-8">
        <header className="hidden md:flex md:items-end md:justify-between">
          <div>
            <h1 className="text-[24px] font-semibold text-shop-text-primary">我发布的商品</h1>
            <p className="mt-1 text-[14px] text-shop-text-secondary">
              管理你上架过的二手、众筹与直售商品
            </p>
          </div>
          <Button onPress={() => router.push("/publish")} variant="primary">
            <Icon className="size-4" icon="material-symbols:add-rounded" />
            发布新商品
          </Button>
        </header>

        {/* Filter chips */}
        <nav
          aria-label="状态筛选"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key
            return (
              <button
                aria-pressed={active}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] transition ${
                  active
                    ? "bg-shop-primary text-shop-text-on-primary shadow-shop-sm"
                    : "bg-shop-bg-white text-shop-text-secondary hover:bg-shop-bg-tinted"
                }`}
                key={f.key}
                onClick={() => setFilter(f.key)}
                type="button"
              >
                {f.label}
              </button>
            )
          })}
        </nav>

        {isPending ? <SkeletonList count={5} /> : null}
        {isError ? <ErrorState onRetry={refetch} /> : null}
        {!isPending && !isError && items.length === 0 ? (
          <EmptyState
            action={
              <Link
                className="inline-flex items-center gap-1 rounded-shop-pill bg-shop-primary px-4 py-2 text-[13px] font-medium text-shop-text-on-primary hover:bg-shop-primary-hover"
                href="/publish"
              >
                <Icon className="size-4" icon="material-symbols:add-rounded" />
                去发布
              </Link>
            }
            description={filter === "all" ? "你还没有上架过商品" : "当前筛选下没有商品"}
            icon="material-symbols:storefront-outline-rounded"
            title="空空如也"
          />
        ) : null}

        {!isPending && items.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {items.map((listing) => (
              <ListingRow key={listing.id} listing={listing} />
            ))}
          </ul>
        ) : null}
      </main>
    </>
  )
}

function ListingRow({ listing }: { listing: Listing }) {
  const router = useRouter()
  const del = useDeleteListing()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const cover = listing.image_urls[0]

  async function handleDelete() {
    try {
      await del.mutateAsync(listing.id)
      notify({ title: "已下架", color: "success" })
    } catch (err) {
      notify({ title: isApiError(err) ? err.message : "下架失败", color: "danger" })
    }
  }

  const canEdit =
    listing.status === "draft" ||
    listing.status === "pending_review" ||
    listing.status === "rejected"
  const canDelete = listing.status !== "completed" && listing.status !== "closed"

  return (
    <li className="shop-card overflow-hidden">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-4 sm:p-4">
        <Link
          aria-label={`查看 ${listing.title}`}
          className="block size-24 shrink-0 self-center overflow-hidden rounded-shop-sm bg-shop-bg-tinted sm:self-start"
          href={`/listings/${listing.id}`}
        >
          {cover ? (
            <img alt={listing.title} className="size-full object-cover" src={cover} />
          ) : (
            <div className="flex size-full items-center justify-center text-shop-text-tertiary">
              <Icon className="size-8" icon="material-symbols:image-outline" />
            </div>
          )}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <ListingTypeBadge cfMode={listing.cf_mode} type={listing.type} />
            <ListingStatusBadge status={listing.status} />
          </div>
          <Link
            className="truncate text-[15px] font-medium text-shop-text-primary hover:text-shop-primary"
            href={`/listings/${listing.id}`}
          >
            {listing.title}
          </Link>
          <div className="mt-auto flex items-baseline gap-3 text-shop-text-tertiary">
            <span className="text-[16px] font-bold text-shop-primary tabular-nums">
              ¥ {Number(listing.price).toFixed(2)}
            </span>
            <span className="text-[12px]">库存 {listing.stock}</span>
            {listing.type === "crowdfund" && listing.cf_mode === "vote_first" ? (
              <span className="text-[12px]">
                {listing.current_votes ?? 0} / {listing.target_votes ?? 0} 票
              </span>
            ) : null}
            {listing.type === "crowdfund" && listing.cf_mode === "presale" ? (
              <span className="text-[12px]">已筹 ¥{listing.current_amount ?? "0"}</span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-shop-border-light pt-3 sm:flex-col sm:border-0 sm:pt-0">
          <Button onPress={() => router.push(`/listings/${listing.id}`)} size="sm" variant="ghost">
            查看
          </Button>
          {canEdit ? (
            <Button
              onPress={() => router.push(`/listings/${listing.id}/edit`)}
              size="sm"
              variant="ghost"
            >
              编辑
            </Button>
          ) : null}
          {canDelete ? (
            <Button onPress={() => setConfirmOpen(true)} size="sm" variant="ghost">
              <span className="text-shop-danger">下架</span>
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        confirmLabel="确认下架"
        description={
          <span>
            下架后买家将无法看到此商品。
            <br />
            标题：<strong>{listing.title}</strong>
          </span>
        }
        destructive
        loading={del.isPending}
        onConfirm={handleDelete}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="确认下架商品？"
      />
    </li>
  )
}
