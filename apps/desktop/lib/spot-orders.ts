import type {
  PaymentBillStatus,
  SpotOrder,
  SpotOrderStatusValue,
} from "@sast-shop/api"

export type SpotOrderView = "buyer" | "seller"
export type SpotOrderFilterStatus =
  | "all"
  | "pending_confirm"
  | "processing"
  | SpotOrderStatusValue

export interface SpotOrderFilters {
  view: SpotOrderView
  status: SpotOrderFilterStatus
  query: string
}

export interface SpotOrderActions {
  canCancel: boolean
  canPay: boolean
  canSupplementSerialNumber: boolean
  canConfirmPayment: boolean
  canComplete: boolean
}

const NO_ACTIONS: SpotOrderActions = {
  canCancel: false,
  canPay: false,
  canSupplementSerialNumber: false,
  canConfirmPayment: false,
  canComplete: false,
}

const SUPPORTED_STATUSES = new Set<SpotOrderFilterStatus>([
  "all",
  "pending_confirm",
  "processing",
  "pending_payment",
  "paid",
  "completed",
  "cancelled",
])

const ORDER_STATUS_RANK: Record<SpotOrderStatusValue, number> = {
  unknown: -1,
  pending_payment: 0,
  paid: 1,
  completed: 2,
  cancelled: 2,
}

export function getSpotOrderFilters(params: URLSearchParams): SpotOrderFilters {
  const view = params.get("view") === "seller" ? "seller" : "buyer"
  const rawStatus = params.get("status") ?? "all"
  const status = SUPPORTED_STATUSES.has(rawStatus as SpotOrderFilterStatus)
    ? (rawStatus as SpotOrderFilterStatus)
    : "all"
  return { view, status, query: params.get("q")?.trim() ?? "" }
}

export function updateSpotOrderFilterParams(
  current: URLSearchParams,
  updates: Partial<{ view: SpotOrderView; status: SpotOrderFilterStatus; query: string }>,
): URLSearchParams {
  const params = new URLSearchParams(current)
  if (updates.view) {
    params.set("view", updates.view)
    params.delete("status")
    params.delete("q")
  }
  if (updates.status !== undefined) {
    if (updates.status === "all") params.delete("status")
    else params.set("status", updates.status)
  }
  if (updates.query !== undefined) {
    if (updates.query.trim()) params.set("q", updates.query.trim())
    else params.delete("q")
  }
  return params
}

export function filterSpotOrders(
  orders: SpotOrder[],
  filters: SpotOrderFilters,
): SpotOrder[] {
  const keyword = filters.query.toLocaleLowerCase("zh-CN")
  return orders.filter((order) => {
    const statusMatches =
      filters.status === "all" ||
      (filters.status === "pending_confirm"
        ? order.status === "pending_payment" && order.bill?.status === "submitted"
        : filters.status === "processing"
          ? order.status === "paid"
          : filters.status === "pending_payment"
            ? order.status === "pending_payment" && order.bill?.status !== "submitted"
            : order.status === filters.status)
    if (!statusMatches) return false
    if (!keyword) return true
    return [
      order.orderNo,
      order.productTitle,
      order.productDescription,
      order.store?.name,
      order.seller?.name,
    ].some((value) => value?.toLocaleLowerCase("zh-CN").includes(keyword))
  })
}

export function reconcileSpotOrderUpdate(
  current: SpotOrder,
  incoming: SpotOrder,
): SpotOrder {
  if (current.id !== incoming.id) return incoming
  const currentRank = ORDER_STATUS_RANK[current.status]
  const incomingRank = ORDER_STATUS_RANK[incoming.status]
  if (incomingRank > currentRank) return incoming
  if (incomingRank < currentRank) return current
  return parseTimestamp(incoming.bill?.updatedAt) >=
    parseTimestamp(current.bill?.updatedAt)
    ? incoming
    : current
}

function parseTimestamp(value?: string | null) {
  if (!value) return -1
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? -1 : parsed
}

export function getSpotOrderStatusLabel(
  view: SpotOrderView,
  status: SpotOrderStatusValue,
  billStatus?: PaymentBillStatus,
): string {
  if (status === "pending_payment") {
    if (billStatus === "submitted") {
      return view === "seller" ? "待确认收款" : "待卖家确认"
    }
    return "待支付"
  }
  if (status === "paid") return view === "seller" ? "后续处理" : "处理中"
  if (status === "completed") return "已完成"
  if (status === "cancelled") return "已取消"
  return "状态未知"
}

export function resolveSpotOrderActions(
  view: SpotOrderView,
  orderStatus: SpotOrderStatusValue,
  billStatus?: PaymentBillStatus,
): SpotOrderActions {
  if (view === "seller") {
    return orderStatus === "pending_payment" && billStatus === "submitted"
      ? { ...NO_ACTIONS, canConfirmPayment: true }
      : NO_ACTIONS
  }
  if (orderStatus === "paid") return { ...NO_ACTIONS, canComplete: true }
  if (orderStatus !== "pending_payment") return NO_ACTIONS
  return {
    ...NO_ACTIONS,
    canCancel: true,
    canPay: billStatus === "unpaid",
    canSupplementSerialNumber: billStatus === "submitted",
  }
}
