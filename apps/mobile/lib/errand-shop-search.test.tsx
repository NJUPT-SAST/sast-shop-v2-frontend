// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageResult, ProductTemplate, Store } from "@sast-shop/api";
import type { ProductCategory } from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { ErrandShop } from "../components/errand-shop";

const { listProductTemplatesPage, refresh } = vi.hoisted(() => ({
  listProductTemplatesPage: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@sast-shop/api", () => ({
  listProductTemplatesPage,
  createErrandDemand: vi.fn(),
}));
vi.mock("../components/mobile-navigation-feedback", () => ({
  useMobileRouter: () => ({ refresh, push: vi.fn() }),
  useMobileNavigation: () => null,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement: vi.fn() }),
}));
vi.mock("../components/store-edit-dialog", () => ({
  StoreEditDialog: () => null,
}));
vi.mock("../components/managed-image", () => ({ ManagedImage: () => null }));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));
vi.mock("../components/mobile-fixed-footer", () => ({
  MobileFixedFooter: ({ children }: { children: ReactNode }) => (
    <footer>{children}</footer>
  ),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("../components/infinite-list-status", () => ({
  InfiniteListStatus: ({
    hasMore,
    loading,
    error,
    onLoadMore,
    loadingFallback,
  }: {
    hasMore: boolean;
    loading: boolean;
    error: boolean;
    onLoadMore: () => void;
    loadingFallback: ReactNode;
  }) => (
    <>
      {loading ? loadingFallback : null}
      {hasMore ? (
        <button disabled={loading} onClick={onLoadMore}>
          {error ? "重试下一页" : "加载下一页"}
        </button>
      ) : null}
    </>
  ),
}));

const store: Store = {
  id: "6",
  name: "测试店铺",
  address: "测试地址",
  logoUrl: "",
  themeColor: "",
};

function template(id: string, title: string): ProductTemplate {
  return {
    id,
    title,
    description: "",
    storeId: store.id,
    barcode: id,
    priceCents: 100,
    mainImageUrl: "",
    updatedAt: "2026-10-06T00:00:00Z",
  };
}

function page(
  id: string,
  title: string,
  currentPage = 1,
  totalCount = 1,
): PageResult<ProductTemplate> {
  return {
    items: [template(id, title)],
    currentPage,
    pageSize: 1,
    totalCount,
    hasMore: currentPage < totalCount,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

let root: Root;
let container: HTMLDivElement;
let initialPage: PageResult<ProductTemplate>;
const categories: ProductCategory[] = [
  { id: "10", storeId: store.id, parentId: null, name: "饮料", sortOrder: 0 },
  { id: "11", storeId: store.id, parentId: "10", name: "瓶装水", sortOrder: 0 },
  { id: "20", storeId: store.id, parentId: null, name: "零食", sortOrder: 1 },
  { id: "21", storeId: store.id, parentId: "20", name: "饼干", sortOrder: 0 },
];

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  clearResourceCache();
  listProductTemplatesPage.mockReset();
  refresh.mockReset();
  initialPage = page("1", "原始商品", 1, 3);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  clearResourceCache();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () =>
    root.render(
      <ErrandShop
        dataSource="local"
        connectBaseUrl="/api/connect"
        store={store}
        initialPage={initialPage}
        categories={categories}
        initialCategoryId="11"
        hasUncategorizedProducts
      />,
    ),
  );
}

function searchInput() {
  const input = container.querySelector<HTMLInputElement>(
    'input[aria-label="搜索店铺商品"]',
  );
  expect(input).not.toBeNull();
  return input!;
}

async function enter(value: string) {
  await act(async () => {
    const input = searchInput();
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function advance(milliseconds = 250) {
  await act(async () => vi.advanceTimersByTimeAsync(milliseconds));
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) =>
      item.textContent === label || item.getAttribute("aria-label") === label,
  );
  expect(button, `button ${label}`).toBeDefined();
  await act(async () => button!.click());
}

describe("mobile shop title full text search", () => {
  it("clears the root and child when selecting uncategorized products", async () => {
    listProductTemplatesPage.mockResolvedValue(page("2", "历史商品"));
    await render();
    await click("未分类");

    expect(container.textContent).not.toContain("瓶装水");
    expect(container.textContent).toContain("历史商品");
    expect(listProductTemplatesPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, categoryFilterMode: "uncategorized" }),
    );
  });

  it("changes the root category and resets the visible child selection", async () => {
    listProductTemplatesPage.mockResolvedValue(page("2", "饼干", 1, 1));
    await render();

    expect(container.textContent).toContain("瓶装水");
    expect(container.textContent).not.toContain("饼干");
    await click("零食");

    expect(container.textContent).toContain("饼干");
    await act(async () => Promise.resolve());
    expect(listProductTemplatesPage).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryFilterMode: "category",
        categoryId: "21",
      }),
    );
  });
  it("debounces input, replaces the first page, and keeps pagination bound to the search", async () => {
    const first = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(page("3", "搜索第二页", 2, 3));
    await render();
    expect(container.textContent).toContain("原始商品");
    await enter("香氛");
    await advance(200);
    await enter("  香氛洗衣液  ");
    await advance(249);
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    await advance(1);
    expect(listProductTemplatesPage).toHaveBeenCalledExactlyOnceWith({
      dataSource: "local",
      connectBaseUrl: "/api/connect",
      storeId: "6",
      keyword: "香氛洗衣液",
      searchMode: "titleFullText",
      categoryFilterMode: "category",
      categoryId: "11",
      page: 1,
      pageSize: 1,
    });
    expect(container.textContent).not.toContain("原始商品");
    expect(container.textContent).not.toContain("暂无");
    await act(async () => first.resolve(page("2", "搜索第一页", 1, 3)));
    await click("加载下一页");
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        storeId: "6",
        keyword: "香氛洗衣液",
        searchMode: "titleFullText",
        page: 2,
      }),
    );
    expect(container.textContent).toContain("搜索第一页");
    expect(container.textContent).toContain("搜索第二页");
    await advance(1_000);
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(2);
  });

  it("ignores a late first page for an earlier keyword", async () => {
    const old = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("3", "当前搜索商品"));
    await render();
    await enter("旧关键词");
    await advance();
    await enter("新关键词");
    await advance();
    await act(async () => old.resolve(page("2", "迟到的旧商品")));
    expect(container.textContent).toContain("当前搜索商品");
    expect(container.textContent).not.toContain("迟到的旧商品");
  });

  it("ignores an old next page after changing the search", async () => {
    const old = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockResolvedValueOnce(page("2", "旧搜索第一页", 1, 2))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("4", "新搜索商品"));
    await render();
    await enter("旧关键词");
    await advance();
    await click("加载下一页");
    await enter("新关键词");
    await advance();
    await act(async () => old.resolve(page("3", "旧搜索第二页", 2, 2)));
    expect(container.textContent).toContain("新搜索商品");
    expect(container.textContent).not.toContain("旧搜索第一页");
    expect(container.textContent).not.toContain("旧搜索第二页");
  });

  it("restores the initial page when cleared and ignores a pending search", async () => {
    const old = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("3", "普通商品第二页", 2, 3));
    await render();
    await enter("香氛");
    await advance();
    await click("清空搜索");
    await advance();
    expect(searchInput().value).toBe("");
    expect(container.textContent).toContain("原始商品");
    await act(async () => old.resolve(page("2", "清空后的迟到商品")));
    expect(container.textContent).not.toContain("清空后的迟到商品");
    await click("加载下一页");
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        keyword: "",
        storeId: "6",
        searchMode: "titleFullText",
        page: 2,
      }),
    );
    expect(container.textContent).toContain("普通商品第二页");
  });

  it("retries a failed first page locally while retaining the keyword and cart", async () => {
    listProductTemplatesPage
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page("2", "重试商品"));
    await render();
    await click("将原始商品加入跑腿清单");
    await enter("洗衣液");
    await advance();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(searchInput().value).toBe("洗衣液");
    expect(container.querySelector("footer")!.textContent).toContain(
      "1 件商品",
    );
    await click("重新加载");
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "洗衣液", page: 1 }),
    );
    expect(container.textContent).toContain("重试商品");
    expect(container.querySelector("footer")!.textContent).toContain(
      "1 件商品",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("retains current results when a next page fails and retries that same page", async () => {
    listProductTemplatesPage
      .mockResolvedValueOnce(page("2", "保留第一页", 1, 2))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page("3", "第二页重试商品", 2, 2));
    await render();
    await enter("香氛");
    await advance();
    await click("加载下一页");
    expect(container.textContent).toContain("保留第一页");
    await click("重试下一页");
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        keyword: "香氛",
        searchMode: "titleFullText",
        page: 2,
      }),
    );
    await click("将保留第一页加入跑腿清单");
    expect(container.textContent).toContain("保留第一页");
    expect(container.textContent).toContain("第二页重试商品");
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(3);
  });

  it("waits for Chinese input composition to finish before starting the debounce", async () => {
    listProductTemplatesPage.mockResolvedValue(page("2", "中文搜索商品"));
    await render();
    await act(async () => {
      searchInput().dispatchEvent(
        new CompositionEvent("compositionstart", { bubbles: true }),
      );
    });
    await enter("xiang");
    await advance(1_000);
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    await enter("香氛");
    await advance(1_000);
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    await act(async () => {
      searchInput().dispatchEvent(
        new CompositionEvent("compositionend", { bubbles: true, data: "香氛" }),
      );
    });
    await advance(249);
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    await advance(1);
    expect(listProductTemplatesPage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ keyword: "香氛", searchMode: "titleFullText" }),
    );
    expect(container.textContent).toContain("中文搜索商品");
  });
});
