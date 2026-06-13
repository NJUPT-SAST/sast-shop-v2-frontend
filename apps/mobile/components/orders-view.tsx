"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { RiFileList3Line, RiSearchLine } from "@remixicon/react"
import type { BuyerErrandOrder, ErrandTaskBrief, SpotOrder } from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Empty } from "@workspace/ui/components/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@workspace/ui/components/input-group"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { PerspectiveSwitch } from "@/components/perspective-switch"
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
  const [filters, setFilters] = useState<OrderFilters>(initialFilters)
  const [rememberedViews, setRememberedViews] = useState<RememberedOrderViews>(
    () =>
      rememberOrderView(
        DEFAULT_REMEMBERED_ORDER_VIEWS,
        initialFilters.type,
        initialFilters.view
      )
  )
  const statusOptions = getStatusOptions(filters.type, filters.view)
  const viewOptions = getViewOptions(filters.type)
  const currentTypeLabel = filters.type === "spot" ? "现货订单" : "跑腿订单"
  const orders = useMemo<RenderableOrder[]>(
    () => [
      ...spotBuyerOrders.map((order) => mapSpotOrder(order, "buyer")),
      ...spotSellerOrders.map((order) => mapSpotOrder(order, "seller")),
      ...buyerErrandOrders.map(mapBuyerErrandOrder),
      ...errandTasks.map(mapErrandTaskBrief),
    ],
    [buyerErrandOrders, errandTasks, spotBuyerOrders, spotSellerOrders]
  )
  const filteredOrders = useMemo(
    () => filterOrders(orders, filters),
    [filters, orders]
  )
  const currentError = getCurrentError(filters, errors)
  const countLabel = currentError ? "暂不可用" : `共 ${filteredOrders.length} 笔`

  useEffect(() => {
    const syncFiltersFromLocation = () => {
      const nextFilters = getOrderFiltersFromParams(
        new URLSearchParams(window.location.search)
      )

      setFilters(nextFilters)
      setRememberedViews((current) =>
        rememberOrderView(current, nextFilters.type, nextFilters.view)
      )
    }

    syncFiltersFromLocation()
    window.addEventListener("popstate", syncFiltersFromLocation)

    return () => {
      window.removeEventListener("popstate", syncFiltersFromLocation)
    }
  }, [])

  function updateFilters(updates: {
    type?: OrderType
    view?: OrderView
    status?: OrderStatus
    q?: string
  }) {
    const nextRememberedViews = updates.view
      ? rememberOrderView(rememberedViews, filters.type, updates.view)
      : rememberedViews
    const currentParams = updateOrderFilterParams(
      new URLSearchParams(window.location.search),
      {
        type: filters.type,
        view: filters.view,
        status: filters.status,
        q: filters.query,
        rememberedViews,
      }
    )
    const nextParams = updateOrderFilterParams(
      currentParams,
      {
        ...updates,
        rememberedViews: nextRememberedViews,
      }
    )
    const nextFilters = getOrderFiltersFromParams(nextParams)

    setFilters(nextFilters)
    if (nextRememberedViews !== rememberedViews) {
      setRememberedViews(nextRememberedViews)
    }

    router.replace(
      nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname,
      { scroll: false }
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold md:text-2xl">订单</h1>
        <p className="shrink-0 text-sm text-muted-foreground">
          {countLabel}
        </p>
      </section>

      <Tabs
        value={filters.type}
        onValueChange={(value) => updateFilters({ type: value as OrderType })}
        className="flex-col"
      >
        <TabsList className="grid h-9 w-full grid-cols-2 md:w-fit">
          {orderTypeOptions.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <section className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold leading-8">
          {currentTypeLabel}
        </h2>
        <PerspectiveSwitch
          label={`${currentTypeLabel}视角`}
          value={filters.view}
          options={viewOptions}
          onValueChange={(value) => updateFilters({ view: value })}
          className="shrink-0"
        />
      </section>

      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>
            <RiSearchLine className="size-4" />
          </InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="搜索店铺或商品"
          value={filters.query}
          onChange={(event) => updateFilters({ q: event.target.value })}
          placeholder="搜索店铺或商品"
        />
      </InputGroup>

      <div className="flex flex-wrap gap-1.5">
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={filters.status === option.value ? "default" : "outline"}
            size="xs"
            aria-pressed={filters.status === option.value}
            className="rounded-full px-2 text-[11px]"
            onClick={() => updateFilters({ status: option.value })}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <OrderList
        filters={filters}
        orders={filteredOrders}
        hasError={currentError}
      />
    </div>
  )
}

function OrderList({
  filters,
  orders,
  hasError,
}: {
  filters: OrderFilters
  orders: RenderableOrder[]
  hasError: boolean
}) {
  if (hasError) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title="订单暂不可用"
        description="当前订单列表加载失败，请稍后重试。"
      />
    )
  }

  if (orders.length === 0) {
    return (
      <Empty
        icon={<RiFileList3Line className="size-5" />}
        title={getEmptyTitle(filters)}
        description="换一个状态或清空搜索条件。"
      />
    )
  }

  return (
    <section className="grid gap-3 md:grid-cols-2">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </section>
  )
}

