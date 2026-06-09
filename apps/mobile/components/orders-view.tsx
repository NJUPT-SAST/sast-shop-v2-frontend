"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  RiFileList3Line,
  RiRunLine,
  RiSearchLine,
  RiShoppingBag3Line,
} from "@remixicon/react"
import type { BuyerErrandOrder, SpotOrder } from "@sast-shop/api"
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
import { Input } from "@workspace/ui/components/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

type Source = "spot" | "errand" | "captain"
type Perspective = "purchaser" | "seller"
type Status = "all" | SpotOrder["status"] | BuyerErrandOrder["status"]
type OrderFilters = {
  source: Source
  perspective: Perspective
  status: Status
  query: string
}
type RenderableOrder = {
  id: string
  source: Exclude<Source, "captain">
  title: string
  store: string
  status: Exclude<Status, "all">
  amount: number
  summary: string
}

const sourceOptions: { value: Source; label: string }[] = [
  { value: "spot", label: "现货订单" },
  { value: "errand", label: "跑腿订单" },
  { value: "captain", label: "团长任务" },
]

const spotStatusOptions: { value: Status; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待支付" },
  { value: "paid", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

const errandStatusOptions: { value: Status; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "open", label: "未接单" },
  { value: "shopping", label: "采购中" },
  { value: "pending_distributing", label: "待分发" },
  { value: "distributing", label: "分发中" },
  { value: "pending_payment", label: "待支付" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

const captainStatusOptions: { value: Status; label: string }[] = [
  { value: "all", label: "全部" },
]

const statusOptionsBySource: Record<Source, { value: Status; label: string }[]> =
  {
    spot: spotStatusOptions,
    errand: errandStatusOptions,
    captain: captainStatusOptions,
  }

const perspectiveOptions: { value: Perspective; label: string }[] = [
  { value: "purchaser", label: "我买的" },
  { value: "seller", label: "我卖的" },
]

const DEFAULT_ORDER_FILTERS = {
  source: "spot",
  perspective: "purchaser",
  status: "all",
  query: "",
} satisfies OrderFilters

const spotStatusLabel: Record<string, string> = {
  pending_payment: "待支付",
  paid: "处理中",
  completed: "已完成",
  cancelled: "已取消",
  unknown: "未知",
}

const errandStatusLabel: Record<string, string> = {
  open: "未接单",
  shopping: "采购中",
  pending_distributing: "待分发",
  distributing: "分发中",
  pending_payment: "待支付",
  completed: "已完成",
  cancelled: "已取消",
  unknown: "未知",
}

export function OrdersView({
  spotOrders,
  buyerErrandOrders,
  error,
}: {
  spotOrders: SpotOrder[]
  buyerErrandOrders: BuyerErrandOrder[]
  error: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [filters, setFilters] = useState<OrderFilters>(DEFAULT_ORDER_FILTERS)
  const { source, perspective, status, query } = filters
  const normalizedQuery = query.trim().toLowerCase()
  const orders = useMemo<RenderableOrder[]>(
    () => [
      ...spotOrders.map((order) => ({
        id: order.orderNo || order.id,
        source: "spot" as const,
        title: order.productTitle,
        store: order.store?.name ?? "现货",
        status: order.status,
        amount: order.totalAmountCents,
        summary: `现货 x${order.quantity}`,
      })),
      ...buyerErrandOrders.map((order) => ({
        id: order.id,
        source: "errand" as const,
        title:
          order.productTemplates
            .slice(0, 3)
            .map((template) => template.title)
            .join("、") || "跑腿需求",
        store: order.store?.name ?? "跑腿店铺",
        status: order.status,
        amount:
          order.totalActualAmountCents ??
          order.totalOriginAmountCents + order.totalServiceFeeCents,
        summary: `${order.productTotalCount} 种商品 · 跑腿费 ${formatPrice(
          order.totalServiceFeeCents
        )}`,
      })),
    ],
    [buyerErrandOrders, spotOrders]
  )
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.source === source &&
          perspective === "purchaser" &&
          (status === "all" || order.status === status) &&
          (!normalizedQuery ||
            order.store.toLowerCase().includes(normalizedQuery) ||
            order.title.toLowerCase().includes(normalizedQuery))
      ),
    [normalizedQuery, orders, perspective, source, status]
  )
  const currentStatusOptions = statusOptionsBySource[source]

  useEffect(() => {
    let timeoutId: number | null = null
    const syncFiltersFromLocation = () => {
      const nextFilters = getOrderFiltersFromLocation()

      timeoutId = window.setTimeout(() => {
        setFilters(nextFilters)
      }, 0)
    }

    syncFiltersFromLocation()
    window.addEventListener("popstate", syncFiltersFromLocation)

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
      window.removeEventListener("popstate", syncFiltersFromLocation)
    }
  }, [])

  function updateQuery(updates: {
    source?: Source
    perspective?: Perspective
    status?: Status
    q?: string
  }) {
    const params = new URLSearchParams(window.location.search)
    const nextSource = updates.source ?? source
    const nextPerspective = updates.perspective ?? perspective
    const nextStatus = updates.status ?? status
    const nextQuery = updates.q ?? query
    const nextFilters = {
      source: nextSource,
      perspective: nextPerspective,
      status: nextStatus,
      query: nextQuery,
    }

    setQueryParam(params, "source", nextSource, "spot")
    setQueryParam(params, "perspective", nextPerspective, "purchaser")
    setQueryParam(params, "status", nextStatus, "all")
    setQueryParam(params, "q", nextQuery.trim(), "")
    setFilters(nextFilters)
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    })
  }

  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold md:text-2xl">订单</h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "按订单类型分别查看。"}
        </p>
      </section>

      <Tabs
        value={perspective}
        onValueChange={(value) =>
          updateQuery({ perspective: value as Perspective, status: "all" })
        }
        className="flex-col"
      >
        <TabsList className="grid h-9 w-full grid-cols-2 md:w-fit">
          {perspectiveOptions.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Tabs
        value={source}
        onValueChange={(value) => {
          updateQuery({ source: value as Source, status: "all" })
        }}
        className="flex-col"
      >
        <TabsList className="grid h-9 w-full grid-cols-3 md:w-fit">
          {sourceOptions.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {sourceOptions.map((item) => (
          <TabsContent key={item.value} value={item.value} className="mt-3">
            <section className="flex flex-col gap-3 rounded-lg border bg-card p-3">
              <div className="relative">
                <RiSearchLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => updateQuery({ q: event.target.value })}
                  className="pl-9"
                  placeholder="搜索店铺或商品"
                />
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
                {currentStatusOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={status === option.value ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => updateQuery({ status: option.value })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </section>

            {(item.value === "spot" || item.value === "errand") &&
            perspective === "purchaser" ? (
              <section className="mt-3 grid gap-3 md:grid-cols-2">
                {filteredOrders.map((order) => (
                  <Card key={order.id} className="rounded-lg">
                    <CardHeader className="gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{order.id}
                            </span>
                            <SourceIcon source={order.source} />
                          </div>
                          <CardTitle className="mt-2 truncate text-base leading-6">
                            {order.title}
                          </CardTitle>
                        </div>
                        <Badge
                          className={cn(
                            order.status === "completed" &&
                              "bg-secondary text-secondary-foreground"
                          )}
                        >
                          {getStatusLabel(order)}
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
                      <p className="shrink-0 text-base font-semibold text-primary">
                        {formatPrice(order.amount)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </section>
            ) : item.value === "spot" ? (
              <Empty
                icon={<RiShoppingBag3Line className="size-5" />}
                title="暂无卖家订单"
                description="卖家视角订单准备好后会在这里展示。"
                className="mt-3"
              />
            ) : item.value === "errand" ? (
              <Empty
                icon={<RiRunLine className="size-5" />}
                title="跑腿没有卖家视角"
                description="跑腿订单请在我买的中查看。"
                className="mt-3"
              />
            ) : (
              <Empty
                icon={<RiFileList3Line className="size-5" />}
                title="团长任务暂未开放"
                description="后续可以在这里查看分发、结算和履约任务。"
                className="mt-3"
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {(source === "spot" || source === "errand") &&
      perspective === "purchaser" &&
      filteredOrders.length === 0 ? (
        <Empty
          icon={
            source === "spot" ? (
              <RiShoppingBag3Line className="size-5" />
            ) : (
              <RiRunLine className="size-5" />
            )
          }
          title="暂无匹配订单"
          description="换一个状态或清空搜索条件。"
        />
      ) : null}
    </div>
  )
}

function isSource(value: string | null): value is Source {
  return value === "spot" || value === "errand" || value === "captain"
}

function isPerspective(value: string | null): value is Perspective {
  return value === "purchaser" || value === "seller"
}

function isStatus(value: string | null): value is Status {
  return (
    value === "all" ||
    value === "open" ||
    value === "shopping" ||
    value === "pending_distributing" ||
    value === "distributing" ||
    value === "pending_payment" ||
    value === "paid" ||
    value === "completed" ||
    value === "cancelled" ||
    value === "unknown"
  )
}

function isStatusForSource(source: Source, value: string | null): value is Status {
  return (
    isStatus(value) &&
    statusOptionsBySource[source].some((option) => option.value === value)
  )
}

function setQueryParam(
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string
) {
  if (value && value !== defaultValue) {
    params.set(key, value)
  } else {
    params.delete(key)
  }
}

function getOrderFiltersFromLocation(): OrderFilters {
  const params = new URLSearchParams(window.location.search)
  const sourceParam = params.get("source")
  const perspectiveParam = params.get("perspective")
  const statusParam = params.get("status")
  const source = isSource(sourceParam) ? sourceParam : DEFAULT_ORDER_FILTERS.source

  return {
    source,
    perspective: isPerspective(perspectiveParam)
      ? perspectiveParam
      : DEFAULT_ORDER_FILTERS.perspective,
    status: isStatusForSource(source, statusParam)
      ? statusParam
      : DEFAULT_ORDER_FILTERS.status,
    query: params.get("q") ?? DEFAULT_ORDER_FILTERS.query,
  }
}

function SourceIcon({ source }: { source: Source }) {
  const Icon =
    source === "spot"
      ? RiShoppingBag3Line
      : source === "errand"
        ? RiRunLine
        : RiFileList3Line

  return (
    <span className="flex size-6 items-center justify-center rounded-md bg-muted text-primary">
      <Icon className="size-4" />
    </span>
  )
}

function getStatusLabel(order: RenderableOrder) {
  if (order.source === "errand") {
    return errandStatusLabel[order.status] ?? errandStatusLabel.unknown
  }

  return spotStatusLabel[order.status] ?? spotStatusLabel.unknown
}
