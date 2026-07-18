import { describe, expect, it } from "vitest";
import type { SpotOrder } from "@sast-shop/api";

import {
  filterSpotOrders,
  getSpotOrderFilters,
  getSpotOrderStatusLabel,
  reconcileSpotOrderUpdate,
  resolveSpotOrderActions,
  updateSpotOrderFilterParams,
} from "./spot-orders";

const pendingOrder: SpotOrder = {
  id: "7001",
  orderNo: "SPOT-20260718-0001",
  store: {
    id: "3001",
    name: "SAST 小卖部",
    address: "南邮仙林校区",
    logoUrl: "",
    themeColor: "",
  },
  productTitle: "农夫山泉矿泉水",
  productDescription: "550ml",
  productImageUrl: "",
  quantity: 2,
  unitPriceCents: 180,
  totalAmountCents: 360,
  billId: "8001",
  seller: null,
  status: "pending_payment",
  createdAt: "2026-07-18T00:00:00Z",
  paidAt: null,
  completedAt: null,
  cancelledAt: null,
};

const completedOrder: SpotOrder = {
  ...pendingOrder,
  id: "7002",
  orderNo: "SPOT-20260718-0002",
  productTitle: "活动贴纸包",
  status: "completed",
};

const submittedOrder: SpotOrder = {
  ...pendingOrder,
  bill: {
    id: "8001",
    billNo: "BILL-1",
    payer: null,
    payee: null,
    status: "submitted",
    channel: "wechat",
    amountCents: 360,
    verifyCode: "2718",
    serialNumber: "",
    createdAt: "2026-07-18T00:00:00Z",
    updatedAt: "2026-07-18T00:01:00Z",
    sourceType: "spot_order",
    sourceId: "7001",
    submittedAt: "2026-07-18T00:01:00Z",
    completedAt: null,
    closedAt: null,
  },
};

describe("desktop spot orders", () => {
  it("parses only supported URL filter values", () => {
    expect(
      getSpotOrderFilters(
        new URLSearchParams("view=seller&status=processing&q=SAST"),
      ),
    ).toEqual({ view: "seller", status: "processing", query: "SAST" });

    expect(
      getSpotOrderFilters(new URLSearchParams("view=nope&status=nope")),
    ).toEqual({ view: "buyer", status: "all", query: "" });
  });

  it("resets incompatible status and query when the perspective changes", () => {
    const params = updateSpotOrderFilterParams(
      new URLSearchParams("status=pending_payment&q=water"),
      { view: "seller" },
    );

    expect(params.toString()).toBe("view=seller");
  });

  it("filters by perspective status semantics and keyword", () => {
    expect(
      filterSpotOrders(
        [{ ...submittedOrder, status: "paid" }, completedOrder],
        {
          view: "seller",
          status: "processing",
          query: "小卖部",
        },
      ).map((order) => order.id),
    ).toEqual(["7001"]);

    expect(
      filterSpotOrders([pendingOrder, completedOrder], {
        view: "buyer",
        status: "completed",
        query: "0002",
      }).map((order) => order.id),
    ).toEqual(["7002"]);
  });

  it("keeps the newest order state when a router refresh arrives", () => {
    expect(
      reconcileSpotOrderUpdate(
        { ...submittedOrder, status: "paid" },
        submittedOrder,
      ).status,
    ).toBe("paid");
    expect(
      reconcileSpotOrderUpdate(submittedOrder, {
        ...submittedOrder,
        status: "paid",
      }).status,
    ).toBe("paid");
  });

  it("uses perspective-aware labels for pending and paid orders", () => {
    expect(getSpotOrderStatusLabel("buyer", "pending_payment")).toBe("待支付");
    expect(
      getSpotOrderStatusLabel("seller", "pending_payment", "submitted"),
    ).toBe("待确认收款");
    expect(
      getSpotOrderStatusLabel("buyer", "pending_payment", "submitted"),
    ).toBe("待卖家确认");
    expect(getSpotOrderStatusLabel("buyer", "paid")).toBe("处理中");
    expect(getSpotOrderStatusLabel("seller", "paid")).toBe("后续处理");
  });

  it("exposes only protocol-backed actions for each perspective", () => {
    expect(
      resolveSpotOrderActions("buyer", "pending_payment", "unpaid"),
    ).toEqual({
      canCancel: true,
      canPay: true,
      canSupplementSerialNumber: false,
      canConfirmPayment: false,
      canComplete: false,
    });
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
      resolveSpotOrderActions("buyer", "paid", "completed").canComplete,
    ).toBe(true);
    expect(resolveSpotOrderActions("buyer", "completed", "completed")).toEqual({
      canCancel: false,
      canPay: false,
      canSupplementSerialNumber: false,
      canConfirmPayment: false,
      canComplete: false,
    });
  });
});
