"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { RiFileList3Line, RiSearchLine } from "@remixicon/react"
import type {
  BuyerErrandOrder,
  ErrandTaskBrief,
  SpotOrder,
} from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Empty } from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@workspace/ui/components/item"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import {
  DEFAULT_REMEMBERED_ORDER_VIEWS,
  getOrderFiltersFromParams,
  getStatusBadgeVariant,
  getStatusLabel,
  getStatusOptions,
  getViewOptions,
  matchesOrderStatus,
  orderTypeOptions,
  updateOrderFilterParams,
  type OrderFilters,
  type OrderStatus,
  type OrderType,
  type OrderView,
  type RememberedOrderViews,
  type RenderableOrderStatus,
} from "@/lib/order-filters"
import { parsePositiveInt64RouteId } from "@/lib/route-id"

type RenderableOrder = {
  id: string
  orderNo: string
  type: OrderType
  view: OrderView
  title: string
  store: string
  status: RenderableOrderStatus
  amount: number | null
  summary: string
  href: string | null
}

type OrdersViewProps = {
  initialFilters: OrderFilters
  spotBuyerOrders: SpotOrder[]
  spotSellerOrders: SpotOrder[]
  buyerErrandOrders: BuyerErrandOrder[]
  errandTasks: ErrandTaskBrief[]
  errors: {
    spotBuyer: boolean
    spotSeller: boolean
    errandParticipant: boolean
    errandCaptain: boolean
  }
}

