import { describe, expect, it } from "vitest";
import type { BuyerErrandOrderDetail, PaymentBill } from "@sast-shop/api";

import {
  buildBuyerErrandOrderTimeline,
  getBuyerErrandOrderAmountBreakdown,
  reconcileBuyerErrandOrderUpdate,
} from "./buyer-errand-order";

describe("reconcileBuyerErrandOrderUpdate", () => {
  it("keeps a newer bill when an old snapshot has the same millisecond timestamp", () => {
    const bill: PaymentBill = {
      id: "9201",
      billNo: "BILL-1",
      payer: null,
      payee: null,
      status: "submitted",
      channel: "wechat",
      amountCents: 200,
      verifyCode: "2718",
      serialNumber: "",
      createdAt: "2026-07-18T00:00:00Z",
      updatedAt: "2026-07-18T00:01:00.123456789Z",
      sourceType: "errand_order",
      sourceId: "8001",
      submittedAt: "2026-07-18T00:01:00Z",
      completedAt: null,
      closedAt: null,
    };
    const newer: BuyerErrandOrderDetail = {
      id: "8001",
      storeId: "3001",
      createdAt: "2026-07-18T00:00:00Z",
      updatedAt: "2026-07-18T00:01:00.123456789Z",
      store: null,
      status: "pending_payment",
      productItems: [],
      totalOriginAmountCents: 200,
      totalActualAmountCents: 200,
      totalServiceFeeCents: 0,
      captain: null,
      bill,
      deadline: null,
      shoppingStartAt: null,
      shoppingCompletedAt: null,
      distributionCompletedAt: null,
      paymentCompletedAt: null,
      cancelledAt: null,
    };
    const older: BuyerErrandOrderDetail = {
      ...newer,
      bill: {
        ...bill,
        status: "unpaid",
        updatedAt: "2026-07-18T00:01:00.123123456Z",
      },
    };

    expect(reconcileBuyerErrandOrderUpdate(newer, older)).toBe(newer);
    expect(reconcileBuyerErrandOrderUpdate(older, newer)).toBe(newer);
  });
});

describe("buildBuyerErrandOrderTimeline", () => {
  it("拆分商品实际价、跑腿费与均摊包装费", () => {
    expect(
      getBuyerErrandOrderAmountBreakdown({
        totalOriginAmountCents: 3600,
        totalActualAmountCents: 3600,
        totalServiceFeeCents: 600,
        bill: { amountCents: 4200 },
        productItems: [
          createProductItem({
            actualUnitPriceCents: 200,
            distributedQuantity: 6,
            serviceFeePerUnitCents: 50,
          }),
          createProductItem({
            actualUnitPriceCents: 1100,
            distributedQuantity: 2,
            serviceFeePerUnitCents: 150,
          }),
        ],
      }),
    ).toEqual({
      productAmountCents: 3400,
      serviceFeeCents: 600,
      packagingShareCents: 200,
      totalAmountCents: 4200,
    });
  });

  it("只展示真实存在且合法的订单节点", () => {
    expect(
      buildBuyerErrandOrderTimeline({
        status: "shopping",
        createdAt: "2026-07-18T09:00:00Z",
        deadline: "2026-07-18T14:00:00Z",
        shoppingStartAt: "2026-07-18T09:30:00Z",
        shoppingCompletedAt: null,
        distributionCompletedAt: "invalid",
        paymentCompletedAt: null,
        cancelledAt: null,
      }),
    ).toEqual([
      { label: "创建订单", timestamp: "2026-07-18T09:00:00Z" },
      { label: "期望送达", timestamp: "2026-07-18T14:00:00Z" },
      { label: "开始采购", timestamp: "2026-07-18T09:30:00Z" },
    ]);
  });

  it("取消订单时移除取消时间之后的节点", () => {
    expect(
      buildBuyerErrandOrderTimeline({
        status: "cancelled",
        createdAt: "2026-07-18T09:00:00Z",
        deadline: "2026-07-18T14:00:00Z",
        shoppingStartAt: "2026-07-18T09:30:00Z",
        shoppingCompletedAt: null,
        distributionCompletedAt: null,
        paymentCompletedAt: null,
        cancelledAt: "2026-07-18T10:00:00Z",
      }),
    ).toEqual([
      { label: "创建订单", timestamp: "2026-07-18T09:00:00Z" },
      { label: "开始采购", timestamp: "2026-07-18T09:30:00Z" },
      {
        label: "订单取消",
        timestamp: "2026-07-18T10:00:00Z",
        cancelled: true,
      },
    ]);
  });
});

function createProductItem({
  actualUnitPriceCents,
  distributedQuantity,
  serviceFeePerUnitCents,
}: {
  actualUnitPriceCents: number;
  distributedQuantity: number;
  serviceFeePerUnitCents: number;
}) {
  return {
    productTemplate: {
      id: "4001",
      title: "测试商品",
      description: "",
      priceCents: actualUnitPriceCents,
      storeId: "3001",
      mainImageUrl: "",
      barcode: "",
      updatedAt: null,
    },
    actualUnitPriceCents,
    requiredQuantity: distributedQuantity,
    purchasedQuantity: distributedQuantity,
    nonPurchaseReason: null,
    distributedQuantity,
    serviceFeePerUnitCents,
    subtotalCents:
      (actualUnitPriceCents + serviceFeePerUnitCents) * distributedQuantity,
    demandItemId: "9001",
  };
}
