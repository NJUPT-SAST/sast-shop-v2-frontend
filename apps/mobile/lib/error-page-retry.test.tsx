// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GroupShopError from "../app/group/shop/[id]/error";
import ErrandDemandError from "../app/group/errand/[storeId]/error";
import PurchaseTaskError from "../app/group/purchase/[id]/error";
import SpotOrderError from "../app/orders/spot/[id]/error";
import BuyerErrandOrderError from "../app/orders/errand/[id]/error";
import PageError from "../app/error";

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => vi.unstubAllGlobals());

describe("detail page error recovery", () => {
  it.each([
    ["店铺商品", GroupShopError],
    ["跑腿需求", ErrandDemandError],
    ["采购任务", PurchaseTaskError],
    ["现货订单", SpotOrderError],
    ["跑腿订单", BuyerErrandOrderError],
    ["其他页面", PageError],
  ])(
    "requests fresh server content when retrying %s",
    async (_name, Component) => {
      const container = document.createElement("div");
      const root = createRoot(container);
      const props = {
        error: new Error("service unavailable"),
        retry: vi.fn(),
        reset: vi.fn(),
      };
      try {
        await act(async () => root.render(<Component {...props} />));
        const retryButton = Array.from(
          container.querySelectorAll("button"),
        ).find((button) => button.textContent === "重新加载");
        expect(retryButton).toBeDefined();
        await act(async () => retryButton!.click());
        expect(props.retry).toHaveBeenCalledOnce();
        expect(props.reset).not.toHaveBeenCalled();
        expect(container.querySelector('[role="alert"]')).not.toBeNull();
      } finally {
        await act(async () => root.unmount());
      }
    },
  );
});
