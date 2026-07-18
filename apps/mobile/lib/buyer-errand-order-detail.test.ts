import { describe, expect, it } from "vitest";

import {
  buildBuyerErrandOrderTimeline,
  getBuyerErrandOrderAmountCents,
  reconcileBuyerErrandOrderUpdate,
  resolveBuyerErrandPaymentState,
} from "./buyer-errand-order-detail";

describe("buyer errand order detail", () => {
  it("adds service fees to either actual or estimated product totals", () => {
    expect(
      getBuyerErrandOrderAmountCents({
        totalOriginAmountCents: 3198,
        totalActualAmountCents: 2998,
        totalServiceFeeCents: 600,
        bill: null,
      }),
    ).toBe(3598);
    expect(
      getBuyerErrandOrderAmountCents({
        totalOriginAmountCents: 3198,
        totalActualAmountCents: null,
        totalServiceFeeCents: 600,
        bill: null,
      }),
    ).toBe(3798);
  });

  it("uses the bill amount as the final payable amount", () => {
    expect(
      getBuyerErrandOrderAmountCents({
        totalOriginAmountCents: 3198,
        totalActualAmountCents: 2998,
        totalServiceFeeCents: 600,
        bill: { amountCents: 3698 },
      }),
    ).toBe(3698);
  });

  it.each([
    ["pending_payment", "unpaid", "42", "2026-07-18T02:00:00Z", "payable"],
    ["pending_payment", "unpaid", null, "2026-07-18T02:00:00Z", "unavailable"],
    ["pending_payment", "unpaid", "42", null, "unavailable"],
    ["pending_payment", "submitted", "42", "2026-07-18T02:00:00Z", "submitted"],
    ["pending_payment", "completed", "42", "2026-07-18T02:00:00Z", "completed"],
    ["shopping", "unpaid", "42", "2026-07-18T02:00:00Z", "hidden"],
    ["cancelled", "closed", "42", "2026-07-18T02:00:00Z", "hidden"],
  ] as const)(
    "resolves %s/%s payment state",
    (status, billStatus, payeeId, updatedAt, expected) => {
      expect(
        resolveBuyerErrandPaymentState(status, {
          status: billStatus,
          payee: payeeId ? { id: payeeId } : null,
          updatedAt,
        }),
      ).toBe(expected);
    },
  );

  it("orders only the timeline timestamps actually returned by the API", () => {
    expect(
      buildBuyerErrandOrderTimeline({
        status: "completed",
        createdAt: "2026-07-18T01:00:00Z",
        deadline: "2026-07-18T06:00:00Z",
        shoppingStartAt: "2026-07-18T02:00:00Z",
        shoppingCompletedAt: null,
        distributionCompletedAt: "2026-07-18T04:00:00Z",
        paymentCompletedAt: "2026-07-18T05:00:00Z",
        cancelledAt: null,
      }).map((item) => item.label),
    ).toEqual(["创建订单", "期望送达", "开始采购", "完成分发", "完成支付"]);
  });

  it("uses cancellation as the terminal event", () => {
    expect(
      buildBuyerErrandOrderTimeline({
        status: "cancelled",
        createdAt: "2026-07-18T01:00:00Z",
        deadline: null,
        shoppingStartAt: "2026-07-18T02:00:00Z",
        shoppingCompletedAt: null,
        distributionCompletedAt: null,
        paymentCompletedAt: "2026-07-18T05:00:00Z",
        cancelledAt: "2026-07-18T03:00:00Z",
      }).map((item) => item.label),
    ).toEqual(["创建订单", "开始采购", "订单取消"]);
  });

  it("keeps a newer local bill while the server refresh catches up", () => {
    const base = {
      id: "9001",
      status: "pending_payment" as const,
      bill: {
        status: "unpaid" as const,
        updatedAt: "2026-07-18T02:00:00Z",
      },
    };
    const current = {
      ...base,
      bill: {
        status: "submitted" as const,
        updatedAt: "2026-07-18T02:05:00Z",
      },
    };

    expect(reconcileBuyerErrandOrderUpdate(current, base)).toBe(current);
  });

  it("accepts a server-side order status advance", () => {
    const current = {
      id: "9001",
      status: "pending_payment" as const,
      bill: null,
    };
    const incoming = {
      id: "9001",
      status: "completed" as const,
      bill: null,
    };

    expect(reconcileBuyerErrandOrderUpdate(current, incoming)).toBe(incoming);
  });
});
