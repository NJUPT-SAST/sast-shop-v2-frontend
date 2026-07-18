import { describe, expect, it } from "vitest";

import { buildBuyerErrandOrderTimeline } from "./buyer-errand-order";

describe("buildBuyerErrandOrderTimeline", () => {
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
