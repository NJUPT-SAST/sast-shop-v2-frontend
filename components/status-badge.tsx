"use client"

import type { CfMode, ListingStatus, OrderStatus, ShippingStatus } from "@/lib/api/types"
import { Chip } from "@heroui/react"

type ChipColor = "default" | "accent" | "success" | "warning" | "danger"

const LISTING_STATUS_LABELS: Record<ListingStatus, { color: ChipColor; text: string }> = {
  draft: { color: "default", text: "草稿" },
  pending_review: { color: "warning", text: "待审核" },
  rejected: { color: "danger", text: "已拒绝" },
  voting: { color: "accent", text: "投票中" },
  active: { color: "success", text: "进行中" },
  funded: { color: "success", text: "众筹达成" },
  completed: { color: "default", text: "已完成" },
  closed: { color: "default", text: "已关闭" },
}

const ORDER_STATUS_LABELS: Record<OrderStatus, { color: ChipColor; text: string }> = {
  pending_payment: { color: "warning", text: "待支付" },
  pending_confirm: { color: "warning", text: "待卖家确认" },
  paid: { color: "success", text: "已支付" },
  producing: { color: "accent", text: "生产中" },
  shipped: { color: "accent", text: "已发货" },
  completed: { color: "success", text: "已收货" },
  refunding: { color: "warning", text: "退款中" },
  refunded: { color: "default", text: "已退款" },
  closed: { color: "default", text: "已关闭" },
}

const SHIPPING_STATUS_LABELS: Record<ShippingStatus, { color: ChipColor; text: string }> = {
  pending: { color: "warning", text: "待确认运费" },
  awaiting_confirm: { color: "warning", text: "运费待确认" },
  awaiting_payment: { color: "warning", text: "待付运费" },
  paid: { color: "success", text: "运费已支付" },
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const { color, text } = LISTING_STATUS_LABELS[status]
  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{text}</Chip.Label>
    </Chip>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { color, text } = ORDER_STATUS_LABELS[status]
  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{text}</Chip.Label>
    </Chip>
  )
}

export function ShippingStatusBadge({ status }: { status: ShippingStatus }) {
  const { color, text } = SHIPPING_STATUS_LABELS[status]
  return (
    <Chip color={color} size="sm" variant="soft">
      <Chip.Label>{text}</Chip.Label>
    </Chip>
  )
}

export function ListingTypeBadge({
  type,
  cfMode,
}: {
  type: "secondhand" | "crowdfund" | "direct_sale"
  cfMode?: CfMode | null
}) {
  if (type === "secondhand") {
    return (
      <Chip color="default" size="sm" variant="primary">
        <Chip.Label>二手</Chip.Label>
      </Chip>
    )
  }
  if (type === "direct_sale") {
    return (
      <Chip color="accent" size="sm" variant="primary">
        <Chip.Label>直售</Chip.Label>
      </Chip>
    )
  }
  // crowdfund: vote_first → mint (success), presale → coral (accent).
  if (cfMode === "vote_first") {
    return (
      <Chip color="success" size="sm" variant="primary">
        <Chip.Label>众筹·投票</Chip.Label>
      </Chip>
    )
  }
  return (
    <Chip color="accent" size="sm" variant="primary">
      <Chip.Label>众筹·预售</Chip.Label>
    </Chip>
  )
}
