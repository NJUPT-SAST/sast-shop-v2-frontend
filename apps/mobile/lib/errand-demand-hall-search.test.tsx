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
    endMessage,
  }: {
    hasMore: boolean;
    loading: boolean;
    error: boolean;
    onLoadMore: () => void;
    loadingFallback: ReactNode;
    endMessage: ReactNode;
  }) => (
    <>
      {loading ? loadingFallback : null}
      {hasMore || error ? (
        <button disabled={loading} onClick={onLoadMore}>
          {error ? "重试下一页" : "加载下一页"}
        </button>
      ) : !loading ? (
        <p>{endMessage}</p>
      ) : null}
    </>
  ),
}));

type DemandPage = PageResult<ErrandDemandStoreSummary>;

function demand(storeId: string, storeName: string): ErrandDemandStoreSummary {
  return {
    storeId,
    storeName,
    totalOriginUnitPriceCents: 1000,
    totalServiceFeeCents: 100,
    participantAvatars: [],
    updatedAt: null,
  };
}

function page(
  items: ErrandDemandStoreSummary[],
  currentPage = 1,
  totalCount = items.length,
): DemandPage {
  return {
    items,
    currentPage,
    pageSize: 1,
    totalCount,
    hasMore: currentPage < totalCount,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

const originalPage = page([demand("3001", "SAST 小卖部")], 1, 2);
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  clearResourceCache();
  listErrandDemandStoresPage.mockReset();
  refresh.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function render(initialPage = originalPage) {
  await act(async () =>
    root.render(
      <ErrandDemandHall
        dataSource="local"
        connectBaseUrl="http://localhost/api/connect"
        initialPage={initialPage}
        error={null}
      />,
    ),
  );
}

async function enterQuery(value: string) {
  const input = container.querySelector<HTMLInputElement>(
    '[aria-label="搜索店铺名称"]',
  )!;
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  await act(async () => {
    setValue.call(input, value);
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
  expect(button, `Missing button: ${label}`).toBeDefined();
  await act(async () => button!.click());
}

describe("mobile demand hall server search", () => {
  it("keeps initial demand cards without scanning pages until the next-page boundary is activated", async () => {
    listErrandDemandStoresPage.mockResolvedValueOnce(
      page([demand("3002", "南门便利店")], 2, 2),
    );
    await render();
    await advance(1000);
    expect(container.textContent).toContain("SAST 小卖部");
    expect(listErrandDemandStoresPage).not.toHaveBeenCalled();
    await click("加载下一页");
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(1);
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, pageSize: 1 }),
    );
    expect(container.textContent).toContain("南门便利店");
    expect(container.textContent).toContain("SAST 小卖部");
  });

  it("debounces and trims the store name, then paginates matching server results on demand", async () => {
    listErrandDemandStoresPage.mockResolvedValueOnce(
      page([demand("3003", "北门超市")], 1, 2),
    );
    listErrandDemandStoresPage.mockResolvedValueOnce(
      page([demand("3004", "北门水果店")], 2, 2),
    );
    await render();
    await enterQuery("  北门  ");
    expect(container.textContent).not.toContain("SAST 小卖部");
    await advance(249);
    expect(listErrandDemandStoresPage).not.toHaveBeenCalled();
    await advance(1);
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(1);
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "北门", page: 1, pageSize: 1 }),
    );
    expect(container.textContent).toContain("北门超市");
    expect(container.textContent).not.toContain("SAST 小卖部");
    await advance(1000);
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(1);
    await click("加载下一页");
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "北门", page: 2 }),
    );
    expect(container.textContent).toContain("北门水果店");
    expect(container.textContent).toContain("北门超市");
  });

  it("ignores a late first page for the previous store name", async () => {
    const oldSearch = deferred<DemandPage>();
    listErrandDemandStoresPage.mockReturnValueOnce(oldSearch.promise);
    listErrandDemandStoresPage.mockResolvedValueOnce(
      page([demand("3004", "南门水果店")]),
    );
    await render();
    await enterQuery("北门");
    await advance();
    await enterQuery("南门");
    await advance();
    expect(container.textContent).toContain("南门水果店");
    await act(async () =>
      oldSearch.resolve(page([demand("3003", "北门超市")])),
    );
    expect(container.textContent).toContain("南门水果店");
    expect(container.textContent).not.toContain("北门超市");
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(2);
  });

  it("does not append the previous search's pending next page while a new keyword is debouncing", async () => {
    const oldNextPage = deferred<DemandPage>();
    listErrandDemandStoresPage.mockResolvedValueOnce(
      page([demand("3003", "北门超市")], 1, 2),
    );
    listErrandDemandStoresPage.mockReturnValueOnce(oldNextPage.promise);
    listErrandDemandStoresPage.mockResolvedValueOnce(
      page([demand("3005", "南门水果店")]),
    );
    await render();
    await enterQuery("北门");
    await advance();
    await click("加载下一页");
    await enterQuery("南门");
    expect(container.textContent).not.toContain("北门超市");
    await act(async () =>
      oldNextPage.resolve(page([demand("3004", "北门早餐店")], 2, 2)),
    );
    expect(container.textContent).not.toContain("北门早餐店");
    await advance();
    expect(container.textContent).toContain("南门水果店");
    expect(container.textContent).not.toContain("北门早餐店");
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "南门", page: 1 }),
    );
  });

  it("retries a failed search and clears it back to the original demand list", async () => {
    listErrandDemandStoresPage.mockRejectedValueOnce(new Error("offline"));
    listErrandDemandStoresPage.mockResolvedValueOnce(page([]));
    await render();
    await enterQuery("北门");
    await advance();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).not.toContain("暂无待接单需求");
    await click("重新加载");
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(2);
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "北门", page: 1 }),
    );
    expect(container.textContent).toContain("没有匹配的店铺需求");
    await click("清空搜索");
    expect(container.textContent).toContain("SAST 小卖部");
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(2);
    listErrandDemandStoresPage.mockResolvedValueOnce(
      page([demand("3002", "南门便利店")], 2, 2),
    );
    await click("加载下一页");
    expect(listErrandDemandStoresPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ storeName: "", page: 2 }),
    );
    await advance();
    expect(container.textContent).toContain("南门便利店");
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(3);
    expect(refresh).not.toHaveBeenCalled();
  });
});
