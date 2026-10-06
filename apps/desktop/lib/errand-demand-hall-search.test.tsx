// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrandDemandStoreSummary, PageResult } from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { ErrandDemandHall } from "../components/errand-demand-hall";

const { listErrandDemandStoresPage, refresh } = vi.hoisted(() => ({
  listErrandDemandStoresPage: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@sast-shop/api", () => ({ listErrandDemandStoresPage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
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

function page(
  id: string,
  storeName: string,
  currentPage = 1,
  totalCount = 1,
): PageResult<ErrandDemandStoreSummary> {
  return {
    items: [
      {
        storeId: id,
        storeName,
        participantAvatars: [],
        totalOriginUnitPriceCents: 1000,
        totalServiceFeeCents: 100,
        updatedAt: null,
      },
    ],
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
let initialPage: PageResult<ErrandDemandStoreSummary>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearResourceCache();
  listErrandDemandStoresPage.mockReset();
  refresh.mockReset();
  initialPage = page("1", "原始需求店铺", 1, 3);
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

async function render() {
  await act(async () =>
    root.render(
      <ErrandDemandHall
        dataSource="local"
        connectBaseUrl="/api/connect"
        initialPage={initialPage}
        error={null}
      />,
    ),
  );
}

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

async function advance(milliseconds = 250) {
  await act(async () => vi.advanceTimersByTimeAsync(milliseconds));
}

async function click(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent === label,
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

describe("desktop errand demand store search", () => {
  it("debounces a trimmed store name and only requests matching pages on demand", async () => {
    listErrandDemandStoresPage
      .mockResolvedValueOnce(page("2", "服务器判定的匹配店铺", 1, 2))
      .mockResolvedValueOnce(page("3", "服务器第二页", 2, 2));
    await render();
    expect(listErrandDemandStoresPage).not.toHaveBeenCalled();
    await enter(" 小 ");
    await advance(200);
    await enter(" 小卖部 ");
    await advance(249);
    expect(listErrandDemandStoresPage).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("原始需求店铺");
    await advance(1);
    expect(listErrandDemandStoresPage).toHaveBeenCalledExactlyOnceWith({
      dataSource: "local",
      connectBaseUrl: "/api/connect",
      storeName: "小卖部",
      page: 1,
      pageSize: 1,
    });
    expect(container.textContent).toContain("服务器判定的匹配店铺");
    await advance(2000);
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(1);
    await click("加载下一页");
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "小卖部", page: 2 }),
    );
    expect(container.textContent).toContain("服务器第二页");
  });

  it("ignores a late first page for the previous keyword", async () => {
    const old = deferred<PageResult<ErrandDemandStoreSummary>>();
    listErrandDemandStoresPage
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("3", "最新需求"));
    await render();
    await enter("旧店铺");
    await advance();
    await enter("新店铺");
    await advance();
    await act(async () => old.resolve(page("2", "迟到的旧需求")));
    expect(container.textContent).toContain("最新需求");
    expect(container.textContent).not.toContain("迟到的旧需求");
  });

  it("does not append an old next page after changing the keyword", async () => {
    const old = deferred<PageResult<ErrandDemandStoreSummary>>();
    listErrandDemandStoresPage
      .mockResolvedValueOnce(page("2", "旧搜索第一页", 1, 2))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page("4", "新搜索结果"));
    await render();
    await enter("旧店铺");
    await advance();
    await click("加载下一页");
    await enter("新店铺");
    await advance();
    await act(async () => old.resolve(page("3", "旧搜索第二页", 2, 2)));
    expect(container.textContent).toContain("新搜索结果");
    expect(container.textContent).not.toContain("旧搜索第二页");
  });

  it("does not replace the restored list when a cleared search finishes late", async () => {
    const old = deferred<PageResult<ErrandDemandStoreSummary>>();
    listErrandDemandStoresPage.mockReturnValueOnce(old.promise);
    await render();
    await enter("小卖部");
    await advance();
    await enter("");
    expect(container.textContent).toContain("原始需求店铺");
    await act(async () => old.resolve(page("2", "已清空的搜索结果")));
    expect(container.textContent).toContain("原始需求店铺");
    expect(container.textContent).not.toContain("已清空的搜索结果");
  });

  it("refreshes the active search after a refreshed parent page arrives", async () => {
    listErrandDemandStoresPage
      .mockResolvedValueOnce(page("2", "刷新前搜索结果"))
      .mockResolvedValueOnce(page("3", "刷新后搜索结果"));
    await render();
    await enter("小卖部");
    await advance();
    initialPage = page("1", "更新的原始店铺", 1, 3);
    await render();
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(2);
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "小卖部", page: 1 }),
    );
    expect(container.textContent).toContain("刷新后搜索结果");
    expect(container.textContent).not.toContain("刷新前搜索结果");
  });

  it("restores the original list immediately when cleared and paginates without the old keyword", async () => {
    listErrandDemandStoresPage
      .mockResolvedValueOnce(page("2", "搜索结果"))
      .mockResolvedValueOnce(page("3", "未过滤的第二页", 2, 3));
    await render();
    await enter("小卖部");
    await advance();
    await enter("");
    expect(container.textContent).toContain("原始需求店铺");
    expect(container.textContent).not.toContain("搜索结果");
    await click("加载下一页");
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "", page: 2 }),
    );
    expect(container.textContent).toContain("未过滤的第二页");
  });

  it("preserves the keyword after a failed first page and retries the search", async () => {
    listErrandDemandStoresPage
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page("2", "重试成功"));
    await render();
    await enter("小卖部");
    await advance();
    expect(container.querySelector("input")!.value).toBe("小卖部");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await click("重新加载");
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "小卖部", page: 1 }),
    );
    expect(container.textContent).toContain("重试成功");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps search results when the next page fails and retries the same page", async () => {
    listErrandDemandStoresPage
      .mockResolvedValueOnce(page("2", "保留第一页", 1, 2))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(page("3", "第二页重试成功", 2, 2));
    await render();
    await enter("小卖部");
    await advance();
    await click("加载下一页");
    expect(container.textContent).toContain("保留第一页");
    await click("重试下一页");
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "小卖部", page: 2 }),
    );
    expect(container.textContent).toContain("第二页重试成功");
  });
});
