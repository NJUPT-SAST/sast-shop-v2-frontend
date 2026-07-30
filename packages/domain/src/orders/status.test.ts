import { describe, expect, it } from "vitest";

import { getOrderStatusMeta } from "./status";

describe("getOrderStatusMeta", () => {
  it("returns display metadata for every order status", () => {
    expect(getOrderStatusMeta("pending_payment")).toEqual({
      label: "待支付",
      tone: "orange",
    });
    expect(getOrderStatusMeta("pending_confirm")).toEqual({
      label: "待确认",
      tone: "amber",
    });
    expect(getOrderStatusMeta("paid")).toEqual({
      label: "已支付",
      tone: "blue",
    });
    expect(getOrderStatusMeta("processing")).toEqual({
      label: "处理中",
      tone: "blue",
    });
    expect(getOrderStatusMeta("complete")).toEqual({
      label: "已完成",
      tone: "emerald",
    });
    expect(getOrderStatusMeta("cancelled")).toEqual({
      label: "已取消",
      tone: "muted",
    });
  });
});
