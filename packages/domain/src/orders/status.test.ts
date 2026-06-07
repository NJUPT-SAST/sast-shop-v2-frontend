import { describe, expect, it } from "vitest";

import { getOrderStatusMeta, OrderStatus } from "./status";

describe("getOrderStatusMeta", () => {
  it("returns display metadata for every order status", () => {
    expect(getOrderStatusMeta(OrderStatus.PendingPayment)).toEqual({
      label: "待付款",
      tone: "warning"
    });
    expect(getOrderStatusMeta(OrderStatus.PendingShipment)).toEqual({
      label: "待发货",
      tone: "info"
    });
    expect(getOrderStatusMeta(OrderStatus.Shipped)).toEqual({
      label: "已发货",
      tone: "info"
    });
    expect(getOrderStatusMeta(OrderStatus.Completed)).toEqual({
      label: "已完成",
      tone: "success"
    });
    expect(getOrderStatusMeta(OrderStatus.Cancelled)).toEqual({
      label: "已取消",
      tone: "muted"
    });
  });
});
