"use client"

import { BulkActionBar } from "@/components/admin/bulk-action-bar"
import { DataTable } from "@/components/admin/data-table"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { InfiniteList } from "@/components/infinite-list"
import { MobileHeader } from "@/components/layout/mobile-header"
import { SearchBar } from "@/components/search/search-bar"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonTable } from "@/components/states/skeleton-table"
import { ListingStatusBadge, ListingTypeBadge } from "@/components/status-badge"
import { isApiError } from "@/lib/api/errors"
import { useInfiniteAdminListings } from "@/lib/api/infinite-queries"
import { useBulkForceDelist } from "@/lib/api/queries"
import type { Listing } from "@/lib/api/types"
import { useRowSelection } from "@/lib/hooks/use-row-selection"
import { formatDateTime, formatPrice } from "@/lib/utils/format"
import { notify } from "@/lib/utils/toast"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { useMemo, useState } from "react"

export default function AdminListingsPage() {
  const [q, setQ] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reason, setReason] = useState("")
  const query = useInfiniteAdminListings({ q: q || undefined })
  const bulkDelist = useBulkForceDelist()

  const items = useMemo(
    () => (query.data ? query.data.pages.flatMap((p) => p.items) : []),
    [query.data]
  )
  const allIds = useMemo(() => items.map((l) => l.id), [items])
  const selection = useRowSelection(allIds)

  const columns = useMemo<ColumnDef<Listing, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "商品",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link
              className="line-clamp-1 text-shop-text-primary transition hover:text-shop-primary"
              href={`/listings/${row.original.id}`}
            >
              {row.original.title}
            </Link>
            <span className="text-[11px] text-shop-text-tertiary">{row.original.seller.name}</span>
          </div>
        ),
      },
      {
        id: "type",
        header: "类型",
        cell: ({ row }) => (
          <ListingTypeBadge cfMode={row.original.cf_mode} type={row.original.type} />
        ),
      },
      {
        id: "status",
        header: "状态",
        cell: ({ row }) => <ListingStatusBadge status={row.original.status} />,
      },
      {
        id: "price",
        header: "价格",
        cell: ({ row }) => (
          <span className="tabular-nums text-shop-primary">{formatPrice(row.original.price)}</span>
        ),
      },
      {
        id: "created_at",
        header: "上架",
        cell: ({ row }) => (
          <span className="text-[12px] text-shop-text-tertiary">
            {formatDateTime(row.original.created_at)}
          </span>
        ),
      },
    ],
    []
  )

  async function confirmBulkDelist() {
    const ids = Array.from(selection.selected)
    if (ids.length === 0) return
    const res = await bulkDelist.mutateAsync({ ids, reason: reason || undefined })
    if (res.failed.length === 0) {
      notify({ title: `已下架 ${res.successCount} 个商品`, color: "success" })
    } else {
      const firstErr = res.failed[0]
      notify({
        title: `成功 ${res.successCount} · 失败 ${res.failed.length}：${
          isApiError(firstErr.error) ? firstErr.error.message : "未知错误"
        }`,
        color: "warning",
      })
    }
    selection.clear()
    setReason("")
  }

  return (
    <>
      <MobileHeader title="全部商品" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 md:gap-4 md:px-8 md:py-8">
        <header className="hidden md:flex md:items-baseline md:justify-between">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">全部商品</h1>
        </header>
        <SearchBar onChange={setQ} placeholder="按标题搜索…" />

        <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
          <Button
            isPending={bulkDelist.isPending}
            onPress={() => setConfirmOpen(true)}
            variant="danger"
          >
            <Icon className="size-4" icon="material-symbols:remove-shopping-cart-rounded" />
            批量下架
          </Button>
        </BulkActionBar>

        <InfiniteList
          query={query}
          renderEmpty={
            <EmptyState
              description="尝试更换关键词"
              icon="material-symbols:inventory-2-rounded"
              title="没有匹配的商品"
            />
          }
          renderItems={() => (
            <DataTable
              columns={columns}
              data={items}
              emptyState={null}
              selectable={{
                isSelected: selection.isSelected,
                isAllSelected: selection.isAllSelected,
                isIndeterminate: selection.isIndeterminate,
                toggle: selection.toggle,
                toggleAll: selection.toggleAll,
              }}
            />
          )}
          renderSkeleton={<SkeletonTable columns={6} />}
        />
      </div>

      <ConfirmDialog
        confirmLabel="确认下架"
        description={
          <div className="flex flex-col gap-3">
            <p>
              将下架已选 <strong>{selection.selectedCount}</strong> 个商品，操作不可撤销。
            </p>
            <input
              className="rounded-shop-sm border border-shop-border bg-shop-bg-white px-3 py-2 text-[14px] focus:border-shop-primary focus:outline-none"
              onChange={(e) => setReason(e.target.value)}
              placeholder="下架原因（可选，会通知卖家）"
              value={reason}
            />
          </div>
        }
        destructive
        loading={bulkDelist.isPending}
        onConfirm={confirmBulkDelist}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="批量强制下架"
      />
    </>
  )
}
