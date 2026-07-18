import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER_FILTERS,
  DEFAULT_REMEMBERED_ORDER_VIEWS,
  getDefaultViewForType,
  getCompactStatusLabel,
  getCompactViewLabel,
  getOrderFiltersFromParams,
  getStatusBadgeVariant,
  getStatusLabel,
  getStatusOptions,
  getViewOptions,
  isOrderType,
  isOrderView,
  isStatusForView,
  isViewForType,
  matchesOrderStatus,
  orderTypeOptions,
  updateOrderFilterParams,
} from "./order-filters";
import type { RememberedOrderViews } from "./order-filters";

describe("order filters", () => {
  it("defines default type and remembered view options", () => {
    expect(orderTypeOptions).toEqual([
      { value: "spot", label: "现货" },
      { value: "errand", label: "跑腿" },
    ]);
    expect(DEFAULT_REMEMBERED_ORDER_VIEWS).toEqual({
      spot: "buyer",
      errand: "participant",
    });
  });

  it("defaults to spot buyer", () => {
    expect(getOrderFiltersFromParams(new URLSearchParams())).toEqual(
      DEFAULT_ORDER_FILTERS,
    );
  });

  it("defaults invalid type and invalid status", () => {
    const params = new URLSearchParams(
      "type=unknown&view=captain&status=shopping&q=snack",
    );

    expect(getOrderFiltersFromParams(params)).toEqual({
      type: "spot",
      view: "buyer",
      status: "all",
      query: "snack",
    });
  });

  it("coerces invalid view to the selected type default", () => {
    const params = new URLSearchParams("type=spot&view=captain");

    expect(getOrderFiltersFromParams(params)).toMatchObject({
      type: "spot",
      view: "buyer",
      status: "all",
      query: "",
    });
  });

  it("parses query text and defaults missing query to empty", () => {
    expect(
      getOrderFiltersFromParams(new URLSearchParams("q=sticker")).query,
    ).toBe("sticker");
    expect(getOrderFiltersFromParams(new URLSearchParams()).query).toBe("");
  });

  it("returns type-specific view options", () => {
    expect(getViewOptions("spot").map((option) => option.value)).toEqual([
      "buyer",
      "seller",
    ]);
    expect(getViewOptions("errand").map((option) => option.value)).toEqual([
      "participant",
      "captain",
    ]);
  });

  it("returns spot buyer status options", () => {
    expect(getStatusOptions("spot", "buyer")).toEqual([
      { value: "all", label: "全部" },
      { value: "pending_payment", label: "待支付" },
      { value: "processing", label: "处理中" },
      { value: "completed", label: "已完成" },
      { value: "cancelled", label: "已取消" },
    ]);
  });

  it("returns spot seller status options", () => {
    expect(getStatusOptions("spot", "seller")).toEqual([
      { value: "all", label: "全部" },
      { value: "pending_payment", label: "待支付" },
      { value: "processing", label: "处理中" },
      { value: "completed", label: "已完成" },
      { value: "cancelled", label: "已取消" },
    ]);
  });

  it("returns errand participant status options", () => {
    expect(getStatusOptions("errand", "participant")).toEqual([
      { value: "all", label: "全部" },
      { value: "open", label: "未接单" },
      { value: "shopping", label: "采购中" },
      { value: "pending_distributing", label: "待分发" },
      { value: "distributing", label: "分发中" },
      { value: "pending_payment", label: "待支付" },
      { value: "completed", label: "已完成" },
      { value: "cancelled", label: "已取消" },
    ]);
  });

  it("returns errand captain status options", () => {
    expect(getStatusOptions("errand", "captain")).toEqual([
      { value: "all", label: "全部" },
      { value: "shopping", label: "采购中" },
      { value: "pending_distributing", label: "待分发" },
      { value: "distributing", label: "分发中" },
      { value: "collecting_payment", label: "收款中" },
      { value: "completed", label: "已完成" },
      { value: "cancelled", label: "已取消" },
    ]);
  });

  it("knows valid view and type combinations", () => {
    expect(isViewForType("spot", "buyer")).toBe(true);
    expect(isViewForType("spot", "captain")).toBe(false);
    expect(getDefaultViewForType("errand")).toBe("participant");
  });

  it("recognizes valid order types and views", () => {
    expect(isOrderType("spot")).toBe(true);
    expect(isOrderType("errand")).toBe(true);
    expect(isOrderType("captain")).toBe(false);
    expect(isOrderType(null)).toBe(false);
    expect(isOrderView("buyer")).toBe(true);
    expect(isOrderView("captain")).toBe(true);
    expect(isOrderView("purchaser")).toBe(false);
    expect(isOrderView(null)).toBe(false);
  });

  it("recognizes status options for each type and view", () => {
    expect(isStatusForView("spot", "buyer", "pending_payment")).toBe(true);
    expect(isStatusForView("spot", "buyer", "shopping")).toBe(false);
    expect(isStatusForView("spot", "seller", "processing")).toBe(true);
    expect(isStatusForView("spot", "seller", "pending_confirm")).toBe(false);
    expect(isStatusForView("spot", "seller", "pending_payment")).toBe(true);
    expect(isStatusForView("errand", "participant", "open")).toBe(true);
    expect(isStatusForView("errand", "captain", "collecting_payment")).toBe(
      true,
    );
    expect(isStatusForView("errand", "captain", "pending_payment")).toBe(false);
    expect(isStatusForView("errand", "captain", null)).toBe(false);
  });

  it("matches filters against renderable order statuses", () => {
    expect(matchesOrderStatus("all", "paid")).toBe(true);
    expect(matchesOrderStatus("processing", "paid")).toBe(true);
    expect(matchesOrderStatus("processing", "processing")).toBe(true);
    expect(matchesOrderStatus("completed", "cancelled")).toBe(false);
  });

  it("returns status labels with unknown fallback", () => {
    expect(getStatusLabel("pending_payment")).toBe("待支付");
    expect(getStatusLabel("paid")).toBe("处理中");
    expect(getStatusLabel("collecting_payment")).toBe("收款中");
    expect(getStatusLabel("unknown")).toBe("状态异常");
  });

  it("returns compact labels for mobile filters", () => {
    expect(getCompactViewLabel("buyer")).toBe("买");
    expect(getCompactViewLabel("seller")).toBe("卖");
    expect(getCompactViewLabel("participant")).toBe("拼");
    expect(getCompactViewLabel("captain")).toBe("团");
    expect(getCompactStatusLabel("pending_distributing")).toBe("待发");
    expect(getCompactStatusLabel("pending_payment")).toBe("待付");
    expect(getCompactStatusLabel("completed")).toBe("完成");
  });

  it.each([
    ["open", "neutral"],
    ["shopping", "warning"],
    ["pending_distributing", "info"],
    ["distributing", "info"],
    ["pending_payment", "payment"],
    ["collecting_payment", "attention"],
    ["paid", "review"],
    ["completed", "success"],
    ["cancelled", "danger"],
    ["unknown", "neutral"],
  ] as const)("maps %s status to %s badge variant", (status, variant) => {
    expect(getStatusBadgeVariant(status)).toBe(variant);
  });

  it("resets status and query when type changes", () => {
    const params = new URLSearchParams(
      "type=spot&view=seller&status=paid&q=drink",
    );

    const next = updateOrderFilterParams(params, {
      type: "errand",
      rememberedViews: { spot: "seller", errand: "captain" },
    });

    expect(next.toString()).toBe("type=errand&view=captain");
  });

  it("resets status and query when view changes", () => {
    const params = new URLSearchParams(
      "type=spot&view=buyer&status=pending_payment&q=sticker",
    );

    const next = updateOrderFilterParams(params, {
      view: "seller",
      rememberedViews: { spot: "buyer", errand: "participant" },
    });

    expect(next.toString()).toBe("view=seller");
  });

  it("preserves the search query when only the status changes", () => {
    const params = new URLSearchParams(
      "type=errand&view=participant&q=milk&source=notification",
    );

    const next = updateOrderFilterParams(params, {
      status: "pending_payment",
      rememberedViews: DEFAULT_REMEMBERED_ORDER_VIEWS,
    });

    expect(next.toString()).toBe(
      "type=errand&q=milk&source=notification&status=pending_payment",
    );
  });

  it("omits default params when updating filters", () => {
    const next = updateOrderFilterParams(new URLSearchParams(), {
      type: "spot",
      view: "buyer",
      status: "all",
      q: "",
      rememberedViews: DEFAULT_REMEMBERED_ORDER_VIEWS,
    });

    expect(next.toString()).toBe("");
  });

  it("preserves unrelated params while deleting default status and query", () => {
    const params = new URLSearchParams(
      "dialog=address&type=spot&view=seller&status=paid&q=drink&page=2",
    );

    const next = updateOrderFilterParams(params, {
      status: "all",
      q: "",
      rememberedViews: DEFAULT_REMEMBERED_ORDER_VIEWS,
    });

    expect(next.toString()).toBe("dialog=address&view=seller&page=2");
  });

  it("falls back when remembered view is invalid for changed type", () => {
    const params = new URLSearchParams(
      "type=spot&view=seller&status=paid&q=drink",
    );

    const next = updateOrderFilterParams(params, {
      type: "errand",
      rememberedViews: {
        spot: "seller",
        errand: "seller",
      } as unknown as RememberedOrderViews,
    });

    expect(next.toString()).toBe("type=errand");
  });
});
