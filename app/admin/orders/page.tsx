"use client"

import { DataTable } from "@/components/admin/data-table"
import { InfiniteList } from "@/components/infinite-list"
import { MobileHeader } from "@/components/layout/mobile-header"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonTable } from "@/components/states/skeleton-table"
import { OrderStatusBadge } from "@/components/status-badge"
import { useInfiniteAdminOrders } from "@/lib/api/infinite-queries"
import type { Order, OrderStatus } from "@/lib/api/types"
import { formatDateTime, formatPrice } from "@/lib/utils/format"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

const STATUS_OPTIONS: Array<{ v?: OrderStatus; label: string }> = [
  { v: undefined, label: "全部" },
  { v: "pending_payment", label: "待支付" },
  { v: "paid", label: "已支付" },
  { v: "shipped", label: "已发货" },
  { v: "completed", label: "已完成" },
  { v: "refunding", label: "退款中" },
]

function downloadCsv(orders: Order[]) {
  const header = ["订单 ID", "商品", "买家", "卖家", "金额", "状态", "创建时间"]
  const rows = orders.map((o) => [
    o.id,
    o.listing.title.replace(/"/g, '""'),
    o.buyer.name,
    o.seller.name,
    o.amount,
    o.status,
    o.created_at,
  ])
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function AdminOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined)
  const router = useRouter()
  const query = useInfiniteAdminOrders({ status })

  const items = useMemo(
    () => (query.data ? query.data.pages.flatMap((p) => p.items) : []),
    [query.data]
  )

  const columns = useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      {
        id: "title",
        header: "订单",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="line-clamp-1 text-shop-text-primary">
              {row.original.listing.title}
            </span>
            <span className="font-mono text-[11px] text-shop-text-tertiary">
              {row.original.id.slice(0, 8)}…
            </span>
          </div>
        ),
      },
      {
        id: "buyer",
        header: "买家",
        cell: ({ row }) => (
          <span className="text-shop-text-secondary">{row.original.buyer.name}</span>
        ),
      },
      {
        id: "seller",
        header: "卖家",
        cell: ({ row }) => (
          <span className="text-shop-text-secondary">{row.original.seller.name}</span>
        ),
      },
      {
        id: "amount",
        header: "金额",
        cell: ({ row }) => (
          <span className="tabular-nums text-shop-primary">{formatPrice(row.original.amount)}</span>
        ),
      },
      {
        id: "status",
        header: "状态",
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
      {
        id: "created_at",
        header: "时间",
        cell: ({ row }) => (
          <span className="text-[12px] text-shop-text-tertiary">
            {formatDateTime(row.original.created_at)}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <>
      <MobileHeader title="全部订单" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 md:gap-4 md:px-8 md:py-8">
        <header className="hidden md:flex md:items-baseline md:justify-between">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">全部订单</h1>
          <Button
            isDisabled={items.length === 0}
            onPress={() => downloadCsv(items)}
            variant="ghost"
          >
            <Icon className="size-4" icon="material-symbols:file-download-rounded" />
            导出 CSV
          </Button>
        </header>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 gap-2 overflow-x-auto">
            {STATUS_OPTIONS.map((opt) => (
              <Button
                className="shrink-0 rounded-shop-pill"
                key={opt.label}
                onPress={() => setStatus(opt.v)}
                size="sm"
                variant={status === opt.v ? "primary" : "outline"}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <Button
            aria-label="导出 CSV"
            className="md:hidden"
            isDisabled={items.length === 0}
            isIconOnly
            onPress={() => downloadCsv(items)}
            variant="ghost"
          >
            <Icon className="size-5" icon="material-symbols:file-download-rounded" />
          </Button>
        </div>

        <InfiniteList
          query={query}
          renderEmpty={
            <EmptyState
              description="切换状态查看其他订单"
              icon="material-symbols:receipt-long-rounded"
              title="没有订单"
            />
          }
          renderItems={() => (
            <DataTable
              columns={columns}
              data={items}
              emptyState={null}
              onRowClick={(row) => router.push(`/orders/${row.id}`)}
            />
          )}
          renderSkeleton={<SkeletonTable columns={6} />}
        />
      </div>
    </>
  )
}
