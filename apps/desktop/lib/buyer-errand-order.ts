import type {
  BuyerErrandOrderDetail,
  BuyerErrandOrderProductItem,
  BuyerErrandOrderStatus,
  PaymentBill,
} from "@sast-shop/api";
import { compareUpdatedAt } from "./errand-recovery";

export type BuyerErrandPaymentState =
  | "payable"
  | "submitted"
  | "completed"
  | "unavailable"
  | "self_purchase"
  | "hidden";

export type BuyerErrandTimelineItem = {
  label: string;
  timestamp: string;
  cancelled?: boolean;
};

type AmountSource = Pick<
  BuyerErrandOrderDetail,
  "totalOriginAmountCents" | "totalActualAmountCents" | "totalServiceFeeCents"
> & { bill: Pick<PaymentBill, "amountCents"> | null };

export type BuyerErrandOrderAmountBreakdown = {
  productAmountCents: number;
  serviceFeeCents: number;
  packagingShareCents: number;
  totalAmountCents: number;
};

type AmountBreakdownSource = AmountSource &
  Pick<BuyerErrandOrderDetail, "productItems">;

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

export function getBuyerErrandOrderAmountBreakdown(
  order: AmountBreakdownSource,
): BuyerErrandOrderAmountBreakdown {
  const productAmountCents =
    order.totalActualAmountCents === null
      ? order.totalOriginAmountCents
      : getActualProductAmountCents(order.productItems);
  const serviceFeeCents = order.totalServiceFeeCents;
  const totalAmountCents = getBuyerErrandOrderAmountCents(order);
  const packagingShareCents = Math.max(
    0,
    totalAmountCents - productAmountCents - serviceFeeCents,
  );

  return {
    productAmountCents,
    serviceFeeCents,
    packagingShareCents,
    totalAmountCents,
  };
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
  return compareUpdatedAt(incoming.bill?.updatedAt, current.bill?.updatedAt) >=
    0
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

function getActualProductAmountCents(
  items: BuyerErrandOrderProductItem[],
): number {
  return items.reduce((total, item) => {
    const quantity = getPositiveQuantity(
      item.distributedQuantity ?? item.purchasedQuantity,
    );
    if (quantity === 0 || item.actualUnitPriceCents === null) return total;

    return total + item.actualUnitPriceCents * quantity;
  }, 0);
}

function getPositiveQuantity(value: number | null | undefined): number {
  return value != null && value > 0 ? value : 0;
}

function isValidTimestamp(value: string | null | undefined): value is string {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}
