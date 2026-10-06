// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { SpotMarketplace } from "../components/spot-marketplace";
import { ProductTemplateManager } from "../components/product-template-manager";

const { listSpotGoods, listProductTemplatesPage } = vi.hoisted(() => ({
  listSpotGoods: vi.fn(),
  listProductTemplatesPage: vi.fn(),
}));
vi.mock("@sast-shop/api", () => ({
  listSpotGoods,
  listProductTemplatesPage,
  createSpotOrders: vi.fn(),
  getSpotGoods: vi.fn(),
  createProductTemplate: vi.fn(),
  updateProductTemplate: vi.fn(),
  deleteProductTemplate: vi.fn(),
  ValidationError: Error,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement: vi.fn() }),
}));
vi.mock("../components/managed-image", () => ({ ManagedImage: () => null }));
vi.mock("../components/store-create-dialog", () => ({
  StoreCreateDialog: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@workspace/ui/components/infinite-list-status", () => ({
  InfiniteListStatus: ({
    hasMore,
    loading,
    onLoadMore,
    loadingFallback,
  }: {
    hasMore: boolean;
    loading: boolean;
    onLoadMore: () => void;
    loadingFallback: ReactNode;
  }) => (
    <>
      {loading ? loadingFallback : null}
      {hasMore ? (
        <button disabled={loading} onClick={onLoadMore}>
          加载下一页
        </button>
      ) : null}
    </>
  ),
}));

let root: Root;
let container: HTMLDivElement;

