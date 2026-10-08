// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSpotGoods,
  getProductTemplatesByBarcode,
  listPaymentQrCodes,
} from "@sast-shop/api";
import { PublishSpotForm } from "../components/publish-spot-form";

const { ensureAgreement } = vi.hoisted(() => ({ ensureAgreement: vi.fn() }));
vi.mock("@sast-shop/api", async (original) => ({
  ...(await original<typeof import("@sast-shop/api")>()),
  createSpotGoods: vi.fn(),
  getProductTemplatesByBarcode: vi.fn(),
  listPaymentQrCodes: vi.fn(),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("../components/store-create-dialog", () => ({
  StoreCreateDialog: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const updatedAt = "2026-10-08T00:00:00Z";
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  ensureAgreement.mockResolvedValue(true);
  vi.mocked(getProductTemplatesByBarcode).mockResolvedValue([
    {
      productTemplate: {
        id: "4001",
        storeId: "3001",
        title: "矿泉水",
        description: "550ml",
        priceCents: 200,
        barcode: "690000000001",
        mainImageUrl: "",
        updatedAt,
      },
      store: {
        id: "3001",
        name: "小卖部",
        address: "",
        logoUrl: "",
        themeColor: "",
      },
    },
  ]);
  vi.mocked(listPaymentQrCodes).mockResolvedValue([
    { id: "9001", channel: "wechat", content: "wechat-code" },
  ]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function enter(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function setup() {
  await act(async () =>
    root.render(
      <PublishSpotForm dataSource="local" connectBaseUrl="/api/connect" />,
    ),
  );
  await enter("desktop-spot-barcode", "690000000001");
  await act(async () => vi.advanceTimersByTimeAsync(320));
}
async function publish() {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent?.trim() === "上架商品",
  )!;
  await act(async () => button.click());
}
describe("desktop publish inventory limit", () => {
  it("rejects 1000 before agreement, QR lookup, or creating goods", async () => {
    await setup();
    expect(
      container.querySelector<HTMLInputElement>("#desktop-spot-stock")!.max,
    ).toBe("999");
    await enter("desktop-spot-stock", "1000");
    await publish();
    expect(container.textContent).toContain("初始库存必须是 1 至 999 的整数");
    expect(ensureAgreement).not.toHaveBeenCalled();
    expect(listPaymentQrCodes).not.toHaveBeenCalled();
    expect(createSpotGoods).not.toHaveBeenCalled();
  });
  it("publishes the supported upper boundary of 999", async () => {
    await setup();
    await enter("desktop-spot-stock", "999");
    await publish();
    expect(createSpotGoods).toHaveBeenCalledExactlyOnceWith(
      {
        productTemplateId: "4001",
        salePriceCents: 200,
        stockTotal: 999,
        productTemplateUpdatedAt: updatedAt,
      },
      { dataSource: "local", connectBaseUrl: "/api/connect" },
    );
  });
});
