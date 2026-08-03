import { describe, expect, it } from "vitest";

import {
  buildBuyerErrandOrderTimeline,
  getBuyerErrandOrderAmountBreakdown,
} from "./buyer-errand-order";

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
