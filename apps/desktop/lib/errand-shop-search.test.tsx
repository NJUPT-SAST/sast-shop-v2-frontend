// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageResult, ProductTemplate, Store } from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { ErrandShop } from "../components/errand-shop";

const { listProductTemplatesPage, refresh, toastError } = vi.hoisted(() => ({
  listProductTemplatesPage: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@sast-shop/api", () => ({
  listProductTemplatesPage,
  createErrandDemand: vi.fn(),
  updateErrandDemand: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement: vi.fn() }),
}));
vi.mock("../components/store-edit-dialog", () => ({
  StoreEditDialog: () => null,
}));
vi.mock("../components/managed-image", () => ({ ManagedImage: () => null }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}));
vi.mock("@workspace/ui/components/infinite-list-status", () => ({
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

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearResourceCache();
  listProductTemplatesPage.mockReset();
  refresh.mockReset();
  toastError.mockReset();
  initialPage = page("1", "原始商品", 1, 3);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(withCart = false) {
  await act(async () =>
    root.render(
      <ErrandShop
        dataSource="local"
        connectBaseUrl="/api/connect"
        store={store}
        initialPage={initialPage}
        error={null}
        editInitialItems={
          withCart
            ? [
                {
                  template: template("99", "已选商品"),
                  quantity: 2,
                  serviceFeePerUnitCents: 125,
                },
              ]
            : undefined
        }
      />,
    ),
  );
}

function searchInput() {
  return container.querySelector<HTMLInputElement>(
    'input[aria-label="搜索商品名称"]',
  )!;
}

async function enterInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function enter(value: string) {
  await enterInput(searchInput(), value);
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) =>
      item.textContent === label || item.getAttribute("aria-label") === label,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

async function submit() {
  const form = container.querySelector('form[aria-label="店铺商品搜索"]');
  expect(form).not.toBeNull();
  await act(async () => {
    form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

describe("desktop shop title full text search", () => {
  it("only searches after submission and keeps pagination bound to the submitted keyword", async () => {
    const first = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(page("3", "搜索第二页", 2, 3));
    await render();
    await enter("  香氛洗衣液  ");
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    expect(container.textContent).toContain("原始商品");
    await click("搜索");
    expect(listProductTemplatesPage).toHaveBeenCalledExactlyOnceWith({
      dataSource: "local",
      connectBaseUrl: "/api/connect",
      storeId: "6",
      keyword: "香氛洗衣液",
      searchMode: "titleFullText",
      page: 1,
      pageSize: 1,
    });
    expect(container.textContent).not.toContain("原始商品");
    expect(container.textContent).not.toContain("暂无");
    await act(async () => first.resolve(page("2", "搜索第一页", 1, 3)));
    await enter("未提交的新关键词");
    expect(container.textContent).toContain("搜索第一页");
    await click("加载下一页");
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        storeId: "6",
        keyword: "香氛洗衣液",
        searchMode: "titleFullText",
        page: 2,
      }),
    );
    await enter("再次修改草稿");
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("搜索第一页");
    expect(container.textContent).toContain("搜索第二页");
  });

  it("ignores a late first page for a previous submitted keyword", async () => {
    const old = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("3", "当前搜索商品"));
    await render();
    await enter("旧关键词");
    await submit();
    await enter("新关键词");
    await submit();
    await act(async () => old.resolve(page("2", "迟到的旧商品")));
    expect(container.textContent).toContain("当前搜索商品");
    expect(container.textContent).not.toContain("迟到的旧商品");
  });

  it("ignores a late next page after a different keyword is submitted", async () => {
    const old = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockResolvedValueOnce(page("2", "旧搜索第一页", 1, 2))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("4", "新搜索商品"));
    await render();
    await enter("旧关键词");
    await submit();
    await click("加载下一页");
    await enter("新关键词");
    await submit();
    await act(async () => old.resolve(page("3", "旧搜索第二页", 2, 2)));
    expect(container.textContent).toContain("新搜索商品");
    expect(container.textContent).not.toContain("旧搜索第二页");
  });

  it("restores the initial list on clear and ignores a pending search while ordinary pagination resumes", async () => {
    const old = deferred<PageResult<ProductTemplate>>();
    listProductTemplatesPage
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("3", "普通商品第二页", 2, 3));
    await render();
    await enter("香氛");
    await submit();
    await click("清空搜索");
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

  it("retries a failed search locally while preserving cart quantity, fee drafts and deadline", async () => {
    listProductTemplatesPage
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page("2", "重试商品"));
    await render(true);
    const fee = container.querySelector<HTMLInputElement>("#fee-99")!;
    const deadline =
      container.querySelector<HTMLInputElement>("#errand-deadline")!;
    const originalDeadline = deadline.value;
    await enterInput(fee, "2.75");
    await click("增加已选商品数量");
    await enter("洗衣液");
    await submit();
    expect(container.textContent).toContain("商品搜索失败");
    expect(container.querySelector("aside")!.textContent).toContain("已选商品");
    expect(container.querySelector("aside")!.textContent).toContain(
      "1 种 · 3 件",
    );
    expect(fee.value).toBe("2.75");
    expect(deadline.value).toBe(originalDeadline);
    await click("重新加载");
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "洗衣液", page: 1 }),
    );
    expect(container.textContent).toContain("重试商品");
    expect(refresh).not.toHaveBeenCalled();
    await click("清空搜索");
    expect(container.querySelector("aside")!.textContent).toContain(
      "1 种 · 3 件",
    );
    expect(fee.value).toBe("2.75");
  });

  it("keeps appended results when the cart causes a render and retries a failed next page", async () => {
    listProductTemplatesPage
      .mockResolvedValueOnce(page("2", "保留第一页", 1, 2))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page("3", "第二页重试商品", 2, 2));
    await render(true);
    await enter("香氛");
    await submit();
    await click("加载下一页");
    expect(container.textContent).toContain("保留第一页");
    await click("重试下一页");
    expect(listProductTemplatesPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: "香氛", page: 2 }),
    );
    await enterInput(
      container.querySelector<HTMLInputElement>("#fee-99")!,
      "3.50",
    );
    await click("增加已选商品数量");
    expect(container.textContent).toContain("保留第一页");
    expect(container.textContent).toContain("第二页重试商品");
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(3);
  });

  it("refreshes the same submitted keyword and after a new parent initial page arrives", async () => {
    listProductTemplatesPage
      .mockResolvedValueOnce(page("2", "首次商品"))
      .mockResolvedValueOnce(page("3", "主动重搜商品"))
      .mockResolvedValueOnce(page("4", "父页面刷新商品"));
    await render();
    await enter("香氛");
    await submit();
    await click("搜索");
    expect(container.textContent).toContain("主动重搜商品");
    initialPage = page("1", "更新的原始商品", 1, 3);
    await render();
    expect(listProductTemplatesPage).toHaveBeenCalledTimes(3);
    expect(container.textContent).toContain("父页面刷新商品");
  });

  it("prevents IME confirmation from submitting but accepts ordinary Enter submission", async () => {
    listProductTemplatesPage.mockResolvedValue(page("2", "回车搜索商品"));
    await render();
    await enter("香氛");
    for (const options of [
      { isComposing: true, keyCode: 13 },
      { isComposing: false, keyCode: 229 },
    ]) {
      const key = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        ...options,
      });
      await act(async () => {
        searchInput().dispatchEvent(key);
      });
      expect(key.defaultPrevented).toBe(true);
    }
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    const enterKey = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      searchInput().dispatchEvent(enterKey);
    });
    if (!enterKey.defaultPrevented) await submit();
    expect(listProductTemplatesPage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ keyword: "香氛", page: 1 }),
    );
  });

  it("rejects oversized keywords without replacing the current list", async () => {
    await render();
    await enter("水".repeat(201));
    await submit();
    expect(toastError).toHaveBeenCalledWith("搜索关键词不能超过 200 个字符");
    expect(listProductTemplatesPage).not.toHaveBeenCalled();
    expect(container.textContent).toContain("原始商品");
  });
});
