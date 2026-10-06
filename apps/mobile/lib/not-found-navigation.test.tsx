// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SpotOrderNotFound from "../app/orders/spot/[id]/not-found";
import BuyerErrandOrderNotFound from "../app/orders/errand/[id]/not-found";
import ErrandDemandDetailNotFound from "../app/group/errand/[storeId]/not-found";
import PurchaseTaskNotFound from "../app/group/purchase/[id]/not-found";
import GroupShopNotFound from "../app/group/shop/[id]/not-found";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("not-found navigation without an in-app previous page", () => {
  it.each([
    {
      Page: SpotOrderNotFound,
      route: "/orders/spot/999999",
      href: "/orders",
      label: "返回订单列表",
    },
    {
      Page: BuyerErrandOrderNotFound,
      route: "/orders/errand/999999",
      href: "/orders?type=errand",
      label: "返回跑腿订单",
    },
    {
      Page: ErrandDemandDetailNotFound,
      route: "/group/errand/999999",
      href: "/group/errand",
      label: "返回跑腿大厅",
    },
    {
      Page: PurchaseTaskNotFound,
      route: "/group/purchase/999999",
      href: "/orders?type=errand&view=captain",
      label: "返回任务列表",
    },
    {
      Page: GroupShopNotFound,
      route: "/group/shop/999999",
      href: "/group",
      label: "返回团购",
    },
  ])(
    "$route provides a direct link to $href",
    async ({ Page, route, href, label }) => {
      window.history.replaceState(null, "", route);
      const historyLength = window.history.length;
      await act(async () => root.render(<Page />));
      const link = container.querySelector<HTMLAnchorElement>("a");
      expect(link).not.toBeNull();
      expect(link!.getAttribute("href")).toBe(href);
      expect(link!.textContent).toBe(label);
      expect(window.history.length).toBe(historyLength);
    },
  );
});
