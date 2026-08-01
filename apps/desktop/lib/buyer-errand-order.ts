import type {
  BuyerErrandOrderDetail,
  BuyerErrandOrderStatus,
  PaymentBill,
} from "@sast-shop/api";

export type BuyerErrandPaymentState =
  "payable" | "submitted" | "completed" | "unavailable" | "self_purchase" | "hidden";

export type BuyerErrandTimelineItem = {
  label: string;
  timestamp: string;
  cancelled?: boolean;
};

type AmountSource = Pick<
  BuyerErrandOrderDetail,
  "totalOriginAmountCents" | "totalActualAmountCents" | "totalServiceFeeCents"
> & { bill: Pick<PaymentBill, "amountCents"> | null };

type TimelineSource = Pick<
  BuyerErrandOrderDetail,
  | "status"
  | "createdAt"
  | "deadline"
  | "shoppingStartAt"
  | "shoppingCompletedAt"
  | "distributionCompletedAt"
  | "paymentCompletedAt"
  | "cancelledAt"
>;

const statusRank: Record<BuyerErrandOrderStatus, number> = {
  unknown: -1,
  open: 0,
  shopping: 1,
  pending_distributing: 2,
  distributing: 3,
  pending_payment: 4,
  completed: 5,
  cancelled: 5,
};

export function getBuyerErrandOrderAmountCents(order: AmountSource): number {
  return (
    order.bill?.amountCents ??
    (order.totalActualAmountCents ?? order.totalOriginAmountCents) +
      order.totalServiceFeeCents
  );
}

export function resolveBuyerErrandPaymentState(
  status: BuyerErrandOrderStatus,
  bill: PaymentBill | null,
): BuyerErrandPaymentState {
  if (status !== "pending_payment") return "hidden";
  if (!bill) return "self_purchase";
  if (bill.status === "submitted") return "submitted";
  if (bill.status === "completed") return "completed";
  if (bill.status === "unpaid" && bill.payee?.id && bill.updatedAt) {
    return "payable";
  }
  return "unavailable";
}

export function reconcileBuyerErrandOrderUpdate(
  current: BuyerErrandOrderDetail,
  incoming: BuyerErrandOrderDetail,
): BuyerErrandOrderDetail {
  if (current.id !== incoming.id) return incoming;
  const currentRank = statusRank[current.status];
  const incomingRank = statusRank[incoming.status];
  if (incomingRank > currentRank) return incoming;
  if (incomingRank < currentRank) return current;
  return parseTimestamp(incoming.bill?.updatedAt) >=
    parseTimestamp(current.bill?.updatedAt)
    ? incoming
    : current;
}

export function buildBuyerErrandOrderTimeline(
  order: TimelineSource,
): BuyerErrandTimelineItem[] {
  const events: BuyerErrandTimelineItem[] = [
    { label: "创建订单", timestamp: order.createdAt ?? "" },
    { label: "期望送达", timestamp: order.deadline ?? "" },
    { label: "开始采购", timestamp: order.shoppingStartAt ?? "" },
    { label: "完成采购", timestamp: order.shoppingCompletedAt ?? "" },
    { label: "完成分发", timestamp: order.distributionCompletedAt ?? "" },
    { label: "完成支付", timestamp: order.paymentCompletedAt ?? "" },
  ].filter((item) => isValidTimestamp(item.timestamp));

  if (order.status !== "cancelled" || !isValidTimestamp(order.cancelledAt)) {
    return events;
  }

  const cancelledAt = Date.parse(order.cancelledAt);
  return [
    ...events.filter((item) => Date.parse(item.timestamp) <= cancelledAt),
    { label: "订单取消", timestamp: order.cancelledAt, cancelled: true },
  ];
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return -1;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? -1 : parsed;
}

function isValidTimestamp(value: string | null | undefined): value is string {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}
