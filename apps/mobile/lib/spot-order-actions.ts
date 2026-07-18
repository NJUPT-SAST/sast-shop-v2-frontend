import type {
  PaymentBill,
  PaymentBillStatus,
  SpotOrder,
  SpotOrderStatusValue,
} from "@sast-shop/api";

import type { SpotOrderView } from "./order-filters";

export type SpotOrderActions = {
  canCancel: boolean;
  canPay: boolean;
  canSupplementSerialNumber: boolean;
  canConfirmPayment: boolean;
  canComplete: boolean;
};

const NO_ACTIONS: SpotOrderActions = {
  canCancel: false,
  canPay: false,
  canSupplementSerialNumber: false,
  canConfirmPayment: false,
  canComplete: false,
};

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

  if (orderStatus === "paid") {
    return { ...NO_ACTIONS, canComplete: true };
  }

  if (orderStatus !== "pending_payment") {
    return NO_ACTIONS;
  }

  return {
    ...NO_ACTIONS,
    canCancel: true,
    canPay: billStatus === "unpaid",
    canSupplementSerialNumber: billStatus === "submitted",
  };
}

export function hasPaymentRecipient(
  bill?: PaymentBill,
): bill is PaymentBill & { payee: NonNullable<PaymentBill["payee"]> } {
  return Boolean(bill?.payee?.id);
}

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

  const currentBillUpdatedAt = parseTimestamp(current.bill?.updatedAt);
  const incomingBillUpdatedAt = parseTimestamp(incoming.bill?.updatedAt);

  return incomingBillUpdatedAt >= currentBillUpdatedAt ? incoming : current;
}

function parseTimestamp(value?: string | null): number {
  if (!value) return -1;

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? -1 : parsed;
}
