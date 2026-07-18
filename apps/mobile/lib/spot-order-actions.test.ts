import { describe, expect, it } from "vitest";
import type { PaymentBill, SpotOrder } from "@sast-shop/api";

import {
  hasPaymentRecipient,
  reconcileSpotOrderUpdate,
  resolveSpotOrderActions,
} from "./spot-order-actions";

describe("resolveSpotOrderActions", () => {
  it("only exposes buyer payment and cancellation for unpaid orders", () => {
    expect(
      resolveSpotOrderActions("buyer", "pending_payment", "unpaid"),
    ).toEqual({
      canCancel: true,
      canPay: true,
      canSupplementSerialNumber: false,
      canConfirmPayment: false,
      canComplete: false,
    });
  });

  it("lets a buyer cancel or supplement a submitted payment", () => {
    expect(
      resolveSpotOrderActions("buyer", "pending_payment", "submitted"),
    ).toEqual({
      canCancel: true,
      canPay: false,
      canSupplementSerialNumber: true,
      canConfirmPayment: false,
      canComplete: false,
    });
  });

  it("only lets a seller confirm a submitted payment", () => {
    expect(
      resolveSpotOrderActions("seller", "pending_payment", "submitted"),
    ).toEqual({
      canCancel: false,
      canPay: false,
      canSupplementSerialNumber: false,
      canConfirmPayment: true,
      canComplete: false,
    });
    expect(
      resolveSpotOrderActions("seller", "pending_payment", "unpaid"),
    ).toEqual({
      canCancel: false,
      canPay: false,
      canSupplementSerialNumber: false,
      canConfirmPayment: false,
      canComplete: false,
    });
  });

  it("only lets a buyer complete a paid order", () => {
    expect(resolveSpotOrderActions("buyer", "paid", "completed")).toEqual({
      canCancel: false,
      canPay: false,
      canSupplementSerialNumber: false,
      canConfirmPayment: false,
      canComplete: true,
    });
    expect(resolveSpotOrderActions("seller", "paid", "completed")).toEqual({
      canCancel: false,
      canPay: false,
      canSupplementSerialNumber: false,
      canConfirmPayment: false,
      canComplete: false,
    });
  });

  it.each(["completed", "cancelled", "unknown"] as const)(
    "exposes no actions for a %s order",
    (status) => {
      expect(resolveSpotOrderActions("buyer", status)).toEqual({
        canCancel: false,
        canPay: false,
        canSupplementSerialNumber: false,
        canConfirmPayment: false,
        canComplete: false,
      });
      expect(resolveSpotOrderActions("seller", status)).toEqual({
        canCancel: false,
        canPay: false,
        canSupplementSerialNumber: false,
        canConfirmPayment: false,
        canComplete: false,
      });
    },
  );
});

describe("spot order lifecycle safeguards", () => {
  it("fails closed when a payment bill has no recipient", () => {
    expect(hasPaymentRecipient(undefined)).toBe(false);
    expect(hasPaymentRecipient(makeBill({ payee: null }))).toBe(false);
    expect(
      hasPaymentRecipient(
        makeBill({ payee: { id: "42", name: "卖家", avatarUrl: "" } }),
      ),
    ).toBe(true);
  });

  it("accepts a refreshed order that advances the lifecycle", () => {
    const current = makeOrder({
      status: "pending_payment",
      bill: makeBill({
        status: "completed",
        updatedAt: "2026-07-18T02:12:00Z",
      }),
    });
    const incoming = makeOrder({
      status: "paid",
      bill: makeBill({
        status: "completed",
        updatedAt: "2026-07-18T02:12:00Z",
      }),
    });

    expect(reconcileSpotOrderUpdate(current, incoming)).toBe(incoming);
  });

  it("does not roll a successful local mutation back to stale server props", () => {
    const current = makeOrder({
      status: "cancelled",
      bill: makeBill({
        status: "closed",
        updatedAt: "2026-07-18T02:25:00Z",
      }),
    });
    const stale = makeOrder({
      status: "pending_payment",
      bill: makeBill({
        status: "unpaid",
        updatedAt: "2026-07-18T02:00:00Z",
      }),
    });

    expect(reconcileSpotOrderUpdate(current, stale)).toBe(current);
  });

  it("keeps the newer bill when a stateless mock refreshes stale data", () => {
    const current = makeOrder({
      bill: makeBill({
        status: "completed",
        updatedAt: "2026-07-18T02:12:00Z",
      }),
    });
    const stale = makeOrder({
      bill: makeBill({
        status: "submitted",
        updatedAt: "2026-07-18T02:08:00Z",
      }),
    });

    expect(reconcileSpotOrderUpdate(current, stale)).toBe(current);
  });
});

function makeOrder(overrides: Partial<SpotOrder> = {}): SpotOrder {
  return {
    id: "5001",
    orderNo: "SO-5001",
    store: null,
    productTitle: "商品",
    productDescription: "",
    productImageUrl: "",
    quantity: 1,
    unitPriceCents: 100,
    totalAmountCents: 100,
    seller: null,
    status: "pending_payment",
    createdAt: null,
    paidAt: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

function makeBill(overrides: Partial<PaymentBill> = {}): PaymentBill {
  return {
    id: "9101",
    billNo: "BILL-9101",
    payer: null,
    payee: { id: "42", name: "卖家", avatarUrl: "" },
    status: "unpaid",
    amountCents: 100,
    verifyCode: "2718",
    channel: null,
    serialNumber: null,
    submittedAt: null,
    completedAt: null,
    closedAt: null,
    createdAt: null,
    updatedAt: "2026-07-18T02:00:00Z",
    sourceType: "spot_order",
    sourceId: "5001",
    ...overrides,
  };
}
