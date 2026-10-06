import {
  compareUpdatedAt,
  type PaymentBillStatus,
  type SpotOrder,
  type SpotOrderStatusValue,
} from "@sast-shop/api";

export type SpotOrderView = "buyer" | "seller";

export interface SpotOrderActions {
  canCancel: boolean;
  canPay: boolean;
  canSupplementSerialNumber: boolean;
  canConfirmPayment: boolean;
  canComplete: boolean;
}

const NO_ACTIONS: SpotOrderActions = {
  canCancel: false,
  canPay: false,
  canSupplementSerialNumber: false,
  canConfirmPayment: false,
  canComplete: false,
};

const ORDER_STATUS_RANK: Record<SpotOrderStatusValue, number> = {
  unknown: -1,
  pending_payment: 0,
  paid: 1,
  completed: 2,
  cancelled: 2,
};

export function reconcileSpotOrderUpdate(
  current: SpotOrder,
  incoming: SpotOrder,
): SpotOrder {
  if (current.id !== incoming.id) return incoming;
  const currentRank = ORDER_STATUS_RANK[current.status];
  const incomingRank = ORDER_STATUS_RANK[incoming.status];
  if (incomingRank > currentRank) return incoming;
  if (incomingRank < currentRank) return current;
  return compareUpdatedAt(incoming.bill?.updatedAt, current.bill?.updatedAt) >=
    0
    ? incoming
    : current;
}

export function getSpotOrderStatusLabel(
  view: SpotOrderView,
  status: SpotOrderStatusValue,
  billStatus?: PaymentBillStatus,
): string {
  if (status === "pending_payment") {
    if (billStatus === "submitted") {
      return view === "seller" ? "待确认收款" : "待卖家确认";
    }
    return "待支付";
  }
  if (status === "paid") return view === "seller" ? "后续处理" : "处理中";
  if (status === "completed") return "已完成";
  if (status === "cancelled") return "已取消";
  return "状态异常";
}

export function resolveSpotOrderActions(
  view: SpotOrderView,
  orderStatus: SpotOrderStatusValue,
  billStatus?: PaymentBillStatus,
): SpotOrderActions {
  if (view === "seller") {
    return orderStatus === "pending_payment" && billStatus === "submitted"
      ? { ...NO_ACTIONS, canConfirmPayment: true }
      : NO_ACTIONS;
  }
  if (orderStatus === "paid") return { ...NO_ACTIONS, canComplete: true };
  if (orderStatus !== "pending_payment") return NO_ACTIONS;
  return {
    ...NO_ACTIONS,
    canCancel: true,
    canPay: billStatus === "unpaid",
    canSupplementSerialNumber: billStatus === "submitted",
  };
}
