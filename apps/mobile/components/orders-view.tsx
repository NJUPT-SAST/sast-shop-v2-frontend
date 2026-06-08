"use client"

import { useMemo, useState } from "react"
import {
  RiFileList3Line,
  RiRunLine,
  RiSearchLine,
  RiShoppingBag3Line,
} from "@remixicon/react"
import type { SpotOrder } from "@sast-shop/api"
import { formatPrice } from "@sast-shop/domain"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { cn } from "@workspace/ui/lib/utils"

type Source = "spot" | "errand" | "captain"
type Status = "all" | "pending_payment" | "paid" | "completed" | "cancelled"

const sourceOptions: { value: Source; label: string }[] = [
  { value: "spot", label: "现货订单" },
  { value: "errand", label: "跑腿订单" },
  { value: "captain", label: "团长任务" },
]

const statusOptions: { value: Status; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending_payment", label: "待支付" },
  { value: "paid", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
]

const statusLabel: Record<string, string> = {
  pending_payment: "待支付",
  paid: "处理中",
  completed: "已完成",
  cancelled: "已取消",
  unknown: "未知",
}

export function OrdersView({
  spotOrders,
  error,
}: {
  spotOrders: SpotOrder[]
  error: string | null
}) {
  const [source, setSource] = useState<Source>("spot")
  const [status, setStatus] = useState<Status>("all")
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const orders = useMemo(
    () =>
      spotOrders.map((order) => ({
        id: order.orderNo || order.id,
        source: "spot" as const,
        title: order.productTitle,
        store: order.store?.name ?? "现货",
        status: order.status,
        amount: order.totalAmountCents,
        summary: `现货 x${order.quantity}`,
      })),
    [spotOrders]
  )
  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.source === source &&
          (status === "all" || order.status === status) &&
          (!normalizedQuery ||
            order.store.toLowerCase().includes(normalizedQuery) ||
            order.title.toLowerCase().includes(normalizedQuery))
      ),
    [normalizedQuery, orders, source, status]
  )

  return (
    <div className="flex flex-1 flex-col gap-5 py-6">
      <section className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold md:text-2xl">订单</h1>
        <p className="text-sm text-muted-foreground">
          {error ?? "按订单类型分别查看。"}
        </p>
      </section>

      <Tabs
        value={source}
        onValueChange={(value) => {
          setSource(value as Source)
          setStatus("all")
        }}
      >
        <TabsList className="grid w-full grid-cols-3 md:w-fit">
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
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-9"
                  placeholder="搜索店铺或订单"
                />
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
                {statusOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={status === option.value ? "default" : "outline"}
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => setStatus(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </section>

            {item.value === "spot" ? (
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
                        {statusLabel[order.status]}
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
            ) : (
              <Card className="mt-3 rounded-lg">
                <CardHeader>
                  <CardTitle className="text-base">接口接入中</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    这里不会展示本地伪造订单；接入 errand/task 的 Connect facade
                    后再从 6660 mock 服务读取。
                  </p>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {source === "spot" && filteredOrders.length === 0 ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-base">暂无匹配订单</CardTitle>
            <p className="text-sm text-muted-foreground">
              换一个订单类型或清空筛选条件。
            </p>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  )
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
