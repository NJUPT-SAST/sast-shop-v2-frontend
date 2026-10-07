// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { SellerGoodsManager } from "../components/seller-goods-manager";

const { getSpotGoods, ensureAgreement, updateSpotGoodsStock } = vi.hoisted(
  () => ({
    getSpotGoods: vi.fn(),
    ensureAgreement: vi.fn(),
    updateSpotGoodsStock: vi.fn(),
  }),
);
const goods = {
  id: "5001",
  sellerId: "42",
  sellerName: "张同学",
  sellerAvatarUrl: "",
  salePriceCents: 200,
  stock: 0,
  updatedAt: "2026-10-07T10:00:00Z",
  product: {
    id: "4001",
    title: "矿泉水",
    description: "550ml",
    priceCents: 200,
    storeId: "3001",
    mainImageUrl: "",
    barcode: "690000000001",
    updatedAt: "2026-10-07T09:00:00Z",
  },
};
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getCurrentUser: async () => ({ id: "42", name: "张同学", avatarUrl: "" }),
  listSellerSpotGoods: async () => ({
    goods: [goods],
    currentPage: 1,
    pageSize: 20,
    totalCount: 1,
  }),
  getSpotGoods,
  updateSpotGoodsStock,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  clearResourceCache();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  getSpotGoods.mockReset().mockResolvedValue(goods);
  ensureAgreement.mockReset().mockResolvedValue(true);
  updateSpotGoodsStock.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function openEditor() {
  await act(async () =>
    root.render(
      <SellerGoodsManager
        dataSource="mock"
        connectBaseUrl="http://localhost"
        authRequired={false}
        refreshKey="focus"
      />,
    ),
  );
  const card = container.querySelector<HTMLButtonElement>("button")!;
  await act(async () => {
    card.focus();
    card.click();
  });
  expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  return card;
}
async function escape() {
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("seller goods dialog keyboard behavior", () => {
  it("focuses the loaded price input and submits from the footer button through its native form association", async () => {
    updateSpotGoodsStock.mockResolvedValue({
      ...goods,
      stock: 1,
      updatedAt: "2026-10-07T10:00:01Z",
    });
    await openEditor();
    expect(document.activeElement).toBe(
      document.body.querySelector("#spot-edit-price"),
    );
    const stock =
      document.body.querySelector<HTMLInputElement>("#spot-edit-stock")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(stock, "1");
      stock.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const save = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent === "保存修改",
    )!;
    expect(save.form).toBe(stock.closest("form"));
    await act(async () => save.click());
    expect(ensureAgreement).toHaveBeenCalledOnce();
    expect(updateSpotGoodsStock).toHaveBeenCalledWith(
      { spotGoodsId: "5001", newStock: 1, updatedAt: goods.updatedAt },
      { dataSource: "mock", connectBaseUrl: "http://localhost" },
    );
  });

  it("returns focus to the originating product card after Escape", async () => {
    const card = await openEditor();
    await escape();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(card);
  });

  it("blocks Escape while agreement confirmation is pending", async () => {
    let agree!: (accepted: boolean) => void;
    ensureAgreement.mockReturnValue(
      new Promise((resolve) => {
        agree = resolve;
      }),
    );
    const card = await openEditor();
    const stock =
      document.body.querySelector<HTMLInputElement>("#spot-edit-stock")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(stock, "1");
      stock.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => stock.closest("form")!.requestSubmit());
    await escape();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    await act(async () => agree(false));
    await escape();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(card);
  });
});