function OrderCard({ order }: { order: RenderableOrder }) {
  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="max-w-32 truncate font-mono text-xs text-muted-foreground md:max-w-none">
              #{order.orderNo}
            </p>
            <CardTitle className="mt-2 truncate text-base leading-6">
              {order.title}
            </CardTitle>
          </div>
          <Badge
            variant={getStatusBadgeVariant(order.status)}
            className="shrink-0"
          >
            {getStatusLabel(order.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">
            {order.store}
          </p>
          <p className="mt-1 truncate text-sm">{order.summary}</p>
        </div>
        {order.amount !== null ? (
          <p className="shrink-0 text-base font-semibold text-primary">
            {formatPrice(order.amount)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function getEmptyTitle(filters: OrderFilters): string {
  if (filters.type === "spot" && filters.view === "seller") {
    return "暂无现货卖方订单"
  }

  if (filters.type === "errand" && filters.view === "participant") {
    return "暂无跑腿拼单订单"
  }

  if (filters.type === "errand" && filters.view === "captain") {
    return "暂无团长任务"
  }

  return "暂无现货买方订单"
}

function getCurrentError(
  filters: OrderFilters,
  errors: OrdersViewProps["errors"]
): boolean {
  if (filters.type === "spot" && filters.view === "seller") {
    return errors.spotSeller
  }

  if (filters.type === "errand" && filters.view === "participant") {
    return errors.errandParticipant
  }

  if (filters.type === "errand" && filters.view === "captain") {
    return errors.errandCaptain
  }

  return errors.spotBuyer
}

function mapSpotOrder(
  order: SpotOrder,
  view: "buyer" | "seller"
): RenderableOrder {
  return {
    id: `${view}-${order.id}`,
    orderNo: order.orderNo || order.id,
    type: "spot",
    view,
    title: order.productTitle,
    store: order.store?.name ?? "现货",
    status: normalizeSpotStatus(order.status, view),
    amount: order.totalAmountCents,
    summary: `现货 x${order.quantity}`,
  }
}

function mapBuyerErrandOrder(order: BuyerErrandOrder): RenderableOrder {
  const amount =
    order.totalActualAmountCents ??
    order.totalOriginAmountCents + order.totalServiceFeeCents

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
    amount,
    summary: `${order.productTotalCount} 种商品 · 跑腿费 ${formatPrice(
      order.totalServiceFeeCents
    )}`,
  }
}

function mapErrandTaskBrief(task: ErrandTaskBrief): RenderableOrder {
  return {
    id: `captain-${task.id}`,
    orderNo: task.id,
    type: "errand",
    view: "captain",
    title: `${task.storeName}采购任务`,
    store: task.storeName,
    status: task.status,
    amount: null,
    summary: `${task.itemCount} 种商品`,
  }
}

function normalizeSpotStatus(
  status: SpotOrder["status"],
  view: "buyer" | "seller"
): RenderableOrderStatus {
  if (view === "seller" && status === "pending_payment") {
    return "pending_confirm"
  }

  if (status === "paid") {
    return view === "seller" ? "paid" : "processing"
  }

  return status
}

function filterOrders(
  orders: RenderableOrder[],
  filters: OrderFilters
): RenderableOrder[] {
  const query = filters.query.trim().toLowerCase()

  return orders.filter(
    (order) =>
      order.type === filters.type &&
      order.view === filters.view &&
      matchesRenderableStatus(filters, order.status) &&
      (!query ||
        order.store.toLowerCase().includes(query) ||
        order.title.toLowerCase().includes(query))
  )
}

function matchesRenderableStatus(
  filters: OrderFilters,
  status: RenderableOrderStatus
): boolean {
  if (
    filters.type === "spot" &&
    filters.view === "seller" &&
    filters.status === "processing"
  ) {
    return status === "processing"
  }

  return matchesOrderStatus(filters.status, status)
}

function rememberOrderView(
  rememberedViews: RememberedOrderViews,
  type: OrderType,
  view: OrderView
): RememberedOrderViews {
  if (type === "spot" && (view === "buyer" || view === "seller")) {
    return { ...rememberedViews, spot: view }
  }

  if (type === "errand" && (view === "participant" || view === "captain")) {
    return { ...rememberedViews, errand: view }
  }

  return rememberedViews
}
