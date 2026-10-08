// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSpotOrders,
  getSpotGoods,
  listPaymentQrCodes,
  type SpotGoodsBrief,
  type SpotOrder,
} from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { SpotMarketplace } from "../components/spot-marketplace";
import { SpotOrderDetail } from "../components/spot-order-detail";

const { router, ensureAgreement, toast } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  ensureAgreement: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@sast-shop/api", async (original) => ({
  ...(await original<typeof import("@sast-shop/api")>()),
  createSpotOrders: vi.fn(),
  getSpotGoods: vi.fn(),
  listPaymentQrCodes: vi.fn(),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("../components/managed-image", () => ({ ManagedImage: () => null }));
vi.mock("../components/lark-contact-button", () => ({
  LarkContactButton: () => null,
}));
vi.mock("sonner", () => ({ toast }));

const goods: SpotGoodsBrief = {
  id: "5001",
  product: {
    id: "4001",
    title: "矿泉水",
    description: "550ml",
    priceCents: 200,
    storeId: "3001",
    mainImageUrl: "",
    barcode: "690000000001",
    updatedAt: "2026-10-08T00:00:00Z",
  },
  salePriceCents: 180,
  stock: 3,
  updatedAt: "2026-10-08T00:00:00Z",
  store: {
    id: "3001",
    name: "小卖部",
    address: "校内",
    logoUrl: "",
    themeColor: "",
  },
};
const completedOrder: SpotOrder = {
  id: "7001",
  orderNo: "SPOT-7001",
  store: goods.store,
  productTitle: goods.product.title,
  productDescription: goods.product.description,
  productImageUrl: "",
  quantity: 1,
  unitPriceCents: 180,
  totalAmountCents: 180,
  seller: { id: "1001", name: "售卖人", avatarUrl: "" },
  status: "completed",
  createdAt: "2026-10-08T00:01:00Z",
  paidAt: null,
  completedAt: "2026-10-08T00:01:00Z",
  cancelledAt: null,
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  clearResourceCache();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  ensureAgreement.mockResolvedValue(true);
  vi.mocked(getSpotGoods).mockResolvedValue({
    id: goods.id,
    product: goods.product,
    salePriceCents: goods.salePriceCents,
    stock: 3,
    sellerId: "1001",
    sellerName: "售卖人",
    sellerAvatarUrl: "",
    updatedAt: "2026-10-08T00:00:00Z",
  });
  vi.mocked(createSpotOrders).mockResolvedValue([completedOrder]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function button(name: string) {
  const item = Array.from(document.querySelectorAll("button")).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === name ||
      candidate.textContent?.trim() === name,
  );
  if (!item) throw new Error(`Missing button: ${name}`);
  return item;
}
async function openPurchase() {
  await act(async () =>
    root.render(
      <SpotMarketplace
        dataSource="local"
        connectBaseUrl="/api/connect"
        initialPage={{
          goods: [goods],
          currentPage: 1,
          pageSize: 24,
          totalCount: 1,
        }}
        error={null}
      />,
    ),
  );
  await act(async () => button("选购矿泉水").click());
}
async function buy() {
  await act(async () => button("创建订单 · ¥1.80").click());
}
async function renderOrder(order: SpotOrder) {
  await act(async () =>
    root.render(
      <SpotOrderDetail
        dataSource="local"
        connectBaseUrl="/api/connect"
        order={order}
        view="buyer"
        returnTo="/shop"
      />,
    ),
  );
}

describe("desktop self purchase", () => {
  it("shows the no-payment notice from the completed response and opens its order on request", async () => {
    await openPurchase();
    await buy();
    expect(ensureAgreement).toHaveBeenCalledOnce();
    expect(createSpotOrders).toHaveBeenCalledExactlyOnceWith(
      [{ spotGoodsId: "5001", quantity: 1, updatedAt: goods.updatedAt }],
      { dataSource: "local", connectBaseUrl: "/api/connect" },
    );
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.body.textContent).toContain(
      "这是你自己上架的商品，无需支付",
    );
    expect(document.body.textContent).toContain("订单已完成，库存已扣减");
    expect(router.push).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(listPaymentQrCodes).not.toHaveBeenCalled();
    await act(async () => button("查看订单").click());
    expect(router.push).toHaveBeenCalledWith(
      "/orders/spot/7001?view=buyer&returnTo=%2Fshop",
    );
  });

  it("closes the notice without navigating and permits a fresh detail fetch", async () => {
    await openPurchase();
    await buy();
    const close = document.querySelector<HTMLButtonElement>(
      '[role="dialog"] [data-slot="dialog-footer"] button',
    )!;
    await act(async () => close.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    await act(async () => button("选购矿泉水").click());
    expect(getSpotGoods).toHaveBeenCalledTimes(2);
    expect(button("创建订单 · ¥1.80").disabled).toBe(false);
  });

  it("retains ordinary payment navigation for a pending order", async () => {
    vi.mocked(createSpotOrders).mockResolvedValue([
      {
        ...completedOrder,
        status: "pending_payment",
        completedAt: null,
        billId: "8001",
      },
    ]);
    await openPurchase();
    await buy();
    expect(router.push).toHaveBeenCalledWith(
      "/orders/spot/7001?view=buyer&returnTo=%2Fshop",
    );
    expect(toast.success).toHaveBeenCalledWith("订单已创建，请继续完成支付");
    expect(document.body.textContent).not.toContain("这是你自己上架的商品");
  });

  it("does not write or show success when the agreement is rejected", async () => {
    ensureAgreement.mockResolvedValue(false);
    await openPurchase();
    await buy();
    expect(createSpotOrders).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("这是你自己上架的商品");
  });

  it("blocks competing clicks while the purchase result is pending", async () => {
    let resolve!: (orders: SpotOrder[]) => void;
    vi.mocked(createSpotOrders).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await openPurchase();
    const submit = button("创建订单 · ¥1.80");
    await act(async () => {
      submit.click();
      submit.click();
    });
    expect(createSpotOrders).toHaveBeenCalledOnce();
    expect(submit.disabled).toBe(true);
    await act(async () => resolve([completedOrder]));
    expect(document.body.textContent).toContain(
      "这是你自己上架的商品，无需支付",
    );
  });

  it("keeps uncertain results locked for order verification", async () => {
    vi.mocked(createSpotOrders).mockRejectedValueOnce(new Error("连接中断"));
    await openPurchase();
    await buy();
    expect(document.body.textContent).toContain("创建结果待核实");
    expect(button("创建订单 · ¥1.80").disabled).toBe(true);
    expect(toast.error).toHaveBeenCalledWith("连接中断，请先到订单核对结果");
    expect(router.push).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("这是你自己上架的商品");
  });

  it("renders a completed no-bill order without payment actions or QR loading", async () => {
    await renderOrder(completedOrder);
    expect(container.textContent).toContain("无需支付，订单已完成");
    expect(container.textContent).not.toContain("账单尚未生成");
    expect(container.textContent).not.toContain("立即支付");
    expect(listPaymentQrCodes).not.toHaveBeenCalled();
  });

  it("does not label a missing bill on an incomplete order as payment-free", async () => {
    await renderOrder({
      ...completedOrder,
      status: "pending_payment",
      completedAt: null,
    });
    expect(container.textContent).toContain("账单尚未生成");
    expect(container.textContent).not.toContain("无需支付，订单已完成");
  });
});