export function OrdersView({
  initialFilters,
  spotBuyerOrders,
  spotSellerOrders,
  buyerErrandOrders,
  errandTasks,
  errors,
}: OrdersViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [filters, setFilters] = useState(initialFilters)
  const [rememberedViews, setRememberedViews] = useState<RememberedOrderViews>(
    () => rememberView(DEFAULT_REMEMBERED_ORDER_VIEWS, initialFilters),
  )
  const orders = useMemo(
    () => [
      ...spotBuyerOrders.map((order) => mapSpotOrder(order, "buyer")),
      ...spotSellerOrders.map((order) => mapSpotOrder(order, "seller")),
      ...buyerErrandOrders.map(mapBuyerErrandOrder),
      ...errandTasks.map(mapErrandTask),
    ],
    [buyerErrandOrders, errandTasks, spotBuyerOrders, spotSellerOrders],
  )
  const filtered = useMemo(
    () => filterOrders(orders, filters),
    [filters, orders],
  )
  const hasError = getCurrentError(filters, errors)

  useEffect(() => {
    const synchronize = () => {
      const next = getOrderFiltersFromParams(
        new URLSearchParams(window.location.search),
      )
      setFilters(next)
      setRememberedViews((current) => rememberView(current, next))
    }
    window.addEventListener("popstate", synchronize)
    return () => window.removeEventListener("popstate", synchronize)
  }, [])

  function update(updates: {
    type?: OrderType
    view?: OrderView
    status?: OrderStatus
    q?: string
  }) {
    const nextRemembered = updates.view
      ? rememberView(rememberedViews, { ...filters, view: updates.view })
      : rememberedViews
    const params = updateOrderFilterParams(
      new URLSearchParams(window.location.search),
      { ...updates, rememberedViews: nextRemembered },
    )
    const nextFilters = getOrderFiltersFromParams(params)
    setFilters(nextFilters)
    setRememberedViews(rememberView(nextRemembered, nextFilters))
    router.replace(params.size ? `${pathname}?${params}` : pathname, {
      scroll: false,
    })
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">订单</h1>
        <p className="text-sm text-muted-foreground">
          {hasError ? "当前视角暂不可用" : `共 ${filtered.length} 笔`}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          value={filters.type}
          onValueChange={(value) => update({ type: value as OrderType })}
        >
          <TabsList className="w-64">
            {orderTypeOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <InputGroup className="w-full max-w-sm">
          <InputGroupAddon>
            <RiSearchLine />
          </InputGroupAddon>
          <InputGroupInput
            value={filters.query}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="搜索订单号、商品或店铺"
            aria-label="搜索订单"
          />
        </InputGroup>
      </div>

      <Tabs
        value={filters.view}
        onValueChange={(value) => update({ view: value as OrderView })}
      >
        <TabsList>
          {getViewOptions(filters.type).map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ToggleGroup
        type="single"
        value={filters.status}
        variant="outline"
        className="flex flex-wrap justify-start"
        onValueChange={(value) => {
          if (value) update({ status: value as OrderStatus })
        }}
      >
        {getStatusOptions(filters.type, filters.view).map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {hasError ? (
        <Empty
          icon={<RiFileList3Line className="size-5" />}
          title="该视角订单暂时无法加载"
          description="请检查数据服务后重新加载。"
          action={
            <Button variant="outline" onClick={() => router.refresh()}>
              重新加载
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <Empty
          icon={<RiFileList3Line className="size-5" />}
          title="没有符合条件的订单"
          description="调整状态或清空搜索条件后再试。"
        />
      ) : (
        <section className="grid min-w-0 gap-3">
          {filtered.map((order) => (
            <OrderItem key={order.id} order={order} />
          ))}
        </section>
      )}
    </div>
  )
}

function OrderItem({ order }: { order: RenderableOrder }) {
  const content = (
    <Item
      variant="outline"
      className="min-w-0 p-4 transition-colors hover:bg-muted/40"
    >
      <ItemContent className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ItemTitle className="min-w-0 truncate text-base">
            {order.title}
          </ItemTitle>
          <Badge
            variant={getStatusBadgeVariant(order.status)}
            className="shrink-0"
          >
            {getStatusLabel(order.status)}
          </Badge>
        </div>
        <ItemDescription className="truncate">
          {order.store} · #{order.orderNo}
        </ItemDescription>
      </ItemContent>
      <div className="grid min-w-0 shrink-0 grid-cols-[minmax(7rem,11rem)_8rem] items-center gap-6 text-right">
        <span className="truncate text-sm text-muted-foreground">
          {order.summary}
        </span>
        <span className="truncate font-semibold">
          {order.amount === null ? "—" : formatPrice(order.amount)}
        </span>
      </div>
      {order.href ? (
        <ItemActions>
          <span className="text-sm font-medium text-primary">查看详情</span>
        </ItemActions>
      ) : null}
    </Item>
  )

  if (!order.href) return <div className="opacity-60">{content}</div>
  return (
    <Link
      href={order.href}
      prefetch={false}
      className="block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  )
}

function mapSpotOrder(order: SpotOrder, view: "buyer" | "seller"): RenderableOrder {
  const id = parsePositiveInt64RouteId(order.id)
  const status =
    view === "seller" && order.status === "pending_payment"
      ? "pending_confirm"
      : order.status === "paid" && view === "buyer"
        ? "processing"
        : order.status
  const returnTo = `/orders${view === "seller" ? "?view=seller" : ""}`
  return {
    id: `${view}-${order.id}`,
    orderNo: order.orderNo || order.id,
    type: "spot",
    view,
    title: order.productTitle,
    store: order.store?.name ?? "现货店铺",
    status,
    amount: order.totalAmountCents,
    summary: `现货 × ${order.quantity}`,
    href: id
      ? `/orders/spot/${id}?view=${view}&returnTo=${encodeURIComponent(returnTo)}`
      : null,
  }
}

function mapBuyerErrandOrder(order: BuyerErrandOrder): RenderableOrder {
  const id = parsePositiveInt64RouteId(order.id)
  return {
    id: `participant-${order.id}`,
    orderNo: order.id,
    type: "errand",
    view: "participant",
    title:
      order.productTemplates
        .slice(0, 3)
        .map((template) => template.title)
        .join("、") || "跑腿需求",
    store: order.store?.name ?? "跑腿店铺",
    status: order.status,
    amount:
      (order.totalActualAmountCents ?? order.totalOriginAmountCents) +
      order.totalServiceFeeCents,
    summary: `${order.productTotalCount} 种商品 · 跑腿费 ${formatPrice(order.totalServiceFeeCents)}`,
    href: id ? `/orders/errand/${id}` : null,
  }
}

function mapErrandTask(task: ErrandTaskBrief): RenderableOrder {
  const id = parsePositiveInt64RouteId(task.id)
  return {
    id: `captain-${task.id}`,
    orderNo: task.id,
    type: "errand",
    view: "captain",
    title: task.storeName,
    store: "采购任务",
    status: task.status,
    amount: null,
    summary: `${task.itemCount} 种商品`,
    href: id ? `/group/purchase/${id}` : null,
  }
}

function filterOrders(
  orders: RenderableOrder[],
  filters: OrderFilters,
): RenderableOrder[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN")
  return orders.filter(
    (order) =>
      order.type === filters.type &&
      order.view === filters.view &&
      matchesOrderStatus(filters.status, order.status) &&
      (!query ||
        order.title.toLocaleLowerCase("zh-CN").includes(query) ||
        order.store.toLocaleLowerCase("zh-CN").includes(query) ||
        order.orderNo.toLocaleLowerCase("zh-CN").includes(query)),
  )
}

function rememberView(
  remembered: RememberedOrderViews,
  filters: Pick<OrderFilters, "type" | "view">,
): RememberedOrderViews {
  if (filters.type === "spot" && (filters.view === "buyer" || filters.view === "seller")) {
    return { ...remembered, spot: filters.view }
  }
  if (
    filters.type === "errand" &&
    (filters.view === "participant" || filters.view === "captain")
  ) {
    return { ...remembered, errand: filters.view }
  }
  return remembered
}

function getCurrentError(
  filters: OrderFilters,
  errors: OrdersViewProps["errors"],
): boolean {
  if (filters.type === "spot" && filters.view === "seller") return errors.spotSeller
  if (filters.type === "errand" && filters.view === "participant") {
    return errors.errandParticipant
  }
  if (filters.type === "errand" && filters.view === "captain") {
    return errors.errandCaptain
  }
  return errors.spotBuyer
}