function template(id: string, title: string) {
  return {
    id,
    title,
    description: "",
    storeId: "3001",
    barcode: id,
    priceCents: 100,
    mainImageUrl: "",
    updatedAt: "2026-10-06T00:00:00Z",
  };
}
function goods(id: string, title: string) {
  return {
    id,
    product: template(id, title),
    salePriceCents: 100,
    updatedAt: "2026-10-06T00:00:00Z",
    store: {
      id: "3001",
      name: "店铺",
      address: "",
      logoUrl: "",
      themeColor: "",
    },
  };
}
function page(
  items: ReturnType<typeof template>[],
  currentPage = 1,
  totalCount = items.length,
) {
  return {
    items,
    currentPage,
    pageSize: 1,
    totalCount,
    hasMore: currentPage < totalCount,
  };
}
function goodsPage(
  items: ReturnType<typeof goods>[],
  currentPage = 1,
  totalCount = items.length,
) {
  return { goods: items, currentPage, pageSize: 1, totalCount };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearResourceCache();
  listSpotGoods.mockReset();
  listProductTemplatesPage.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function enter(value: string) {
  const input = container.querySelector<HTMLInputElement>("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function debounce() {
  await act(async () => vi.advanceTimersByTimeAsync(250));
}
async function nextPage() {
  await act(async () => {
    Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "加载下一页")!
      .click();
  });
}

const scenarios = [
  {
    label: "现货",
    list: listSpotGoods,
    result: (id: string, title: string, currentPage = 1, totalCount = 1) =>
      goodsPage([goods(id, title)], currentPage, totalCount),
    render: () => (
      <SpotMarketplace
        dataSource="local"
        connectBaseUrl="/api/connect"
        initialPage={goodsPage([goods("1", "原始商品")], 1, 3)}
        error={null}
      />
    ),
    request: { pageSize: 1 },
  },
  {
    label: "模板",
    list: listProductTemplatesPage,
    result: (id: string, title: string, currentPage = 1, totalCount = 1) =>
      page([template(id, title)], currentPage, totalCount),
    render: () => (
      <ProductTemplateManager
        dataSource="local"
        connectBaseUrl="/api/connect"
        stores={[
          {
            id: "3001",
            name: "店铺",
            address: "",
            logoUrl: "",
            themeColor: "",
          },
        ]}
        selectedStoreId="3001"
        initialPage={page([template("1", "原始商品")], 1, 3)}
        prefillBarcode=""
        startCreating={false}
        error={null}
      />
    ),
    request: { storeId: "3001", pageSize: 1 },
  },
];

for (const scenario of scenarios) {
  describe(`${scenario.label} backend search`, () => {
    it("refreshes the current keyword when a parent supplies another initial page object", async () => {
      scenario.list
        .mockResolvedValueOnce(scenario.result("2", "首次搜索结果"))
        .mockResolvedValueOnce(scenario.result("6", "刷新搜索结果"));
      await act(async () => root.render(scenario.render()));
      await enter("矿泉水");
      await debounce();
      expect(container.textContent).toContain("首次搜索结果");
      await act(async () => root.render(scenario.render()));
      expect(scenario.list).toHaveBeenCalledTimes(2);
      expect(scenario.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "矿泉水", page: 1 }),
      );
      expect(container.textContent).toContain("刷新搜索结果");
      expect(container.textContent).not.toContain("首次搜索结果");
    });

    it("keeps the keyword after a failed first-page request and permits retry", async () => {
      scenario.list
        .mockRejectedValueOnce(new Error("搜索服务离线"))
        .mockResolvedValueOnce(scenario.result("5", "重试结果"));
      await act(async () => root.render(scenario.render()));
      await enter("矿泉水");
      await debounce();
      expect(container.querySelector("input")!.value).toBe("矿泉水");
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      await act(async () => {
        Array.from(container.querySelectorAll("button"))
          .find((button) => button.textContent === "重新加载")!
          .click();
      });
      expect(scenario.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "矿泉水", page: 1 }),
      );
      expect(container.textContent).toContain("重试结果");
    });

    it("debounces keyword, replaces page one, and loads only the next matching page on demand", async () => {
      scenario.list
        .mockResolvedValueOnce(scenario.result("2", "服务器匹配商品", 1, 2))
        .mockResolvedValueOnce(scenario.result("3", "服务器第二页", 2, 2));
      await act(async () => root.render(scenario.render()));
      expect(scenario.list).not.toHaveBeenCalled();
      expect(container.querySelector("input")!.maxLength).toBe(200);
      await enter("  水  ");
      await act(async () => vi.advanceTimersByTimeAsync(200));
      await enter("  矿泉水  ");
      await act(async () => vi.advanceTimersByTimeAsync(249));
      expect(scenario.list).not.toHaveBeenCalled();
      expect(container.textContent).not.toContain("原始商品");
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(scenario.list).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          ...scenario.request,
          keyword: "矿泉水",
          page: 1,
        }),
      );
      expect(container.textContent).toContain("服务器匹配商品");
      await act(async () => vi.advanceTimersByTimeAsync(2000));
      expect(scenario.list).toHaveBeenCalledTimes(1);
      await nextPage();
      expect(scenario.list).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ...scenario.request,
          keyword: "矿泉水",
          page: 2,
        }),
      );
      expect(container.textContent).toContain("服务器第二页");
    });

    it("ignores an old keyword response and restores the initial page after clearing", async () => {
      let resolveOld!: (value: ReturnType<typeof scenario.result>) => void;
      scenario.list
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveOld = resolve;
            }),
        )
        .mockResolvedValueOnce(scenario.result("4", "最新商品"));
      await act(async () => root.render(scenario.render()));
      await enter("旧搜索");
      await debounce();
      await enter("新搜索");
      await debounce();
      expect(container.textContent).toContain("最新商品");
      await act(async () => resolveOld(scenario.result("2", "过期搜索商品")));
      expect(container.textContent).not.toContain("过期搜索商品");
      expect(container.textContent).toContain("最新商品");
      await enter("");
      await debounce();
      expect(container.textContent).toContain("原始商品");
      expect(container.textContent).not.toContain("最新商品");
    });

    it("does not append an old next page after the keyword changes", async () => {
      let resolveOld!: (value: ReturnType<typeof scenario.result>) => void;
      scenario.list
        .mockResolvedValueOnce(scenario.result("2", "旧结果", 1, 2))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveOld = resolve;
            }),
        )
        .mockResolvedValueOnce(scenario.result("4", "新结果"));
      await act(async () => root.render(scenario.render()));
      await enter("旧搜索");
      await debounce();
      await nextPage();
      await enter("新搜索");
      await debounce();
      await act(async () => resolveOld(scenario.result("3", "旧第二页", 2, 2)));
      expect(container.textContent).toContain("新结果");
      expect(container.textContent).not.toContain("旧第二页");
      expect(scenario.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "新搜索", page: 1 }),
      );
    });
  });
}
