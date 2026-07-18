"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { RiFileList3Line, RiSearchLine } from "@remixicon/react"
import type { SpotOrder } from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@workspace/ui/components/item"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

import {
  filterSpotOrders,
  getSpotOrderStatusLabel,
  type SpotOrderFilterStatus,
  type SpotOrderFilters,
  type SpotOrderView,
  updateSpotOrderFilterParams,
} from "@/lib/spot-orders"

const statusOptions: Array<{ value: SpotOrderFilterStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待支付" },
  { value: "pending_confirm", label: "待确认" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

export function SpotOrdersView({
  buyerOrders,
  sellerOrders,
  initialFilters,
  errors,
}: {
  buyerOrders: SpotOrder[]
  sellerOrders: SpotOrder[]
  initialFilters: SpotOrderFilters
  errors: Partial<Record<SpotOrderView, string>>
}) {
  const router = useRouter()
  const [filters, setFilters] = useState(initialFilters)
  const orders = filters.view === "buyer" ? buyerOrders : sellerOrders
  const filtered = useMemo(() => filterSpotOrders(orders, filters), [orders, filters])

  function update(updates: Partial<SpotOrderFilters>) {
    const next = { ...filters, ...updates }
    if (updates.view && updates.view !== filters.view) {
      next.status = "all"
      next.query = ""
    }
    setFilters(next)
    const params = updateSpotOrderFilterParams(
      new URLSearchParams({
        view: filters.view,
        ...(filters.status !== "all" ? { status: filters.status } : {}),
        ...(filters.query ? { q: filters.query } : {}),
      }),
      updates.view
        ? { view: updates.view }
        : {
            status: updates.status,
            query: updates.query,
          },
    )
    window.history.replaceState(
      window.history.state,
      "",
      `/orders${params.size ? `?${params}` : ""}`,
    )
  }

  const returnParams = new URLSearchParams({
    view: filters.view,
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.query ? { q: filters.query } : {}),
  })
  const returnTo = `/orders${returnParams.size ? `?${returnParams}` : ""}`

  return (
    <div className="space-y-6">
      <section>
        <Badge variant="muted">现货订单</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">订单管理</h1>
        <p className="mt-2 text-sm text-muted-foreground">在买家与卖家视角之间切换，处理支付、收款与完成状态。</p>
      </section>

      <Tabs value={filters.view} onValueChange={(value) => update({ view: value as SpotOrderView })}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TabsList className="w-64"><TabsTrigger value="buyer">我购买的</TabsTrigger><TabsTrigger value="seller">我售出的</TabsTrigger></TabsList>
          <InputGroup className="w-full max-w-sm">
            <InputGroupAddon><RiSearchLine /></InputGroupAddon>
            <InputGroupInput value={filters.query} onChange={(event) => update({ query: event.target.value })} placeholder="搜索订单号、商品或店铺" />
          </InputGroup>
        </div>
      </Tabs>

      <ToggleGroup type="single" value={filters.status} onValueChange={(value) => value && update({ status: value as SpotOrderFilterStatus })} variant="outline" className="flex flex-wrap justify-start">
        {statusOptions.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
      </ToggleGroup>

      {errors[filters.view] ? (
        <Empty title="该视角订单暂时无法加载" description={errors[filters.view]} action={<Button variant="outline" onClick={() => router.refresh()}>重新加载</Button>} />
      ) : filtered.length === 0 ? (
        <Empty icon={<RiFileList3Line className="size-5" />} title="没有符合条件的订单" description="调整筛选条件或稍后再来看看。" />
      ) : (
        <section className="grid gap-3">
          {filtered.map((order) => (
            <Item key={order.id} variant="outline" asChild className="min-w-0 p-4 hover:bg-muted/40">
              <Link href={`/orders/spot/${order.id}?view=${filters.view}&returnTo=${encodeURIComponent(returnTo)}`}>
                <ItemContent className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <ItemTitle className="truncate text-base">{order.productTitle}</ItemTitle>
                    <Badge variant={order.status === "cancelled" ? "neutral" : order.status === "completed" ? "success" : "payment"}>{getSpotOrderStatusLabel(filters.view, order.status, order.bill?.status)}</Badge>
                  </div>
                  <ItemDescription className="truncate">{order.store?.name ?? "未知店铺"} · 订单号 {order.orderNo || order.id}</ItemDescription>
                </ItemContent>
                <div className="grid shrink-0 grid-cols-[5rem_8rem] items-center gap-6 text-right">
                  <span className="text-sm text-muted-foreground">× {order.quantity}</span>
                  <span className="truncate font-semibold">{formatPrice(order.totalAmountCents)}</span>
                </div>
                <ItemActions><span className="text-sm text-primary">查看详情</span></ItemActions>
              </Link>
            </Item>
          ))}
        </section>
      )}
    </div>
  )
}
