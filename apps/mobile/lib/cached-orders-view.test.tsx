// @vitest-environment jsdom

import React, { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { CachedOrdersView } from "../components/cached-orders-view";
import type { OrderFilters } from "./order-filters";

const {
  listSpotOrdersPage,
  listBuyerErrandOrdersPage,
  listErrandTasksPage,
  refresh,
} = vi.hoisted(() => ({
  listSpotOrdersPage: vi.fn(),
  listBuyerErrandOrdersPage: vi.fn(),
  listErrandTasksPage: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@sast-shop/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sast-shop/api")>()),
  listSpotOrdersPage,
  listBuyerErrandOrdersPage,
  listErrandTasksPage,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/orders",
  useRouter: () => ({ refresh }),
}));
vi.mock("../components/managed-image", () => ({ ManagedImage: () => null }));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));
vi.mock("../components/transaction-agreement-provider", () => ({
  useTransactionAgreement: () => ({ ensureAgreement: vi.fn() }),
}));

const captainFilters: OrderFilters = {
  type: "errand",
  view: "captain",
  status: "all",
  query: "",
};
const buyerFilters: OrderFilters = {
  type: "spot",
  view: "buyer",
  status: "all",
  query: "",
};
const task = {
  id: "7001",
  storeId: "3001",
  storeName: "缓存采购任务",
  status: "shopping",
  itemCount: 1,
  items: [],
  updatedAt: "2026-10-05T08:00:00Z",
  createdAt: "2026-10-05T08:00:00Z",
};
function page(items: unknown[] = []) {
  return {
    items,
    currentPage: 1,
    pageSize: 20,
    totalCount: items.length,
    hasMore: false,
  };
}
let root: Root;
let container: HTMLDivElement;
let now: number;
let firstCommits: string[];
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  clearResourceCache();
  now = 1_800_000_000_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  listSpotOrdersPage.mockReset().mockResolvedValue(page());
  listBuyerErrandOrdersPage.mockReset().mockResolvedValue(page());
  listErrandTasksPage.mockReset().mockResolvedValue(page([task]));
  refresh.mockReset();
  firstCommits = [];
  window.history.replaceState(null, "", "/orders?type=errand&view=captain");
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
function Probe({
  refreshKey,
  filters,
}: {
  refreshKey: string;
  filters: OrderFilters;
}) {
  useLayoutEffect(() => {
    firstCommits.push(container.textContent ?? "");
  }, []);
  return (
    <CachedOrdersView
      dataSource="mock"
      connectBaseUrl="http://localhost/api/connect"
      initialFilters={filters}
      refreshKey={refreshKey}
    />
  );
}
async function render(refreshKey: string, filters = captainFilters) {
  await act(async () =>
    root.render(<Probe refreshKey={refreshKey} filters={filters} />),
  );
}
async function leave() {
  await act(async () => root.render(null));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("cached orders list", () => {
  it("shows cached orders on the first commit after navigating back without another request", async () => {
    await render("visit-1");
    expect(container.textContent).toContain(task.storeName);
    await leave();
    await render("visit-2");
    expect(firstCommits.at(-1)).toContain(task.storeName);
    expect(container.querySelector('[aria-label="正在加载订单"]')).toBeNull();
    expect(listSpotOrdersPage).toHaveBeenCalledTimes(2);
    expect(listErrandTasksPage).toHaveBeenCalledTimes(1);
  });

  it("silently refreshes stale orders while retaining the previous cards", async () => {
    await render("visit-1");
    await leave();
    now += 15_001;
    const latest = deferred<ReturnType<typeof page>>();
    listErrandTasksPage.mockReturnValueOnce(latest.promise);
    await render("visit-2");
    expect(firstCommits.at(-1)).toContain(task.storeName);
    expect(container.textContent).toContain(task.storeName);
    expect(container.querySelector('[aria-label="正在加载订单"]')).toBeNull();
    expect(listErrandTasksPage).toHaveBeenCalledTimes(2);
    await act(async () =>
      latest.resolve(page([{ ...task, storeName: "后台更新的采购任务" }])),
    );
    expect(container.textContent).toContain("后台更新的采购任务");
  });

  it("refreshes same-mounted manual reload and applies URL filters independently of cached lists", async () => {
    await render("visit-1");
    listErrandTasksPage.mockResolvedValueOnce(
      page([{ ...task, storeName: "手动更新的采购任务" }]),
    );
    await render("manual-refresh");
    expect(container.textContent).toContain("手动更新的采购任务");
    expect(listErrandTasksPage).toHaveBeenCalledTimes(2);
    window.history.replaceState(null, "", "/orders?type=spot&view=buyer");
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    await render("manual-refresh", buyerFilters);
    expect(container.textContent).not.toContain("手动更新的采购任务");
    expect(container.textContent).toContain("暂无现货买方订单");
    expect(listErrandTasksPage).toHaveBeenCalledTimes(2);
  });

  it("keeps cached cards after a background failure and retries without replacing the route", async () => {
    await render("visit-1");
    listErrandTasksPage.mockRejectedValueOnce(new Error("离线"));
    await render("manual-refresh");
    expect(container.textContent).toContain(task.storeName);
    expect(container.textContent).toContain("部分订单更新失败");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "重新加载",
    );
    expect(retry).toBeDefined();
    await act(async () => retry!.click());
    expect(container.textContent).not.toContain("部分订单更新失败");
    expect(listErrandTasksPage).toHaveBeenCalledTimes(3);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a local skeleton for a cold perspective while other lists are ready", async () => {
    const pending = deferred<ReturnType<typeof page>>();
    listErrandTasksPage.mockReturnValueOnce(pending.promise);
    await render("visit-1");
    expect(container.querySelector('[aria-label="正在加载订单"]')).toBeNull();
    expect(
      container.querySelector('[aria-label="正在加载该视角订单"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("暂无现货买方订单");
    await act(async () => pending.resolve(page([task])));
    expect(container.textContent).toContain(task.storeName);
  });

  it("maps a first failure to only its perspective", async () => {
    listErrandTasksPage.mockRejectedValueOnce(new Error("离线"));
    await render("visit-1");
    expect(container.textContent).toContain("订单加载失败");
    window.history.replaceState(null, "", "/orders?type=spot&view=buyer");
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    await render("visit-1", buyerFilters);
    expect(container.textContent).not.toContain("订单加载失败");
    expect(container.textContent).toContain("暂无现货买方订单");
  });
  it("keeps the existing filter input mounted when a manual refresh receives updated URL filters", async () => {
    await render("visit-1");
    const input = container.querySelector<HTMLInputElement>(
      `input[aria-label="搜索店铺或商品"]`,
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "缓存");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input.value).toBe("缓存");
    window.history.replaceState(
      null,
      "",
      "/orders?type=errand&view=captain&q=缓存",
    );
    await render("manual-refresh", { ...captainFilters, query: "缓存" });
    expect(container.querySelector(`input[aria-label="搜索店铺或商品"]`)).toBe(
      input,
    );
    expect(input.value).toBe("缓存");
    expect(container.textContent).toContain(task.storeName);
  });
});
