// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSpotGoods,
  updateSpotGoodsPrice,
  updateSpotGoodsStock,
  UpdatedSpotGoodsRefreshError,
  ValidationError,
  type SpotGoods,
} from "@sast-shop/api";
import { SpotGoodsEditor } from "../components/spot-goods-editor";

const { ensureAgreement, onUpdated, onBusyChange, success } = vi.hoisted(
  () => ({
    ensureAgreement: vi.fn(),
    onUpdated: vi.fn(),
    onBusyChange: vi.fn(),
    success: vi.fn(),
  }),
);
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getSpotGoods: vi.fn(),
  updateSpotGoodsPrice: vi.fn(),
  updateSpotGoodsStock: vi.fn(),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("@workspace/ui/components/responsive-dialog", () => ({
  ResponsiveDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("sonner", () => ({ toast: { success } }));

const goods: SpotGoods = {
  id: "5001",
  sellerId: "42",
  sellerName: "张同学",
  sellerAvatarUrl: "",
  salePriceCents: 200,
  stock: 5,
  updatedAt: "2026-10-07T10:00:00.123456789Z",
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
const afterPrice = {
  ...goods,
  salePriceCents: 300,
  updatedAt: "2026-10-07T10:00:01.987654321Z",
};
const afterBoth = {
  ...afterPrice,
  stock: 7,
  updatedAt: "2026-10-07T10:00:02.765432109Z",
};
let container: HTMLDivElement;
let root: Root | null;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  ensureAgreement.mockReset().mockResolvedValue(true);
  vi.mocked(getSpotGoods).mockReset().mockResolvedValue(goods);
  vi.mocked(updateSpotGoodsPrice).mockReset().mockResolvedValue(afterPrice);
  vi.mocked(updateSpotGoodsStock).mockReset().mockResolvedValue(afterBoth);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root!.render(
      <SpotGoodsEditor
        goods={goods}
        serviceOptions={{
          dataSource: "mock",
          connectBaseUrl: "http://localhost",
        }}
        onUpdated={onUpdated}
        onBusyChange={onBusyChange}
      />,
    ),
  );
}
async function enter(id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>("#" + id)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () =>
    container.querySelector<HTMLFormElement>("form")!.requestSubmit(),
  );
}
function button(text: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((element) => element.textContent?.trim() === text)!;
}
function value(id: string) {
  return container.querySelector<HTMLInputElement>("#" + id)!.value;
}
async function changeBoth() {
  await enter("spot-edit-price", "3");
  await enter("spot-edit-stock", "7");
}

describe("seller spot goods combined editing", () => {
  it("keeps one unchanged save action outside the scrolling form and submits only dirty fields", async () => {
    await render();
    expect(button("保存修改").disabled).toBe(true);
    expect(button("保存修改").closest("form")).toBeNull();
    expect(button("保存修改").form?.id).toBe("spot-goods-edit-form");
    await enter("spot-edit-price", "3");
    await act(async () => button("保存修改").click());
    expect(updateSpotGoodsPrice).toHaveBeenCalledExactlyOnceWith(
      {
        spotGoodsId: goods.id,
        newSalePriceCents: 300,
        updatedAt: goods.updatedAt,
      },
      expect.anything(),
    );
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(ensureAgreement).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledExactlyOnceWith("修改已保存");
  });

  it("writes price before stock, reuses the exact returned version, and agrees once", async () => {
    const response = deferred<SpotGoods>();
    vi.mocked(updateSpotGoodsPrice).mockReturnValue(response.promise);
    await render();
    await changeBoth();
    await submit();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    await submit();
    expect(ensureAgreement).toHaveBeenCalledOnce();
    await act(async () => response.resolve(afterPrice));
    expect(updateSpotGoodsStock).toHaveBeenCalledExactlyOnceWith(
      { spotGoodsId: goods.id, newStock: 7, updatedAt: afterPrice.updatedAt },
      expect.anything(),
    );
    expect(
      vi.mocked(updateSpotGoodsPrice).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(updateSpotGoodsStock).mock.invocationCallOrder[0]!,
    );
    expect(value("spot-edit-price")).toBe("3.00");
    expect(value("spot-edit-stock")).toBe("7");
    expect(success).toHaveBeenCalledOnce();
    expect(onUpdated).toHaveBeenCalledTimes(2);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("accepts zero stock without rewriting the unchanged price", async () => {
    vi.mocked(updateSpotGoodsStock).mockResolvedValue({ ...goods, stock: 0 });
    await render();
    await enter("spot-edit-stock", "0");
    await submit();
    expect(updateSpotGoodsStock).toHaveBeenCalledExactlyOnceWith(
      { spotGoodsId: goods.id, newStock: 0, updatedAt: goods.updatedAt },
      expect.anything(),
    );
    expect(updateSpotGoodsPrice).not.toHaveBeenCalled();
    expect(value("spot-edit-stock")).toBe("0");
  });

  it("validates both fields before agreeing or writing and focuses the first error", async () => {
    await render();
    await enter("spot-edit-price", "");
    await enter("spot-edit-stock", "1.5");
    await submit();
    expect(container.querySelector("#spot-edit-price-error")!.textContent).toBe(
      "请输入售价",
    );
    expect(
      container.querySelector("#spot-edit-stock-error")!.textContent,
    ).toContain("整数");
    expect(document.activeElement?.id).toBe("spot-edit-price");
    expect(ensureAgreement).not.toHaveBeenCalled();
    expect(updateSpotGoodsPrice).not.toHaveBeenCalled();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    await enter("spot-edit-price", "3");
    expect(container.querySelector("#spot-edit-price-error")).toBeNull();
    await submit();
    expect(document.activeElement?.id).toBe("spot-edit-stock");
    expect(ensureAgreement).not.toHaveBeenCalled();
    expect(value("spot-edit-price")).toBe("3");
  });

  it("retains both drafts after agreement refusal", async () => {
    ensureAgreement.mockResolvedValue(false);
    await render();
    await changeBoth();
    await submit();
    expect(updateSpotGoodsPrice).not.toHaveBeenCalled();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(value("spot-edit-price")).toBe("3");
    expect(value("spot-edit-stock")).toBe("7");
    expect(button("保存修改").disabled).toBe(false);
  });

  it("blocks repeated submits while waiting for the agreement", async () => {
    const agreement = deferred<boolean>();
    ensureAgreement.mockReturnValue(agreement.promise);
    await render();
    await changeBoth();
    await submit();
    await submit();
    expect(ensureAgreement).toHaveBeenCalledOnce();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    await act(async () => agreement.resolve(true));
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(updateSpotGoodsStock).toHaveBeenCalledOnce();
  });

  it("does not write after unmounting while agreement is pending", async () => {
    const agreement = deferred<boolean>();
    ensureAgreement.mockReturnValue(agreement.promise);
    await render();
    await changeBoth();
    await submit();
    await act(async () => root!.unmount());
    root = null;
    await act(async () => agreement.resolve(true));
    expect(updateSpotGoodsPrice).not.toHaveBeenCalled();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("retains the successful price after definite stock failure and retries only stock", async () => {
    vi.mocked(updateSpotGoodsStock).mockRejectedValueOnce(
      new ValidationError("库存修改失败"),
    );
    await render();
    await changeBoth();
    await submit();
    expect(container.textContent).toContain("售价已保存，库存保存失败");
    expect(success).not.toHaveBeenCalled();
    expect(value("spot-edit-price")).toBe("3.00");
    expect(value("spot-edit-stock")).toBe("7");
    await submit();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(updateSpotGoodsStock).toHaveBeenLastCalledWith(
      { spotGoodsId: goods.id, newStock: 7, updatedAt: afterPrice.updatedAt },
      expect.anything(),
    );
    expect(success).toHaveBeenCalledOnce();
  });

  it("stops after a mismatched stock read and retries only stock with its fresh version", async () => {
    vi.mocked(updateSpotGoodsStock).mockRejectedValueOnce(
      new Error("conflict"),
    );
    const fresh = {
      ...afterPrice,
      updatedAt: "2026-10-07T10:00:02.654321987Z",
    };
    vi.mocked(getSpotGoods).mockResolvedValue(fresh);
    await render();
    await changeBoth();
    await submit();
    expect(container.textContent).toContain("售价已保存，库存修改尚未确认");
    expect(value("spot-edit-price")).toBe("3.00");
    expect(value("spot-edit-stock")).toBe("7");
    expect(success).not.toHaveBeenCalled();
    await submit();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(updateSpotGoodsStock).toHaveBeenLastCalledWith(
      { spotGoodsId: goods.id, newStock: 7, updatedAt: fresh.updatedAt },
      expect.anything(),
    );
  });

  it("continues the original stock change after verifying a lost price response", async () => {
    vi.mocked(updateSpotGoodsPrice).mockRejectedValue(
      new Error("response lost"),
    );
    vi.mocked(getSpotGoods).mockResolvedValue(afterPrice);
    await render();
    await changeBoth();
    await submit();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(getSpotGoods).toHaveBeenCalledOnce();
    expect(updateSpotGoodsStock).toHaveBeenCalledExactlyOnceWith(
      { spotGoodsId: goods.id, newStock: 7, updatedAt: afterPrice.updatedAt },
      expect.anything(),
    );
    expect(ensureAgreement).toHaveBeenCalledOnce();
    expect(success).toHaveBeenCalledOnce();
  });

  it("does not submit stock after an unmatched price recovery", async () => {
    vi.mocked(updateSpotGoodsPrice).mockRejectedValueOnce(
      new Error("conflict"),
    );
    vi.mocked(getSpotGoods).mockResolvedValue({
      ...goods,
      salePriceCents: 250,
    });
    await render();
    await changeBoth();
    await submit();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("请核对后重新保存");
    expect(value("spot-edit-price")).toBe("3");
    expect(value("spot-edit-stock")).toBe("7");
    expect(success).not.toHaveBeenCalled();
  });

  it("locks pending recovery and only reads on refresh before an explicit stock-only save", async () => {
    vi.mocked(updateSpotGoodsPrice).mockRejectedValue(
      new Error("response lost"),
    );
    vi.mocked(getSpotGoods)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(afterPrice);
    await render();
    await changeBoth();
    await submit();
    expect(button("保存修改").disabled).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    await submit();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    await act(async () => button("刷新核实").click());
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("库存修改尚未保存");
    expect(value("spot-edit-stock")).toBe("7");
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(success).not.toHaveBeenCalled();
    await submit();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(updateSpotGoodsStock).toHaveBeenCalledExactlyOnceWith(
      { spotGoodsId: goods.id, newStock: 7, updatedAt: afterPrice.updatedAt },
      expect.anything(),
    );
    expect(ensureAgreement).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledOnce();
  });

  it("recovers confirmed price writes and keeps the remaining stock draft for explicit saving", async () => {
    vi.mocked(updateSpotGoodsPrice).mockRejectedValue(
      new UpdatedSpotGoodsRefreshError(goods.id, new Error("offline")),
    );
    vi.mocked(getSpotGoods)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ ...afterPrice, salePriceCents: 320 });
    await render();
    await changeBoth();
    await submit();
    expect(container.textContent).toContain("售价已保存，库存尚未保存");
    expect(success).not.toHaveBeenCalled();
    await act(async () => button("刷新核实").click());
    expect(value("spot-edit-price")).toBe("3.20");
    expect(value("spot-edit-stock")).toBe("7");
    expect(container.textContent).toContain("库存修改尚未保存");
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(updateSpotGoodsPrice).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();
  });

  it("refreshes an untouched stock field without sending a stock write", async () => {
    vi.mocked(updateSpotGoodsPrice).mockResolvedValue({
      ...afterPrice,
      stock: 4,
    });
    await render();
    await enter("spot-edit-price", "3");
    await submit();
    expect(value("spot-edit-stock")).toBe("4");
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(button("保存修改").disabled).toBe(true);
  });

  it("stops and keeps recovery locked when a write returns another identity", async () => {
    vi.mocked(updateSpotGoodsPrice).mockResolvedValue({
      ...afterPrice,
      sellerId: "99",
    });
    await render();
    await changeBoth();
    await submit();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(getSpotGoods).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(button("保存修改").disabled).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
  });
});
