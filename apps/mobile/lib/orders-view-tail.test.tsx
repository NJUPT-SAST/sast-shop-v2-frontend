// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BuyerErrandOrder,
  ErrandTaskBrief,
  PageResult,
  SpotOrder,
} from "@sast-shop/api";
import { OrdersView } from "../components/orders-view";
import type { OrderFilters } from "./order-filters";

const { loadMore, refresh } = vi.hoisted(() => ({
  loadMore: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/orders",
  useRouter: () => ({ refresh }),
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <div aria-label={alt} />,
}));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => <div aria-hidden="true" />,
}));
vi.mock("@workspace/ui/hooks/use-infinite-page", () => ({
  useInfinitePage: ({ initialPage }: { initialPage: PageResult<unknown> }) => ({
    items: initialPage.items,
    loadingMore: false,
    loadMoreError: null,
    hasMore: initialPage.hasMore,
    totalCount: initialPage.totalCount,
    loadMore,
  }),
}));

const filters: OrderFilters = {
  type: "errand",
  view: "captain",
  status: "shopping",
  query: "",
};
const taskStatuses: ErrandTaskBrief["status"][] = [
  "shopping",
  "pending_distributing",
  "distributing",
  "collecting_payment",
  "completed",
  "cancelled",
];
const tasks: ErrandTaskBrief[] = taskStatuses.map((status, index) => ({
  id: String(7001 + index),
  storeId: "3001",
  storeName: `店铺 ${index + 1}`,
  status,
  itemCount: 1,
  items: [],
  updatedAt: "2026-07-18T02:00:00Z",
  createdAt: "2026-07-18T02:00:00Z",
}));

let root: Root;
let container: HTMLDivElement;
let intersections: Array<{
  callback: IntersectionObserverCallback;
  active: boolean;
}>;

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
      disconnect() {}
    },
  );
  intersections = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observation: { callback: IntersectionObserverCallback; active: boolean };
      constructor(callback: IntersectionObserverCallback) {
        this.observation = { callback, active: true };
        intersections.push(this.observation);
      }
      observe() {}
      disconnect() {
        this.observation.active = false;
      }
    },
  );
  window.history.replaceState(
    null,
    "",
    "/orders?type=errand&view=captain&status=shopping",
  );
  loadMore.mockReset();
  refresh.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

function emptyPage<T>(): PageResult<T> {
  return {
    items: [],
    currentPage: 1,
    pageSize: 10,
    totalCount: 0,
    hasMore: false,
  };
}

async function renderOrders(taskPage: PageResult<ErrandTaskBrief>) {
  await act(async () =>
    root.render(
      <OrdersView
        dataSource="mock"
        connectBaseUrl="http://127.0.0.1:6660"
        initialFilters={filters}
        spotBuyerPage={emptyPage<SpotOrder>()}
        spotSellerPage={emptyPage<SpotOrder>()}
        buyerErrandPage={emptyPage<BuyerErrandOrder>()}
        errandTaskPage={taskPage}
        errors={{
          spotBuyer: false,
          spotSeller: false,
          errandParticipant: false,
          errandCaptain: false,
        }}
      />,
    ),
  );
}

describe("orders view tail status", () => {
  it("counts only cards visible under the selected status", async () => {
    await renderOrders({
      items: tasks,
      currentPage: 1,
      pageSize: 10,
      totalCount: 6,
      hasMore: false,
    });

    expect(
      container.querySelectorAll('[aria-label="订单列表"] > *'),
    ).toHaveLength(1);
    expect(container.textContent).toContain("店铺 1");
    expect(container.textContent).toContain("已经到底，共 1 笔订单");
    expect(container.textContent).not.toContain("已经到底，共 6 笔订单");
  });

  it("shows the empty state without an end message when no loaded order matches", async () => {
    await renderOrders({
      items: tasks.slice(1),
      currentPage: 1,
      pageSize: 10,
      totalCount: 5,
      hasMore: false,
    });

    expect(container.textContent).toContain("暂无团长任务");
    expect(container.textContent).not.toContain("已经到底");
  });

  it("keeps the load-more sentinel active while later pages remain", async () => {
    await renderOrders({
      items: tasks.slice(1),
      currentPage: 1,
      pageSize: 5,
      totalCount: 6,
      hasMore: true,
    });

    expect(container.textContent).not.toContain("已经到底");
    const activeObservers = intersections.filter((entry) => entry.active);
    expect(activeObservers).toHaveLength(1);
    await act(async () =>
      activeObservers[0]!.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      ),
    );
    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});
