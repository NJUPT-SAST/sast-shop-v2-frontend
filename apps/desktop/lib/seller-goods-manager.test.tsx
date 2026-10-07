// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentUser,
  getSpotGoods,
  listSellerSpotGoods,
  updateSpotGoodsStock,
  type SpotGoods,
} from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { SellerGoodsManager } from "../components/seller-goods-manager";

const { ensureAgreement, push } = vi.hoisted(() => ({
  ensureAgreement: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  getCurrentUser: vi.fn(),
  getSpotGoods: vi.fn(),
  listSellerSpotGoods: vi.fn(),
  updateSpotGoodsPrice: vi.fn(),
  updateSpotGoodsStock: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement }),
}));
vi.mock("@workspace/ui/components/dialog", () => {
  const Content = ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: ({
      open,
      children,
      onOpenChange,
    }: {
      open: boolean;
      children: React.ReactNode;
      onOpenChange: (open: boolean) => void;
    }) =>
      open ? (
        <div>
          <button onClick={() => onOpenChange(false)}>关闭弹层</button>
          {children}
        </div>
      ) : null,
    DialogContent: Content,
    DialogFooter: Content,
    DialogDescription: Content,
    DialogHeader: Content,
    DialogTitle: Content,
  };
});
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const goods: SpotGoods = {
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
let container: HTMLDivElement;
let root: Root;
let enterViewport: (entries: { isIntersecting: boolean }[]) => void;

function page(items: SpotGoods[], currentPage = 1, totalCount = items.length) {
  return { goods: items, currentPage, pageSize: 20, totalCount };
}

beforeEach(() => {
  clearResourceCache();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof enterViewport) {
        enterViewport = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.clearAllMocks();
  ensureAgreement.mockReset().mockResolvedValue(true);
  vi.mocked(getCurrentUser)
    .mockReset()
    .mockResolvedValue({ id: "42", name: "张同学", avatarUrl: "" });
  vi.mocked(listSellerSpotGoods)
    .mockReset()
    .mockResolvedValue(page([goods]));
  vi.mocked(getSpotGoods).mockReset().mockResolvedValue(goods);
  vi.mocked(updateSpotGoodsStock).mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function render(refreshKey = "visit") {
  await act(async () =>
    root.render(
      <SellerGoodsManager
        dataSource="mock"
        connectBaseUrl="http://localhost"
        authRequired={false}
        refreshKey={refreshKey}
      />,
    ),
  );
}
function button(text: string) {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find(
    (element) =>
      (element.getAttribute("aria-label") ?? element.textContent?.trim()) ===
      text,
  )!;
}
async function openGoods(title = "矿泉水") {
  const card = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((element) => element.textContent?.includes(title));
  expect(card).toBeDefined();
  await act(async () => card!.click());
}
async function saveStock(value: string) {
  const input = container.querySelector<HTMLInputElement>("#spot-edit-stock")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    input
      .closest("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

describe("seller goods management", () => {
  it("shows the loading skeleton initially and reuses the visible cached list on a return within 60 seconds", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let resolveList!: (value: ReturnType<typeof page>) => void;
    vi.mocked(listSellerSpotGoods).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    await render();
    expect(
      container.querySelector('[aria-label="正在加载你的商品"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("暂无上架商品");
    await act(async () => resolveList(page([goods])));
    expect(
      container.querySelector('[aria-label="正在加载你的商品"]'),
    ).toBeNull();
    await act(async () => root.unmount());
    now += 59_000;
    root = createRoot(container);
    await render("return-visit");
    expect(container.textContent).toContain("矿泉水");
    expect(
      container.querySelector('[aria-label="正在加载你的商品"]'),
    ).toBeNull();
    expect(listSellerSpotGoods).toHaveBeenCalledOnce();
  });

  it("keeps the cached cards visible while an explicit refresh loads their replacement", async () => {
    await render();
    let resolveRefresh!: (value: ReturnType<typeof page>) => void;
    vi.mocked(listSellerSpotGoods).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    await render("refresh-visit");
    expect(listSellerSpotGoods).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("矿泉水");
    expect(
      container.querySelector('[aria-label="正在加载你的商品"]'),
    ).toBeNull();
    await act(async () =>
      resolveRefresh(
        page([{ ...goods, product: { ...goods.product, title: "面包" } }]),
      ),
    );
    expect(container.textContent).toContain("面包");
    expect(container.textContent).not.toContain("矿泉水");
  });

  it("preserves cached cards after a background refresh fails and retries only the goods list", async () => {
    await render();
    vi.mocked(listSellerSpotGoods).mockRejectedValueOnce(new Error("offline"));
    await render("refresh-visit");
    expect(container.textContent).toContain("矿泉水");
    expect(container.textContent).toContain("商品加载失败");
    expect(container.textContent).not.toContain("暂无上架商品");
    const userRequests = vi.mocked(getCurrentUser).mock.calls.length;
    vi.mocked(listSellerSpotGoods).mockResolvedValueOnce(
      page([{ ...goods, stock: 3 }]),
    );
    await act(async () => button("重新加载").click());
    expect(listSellerSpotGoods).toHaveBeenCalledTimes(3);
    expect(getCurrentUser).toHaveBeenCalledTimes(userRequests);
    expect(container.textContent).toContain("库存 3");
    expect(container.textContent).not.toContain("商品加载失败");
  });

  it("shows a list failure with retry instead of an empty result", async () => {
    vi.mocked(listSellerSpotGoods)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page([goods]));
    await render();
    expect(container.textContent).toContain("商品加载失败");
    expect(container.textContent).not.toContain("暂无上架商品");
    const retry = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button"),
    ).find((element) => element.textContent?.includes("重新加载"))!;
    await act(async () => retry.click());
    expect(container.textContent).toContain("矿泉水");
    expect(listSellerSpotGoods).toHaveBeenCalledTimes(2);
  });

  it("loads server page 2 when the pagination sentinel enters the viewport", async () => {
    const next = {
      ...goods,
      id: "5002",
      product: { ...goods.product, title: "面包" },
    };
    vi.mocked(listSellerSpotGoods)
      .mockResolvedValueOnce(page([goods], 1, 21))
      .mockResolvedValueOnce(page([next], 2, 21));
    await render();
    await act(async () => enterViewport([{ isIntersecting: true }]));
    expect(listSellerSpotGoods).toHaveBeenLastCalledWith(
      { sellerId: "42", page: 2, pageSize: 20 },
      expect.anything(),
    );
    expect(container.textContent).toContain("矿泉水");
    expect(container.textContent).toContain("面包");
    expect(container.textContent).toContain("已显示全部上架商品");
  });

  it("allows sold-out goods to be opened and restocked", async () => {
    vi.mocked(updateSpotGoodsStock).mockResolvedValue({
      ...goods,
      stock: 2,
      updatedAt: "2026-10-07T10:00:01Z",
    });
    await render();
    expect(container.textContent).toContain("已售罄");
    await openGoods();
    expect(
      container.querySelector<HTMLInputElement>("#spot-edit-stock")?.value,
    ).toBe("0");
    await saveStock("2");
    expect(updateSpotGoodsStock).toHaveBeenCalledWith(
      expect.objectContaining({
        spotGoodsId: goods.id,
        newStock: 2,
        updatedAt: goods.updatedAt,
      }),
      expect.anything(),
    );
    expect(container.textContent).toContain("库存 2");
  });

  it("rechecks ownership before opening the writable editor", async () => {
    vi.mocked(getSpotGoods).mockResolvedValue({ ...goods, sellerId: "99" });
    await render();
    await openGoods();
    expect(container.textContent).toContain("商品详情加载失败");
    expect(container.querySelector("#spot-edit-stock")).toBeNull();
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
  });

  it("ignores an older detail response after another product has been opened", async () => {
    const next = {
      ...goods,
      id: "5002",
      product: { ...goods.product, title: "面包" },
    };
    vi.mocked(listSellerSpotGoods).mockResolvedValue(page([goods, next]));
    let resolveOld!: (value: SpotGoods) => void;
    vi.mocked(getSpotGoods)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
      )
      .mockResolvedValueOnce(next);
    await render();
    await openGoods();
    expect(
      container.querySelector('[aria-label="正在加载商品详情"]'),
    ).not.toBeNull();
    await openGoods("面包");
    expect(
      container.querySelector('[aria-label="正在加载商品详情"]'),
    ).toBeNull();
    await act(async () => resolveOld(goods));
    expect(container.querySelector("#spot-edit-stock")).not.toBeNull();
    await act(async () => button("编辑商品模板").click());
    expect(push).toHaveBeenCalledWith("/group/templates?store=3001&edit=4001");
  });

  it("closes the goods editor and navigates directly to its template", async () => {
    await render();
    await openGoods();
    await act(async () => button("编辑商品模板").click());
    expect(container.querySelector("#spot-edit-stock")).toBeNull();
    expect(push).toHaveBeenCalledWith("/group/templates?store=3001&edit=4001");
  });

  it("keeps the parent dialog locked until an ambiguous update is verified", async () => {
    vi.mocked(updateSpotGoodsStock).mockRejectedValue(
      new Error("network interrupted"),
    );
    vi.mocked(getSpotGoods)
      .mockResolvedValueOnce(goods)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ...goods,
        stock: 1,
        updatedAt: "2026-10-07T10:00:01Z",
      });
    await render();
    await openGoods();
    await saveStock("1");
    expect(button("编辑商品模板").disabled).toBe(true);
    await act(async () => button("关闭弹层").click());
    expect(container.querySelector("#spot-edit-stock")).not.toBeNull();
    await act(async () => button("刷新核实").click());
    expect(button("编辑商品模板").disabled).toBe(false);
    expect(updateSpotGoodsStock).toHaveBeenCalledOnce();
  });

  it("unmounts the old editor on a session identity change and prevents its pending write", async () => {
    let agree!: (value: boolean) => void;
    ensureAgreement.mockReturnValue(
      new Promise((resolve) => {
        agree = resolve;
      }),
    );
    await render();
    await openGoods();
    await saveStock("1");
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "99",
      name: "李同学",
      avatarUrl: "",
    });
    vi.mocked(listSellerSpotGoods).mockResolvedValue(page([]));
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changed")),
    );
    expect(container.querySelector("#spot-edit-stock")).toBeNull();
    await act(async () => agree(true));
    expect(updateSpotGoodsStock).not.toHaveBeenCalled();
    expect(listSellerSpotGoods).toHaveBeenLastCalledWith(
      expect.objectContaining({ sellerId: "99" }),
      expect.anything(),
    );
  });
});
