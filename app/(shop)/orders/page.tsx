"use client"

import { InfiniteList } from "@/components/infinite-list"
import { MobileHeader } from "@/components/layout/mobile-header"
import { StaggerItem, StaggerList } from "@/components/motion/stagger"
import { EmptyState } from "@/components/states/empty-state"
import { SkeletonList } from "@/components/states/skeleton-list"
import { OrderStatusBadge } from "@/components/status-badge"
import { useInfiniteOrders } from "@/lib/api/infinite-queries"
import type { Order, OrderStatus } from "@/lib/api/types"
import { usePreferenceStore } from "@/lib/stores/preference-store"
import { formatDateTime, formatPrice } from "@/lib/utils/format"
import { getBuyerActions, getSellerActions } from "@/lib/utils/order-state"
import { Button, Card, Chip } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { useState } from "react"

const ROLE_TABS = [
  { v: "buyer" as const, label: "我买的", icon: "material-symbols:shopping-bag-rounded" },
  { v: "seller" as const, label: "我卖的", icon: "material-symbols:storefront-rounded" },
]

const STATUS_TABS: Array<{ v?: OrderStatus; label: string }> = [
  { v: undefined, label: "全部" },
  { v: "pending_payment", label: "待支付" },
  { v: "paid", label: "进行中" },
  { v: "shipped", label: "待收货" },
  { v: "completed", label: "已完成" },
]

export default function OrdersPage() {
  const role = usePreferenceStore((s) => s.ordersRole)
  const setRole = usePreferenceStore((s) => s.setOrdersRole)
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined)
  const query = useInfiniteOrders({ role, status })

  return (
    <>
      <MobileHeader title="我的订单" />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-4 py-4 md:gap-4 md:px-8 md:py-8">
        <header className="hidden md:flex md:items-baseline md:justify-between">
          <h1 className="text-[24px] font-semibold text-shop-text-primary">我的订单</h1>
        </header>

        <div className="flex gap-2 self-start rounded-shop-pill bg-shop-bg-white p-1 shadow-shop-sm">
          {ROLE_TABS.map((tab) => (
            <Button
              className="rounded-shop-pill"
              key={tab.v}
              onPress={() => setRole(tab.v)}
              size="sm"
              variant={role === tab.v ? "primary" : "ghost"}
            >
              <Icon className="size-4" icon={tab.icon} />
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <Button
              className="shrink-0 rounded-shop-pill"
              key={tab.label}
              onPress={() => setStatus(tab.v)}
              size="sm"
              variant={status === tab.v ? "primary" : "outline"}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <InfiniteList
          query={query}
          renderEmpty={
            <EmptyState
              description={role === "buyer" ? "去逛逛二手或众筹专区吧" : "你还没有卖出商品"}
              icon="material-symbols:receipt-long-rounded"
              title="暂无订单"
            />
          }
          renderItems={(items) => (
            <StaggerList className="flex flex-col gap-3" lazy={items.length > 16}>
              {items.map((order) => (
                <StaggerItem key={order.id}>
                  <OrderRow order={order} role={role} />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
          renderSkeleton={<SkeletonList count={4} />}
        />
      </div>
    </>
  )
}

function buyerActionLabel(actions: ReturnType<typeof getBuyerActions>): string | null {
  if (actions.includes("buyer_pay")) return "去支付"
  if (actions.includes("buyer_pay_shipping")) return "支付运费"
  if (actions.includes("buyer_complete")) return "确认收货"
  if (actions.includes("buyer_supply_trade_no")) return "补填流水号"
  return null
}

function sellerActionLabel(actions: ReturnType<typeof getSellerActions>): string | null {
  if (actions.includes("seller_confirm_payment")) return "确认收款"
  if (actions.includes("seller_set_shipping_fee")) return "设置运费"
  if (actions.includes("seller_ship")) return "去发货"
  return null
}

function OrderRow({ order, role }: { order: Order; role: "buyer" | "seller" }) {
  const counterpart = role === "buyer" ? order.seller : order.buyer
  const cta =
    role === "buyer"
      ? buyerActionLabel(getBuyerActions(order))
      : sellerActionLabel(getSellerActions(order))
  return (
    <Link className="block focus:outline-none" href={`/orders/${order.id}`}>
      <Card className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-shop-lg active:translate-y-0 focus-within:ring-2 focus-within:ring-shop-primary focus-within:ring-offset-2">
        <Card.Content className="flex flex-col gap-3 p-4 md:p-5">
          <header className="flex items-baseline justify-between">
            <span className="text-[12px] text-shop-text-tertiary">
              {formatDateTime(order.created_at)}
            </span>
            <OrderStatusBadge status={order.status} />
          </header>
          <div className="flex gap-3">
            <div className="size-16 shrink-0 overflow-hidden rounded-shop-sm bg-shop-bg-tinted">
              {order.listing.image_url ? (
                <img alt="" className="size-full object-cover" src={order.listing.image_url} />
              ) : (
                <div className="flex size-full items-center justify-center text-shop-text-tertiary">
                  <Icon className="size-6" icon="material-symbols:image-rounded" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <span className="line-clamp-1 text-[14px] font-medium text-shop-text-primary">
                {order.listing.title}
              </span>
              <span className="text-[12px] text-shop-text-tertiary">
                数量 ×{order.quantity} · {role === "buyer" ? "卖家" : "买家"}：{counterpart.name}
              </span>
              <span className="text-[16px] font-bold tabular-nums text-shop-primary">
                <span className="text-[12px]">¥</span>
                {Number(order.amount).toFixed(2)}
              </span>
            </div>
            {cta ? (
              <Chip className="self-end" color="accent" size="sm" variant="soft">
                <Chip.Label>{cta}</Chip.Label>
              </Chip>
            ) : null}
          </div>
        </Card.Content>
      </Card>
    </Link>
  )
}
