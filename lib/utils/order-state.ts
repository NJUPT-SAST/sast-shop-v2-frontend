// Drives the order detail page. The 13 distinct states are derived from the
// (status, shipping_mode, shipping_status, payment_mode) tuple. Centralising
// the mapping here keeps the UI dumb and makes the state machine testable.

import type { Order } from "@/lib/api/types"

export type OrderViewKey =
  | "pending_payment"
  | "pending_confirm"
  | "paid"
  | "producing"
  | "shipped"
  | "completed"
  | "shipping_fee_pending"
  | "shipping_fee_paying"
  | "shipping_fee_paid"
  | "refunding"
  | "refunded"
  | "closed"

export type OrderStateLabel = {
  badge: "warning" | "primary" | "success" | "danger" | "default"
  text: string
  hint?: string
}

export const ORDER_STATE_LABELS: Record<OrderViewKey, OrderStateLabel> = {
  pending_payment: { badge: "warning", text: "待支付", hint: "请尽快完成付款" },
  pending_confirm: {
    badge: "warning",
    text: "等待卖家确认",
    hint: "卖家将在确认收款后开始备货",
  },
  paid: { badge: "success", text: "已支付", hint: "卖家正在备货" },
  producing: { badge: "primary", text: "生产中", hint: "等待商品发出" },
  shipped: { badge: "primary", text: "已发货", hint: "请留意物流信息" },
  completed: { badge: "success", text: "已收货", hint: "感谢支持" },
  shipping_fee_pending: { badge: "warning", text: "等待卖家确认运费" },
  shipping_fee_paying: { badge: "warning", text: "请支付运费" },
  shipping_fee_paid: { badge: "success", text: "运费已支付" },
  refunding: { badge: "warning", text: "退款中" },
  refunded: { badge: "default", text: "已退款" },
  closed: { badge: "default", text: "已关闭" },
}

export function getOrderViewKey(order: Order): OrderViewKey {
  // The shipping fee branch only matters for variable-shipping orders that
  // are between paid and shipped. After ship/completed, fall back to main.
  if (
    order.listing.shipping_mode === "variable" &&
    order.shipping_status &&
    order.shipping_status !== "paid" &&
    (order.status === "paid" || order.status === "producing")
  ) {
    if (order.shipping_status === "pending") return "shipping_fee_pending"
    if (order.shipping_status === "awaiting_confirm") return "shipping_fee_pending"
    if (order.shipping_status === "awaiting_payment") return "shipping_fee_paying"
  }

  return order.status as OrderViewKey
}

export function getOrderLabel(order: Order): OrderStateLabel {
  return ORDER_STATE_LABELS[getOrderViewKey(order)] ?? ORDER_STATE_LABELS.closed
}

// Step indicator descriptors for the progress bar component (5 main steps).
// Variable shipping inserts the shipping-fee sub-flow as a branch.
export type OrderStep = {
  key: string
  label: string
  // Index in the 5-step main sequence the step belongs to.
  index: number
  // Reached/active state derived from the order status.
  state: "done" | "active" | "todo"
}

const MAIN_STEPS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: "placed", label: "下单", statuses: ["pending_payment"] },
  {
    key: "paid",
    label: "已支付",
    statuses: ["pending_confirm", "paid"],
  },
  { key: "producing", label: "生产中", statuses: ["producing"] },
  { key: "shipped", label: "已发货", statuses: ["shipped"] },
  { key: "completed", label: "已收货", statuses: ["completed"] },
]

export function getOrderProgressSteps(order: Order): OrderStep[] {
  const reachedIdx = MAIN_STEPS.findIndex((s) => s.statuses.includes(order.status))
  // pending_payment is the "active 0" — for everything beyond, the first step is done.
  // Statuses we don't recognise (e.g. closed/refunded) leave all steps grey.
  return MAIN_STEPS.map((s, i) => {
    let state: OrderStep["state"] = "todo"
    if (reachedIdx === -1) state = "todo"
    else if (i < reachedIdx) state = "done"
    else if (i === reachedIdx) state = "active"
    return { key: s.key, label: s.label, index: i, state }
  })
}

// What action(s) the current viewer can take. Caller must check role.
export type OrderAction =
  | "buyer_pay"
  | "buyer_confirm_receipt"
  | "buyer_supply_trade_no"
  | "buyer_pay_shipping"
  | "buyer_complete"
  | "seller_confirm_payment"
  | "seller_set_shipping_fee"
  | "seller_ship"

export function getBuyerActions(order: Order): OrderAction[] {
  const actions: OrderAction[] = []
  switch (order.status) {
    case "pending_payment":
      actions.push("buyer_pay", "buyer_supply_trade_no")
      break
    case "pending_confirm":
      // No buyer action — just wait. Trade no can be supplied if missing.
      if (!order.payment_trade_no) actions.push("buyer_supply_trade_no")
      break
    case "shipped":
      actions.push("buyer_complete")
      break
  }
  if (order.listing.shipping_mode === "variable" && order.shipping_status === "awaiting_payment") {
    actions.push("buyer_pay_shipping")
  }
  return actions
}

export function getSellerActions(order: Order): OrderAction[] {
  const actions: OrderAction[] = []
  switch (order.status) {
    case "pending_confirm":
      actions.push("seller_confirm_payment")
      break
    case "paid":
    case "producing":
      if (order.listing.shipping_mode === "variable" && order.shipping_status === "pending") {
        actions.push("seller_set_shipping_fee")
      } else if (order.tracking_number === null) {
        actions.push("seller_ship")
      }
      break
  }
  return actions
}
