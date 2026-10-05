// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrandDemandStoreSummary, PageResult } from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { CachedErrandLobby } from "../components/cached-errand-lobby";

const { listErrandDemandStoresPage, refresh } = vi.hoisted(() => ({
  listErrandDemandStoresPage: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@sast-shop/api", () => ({ listErrandDemandStoresPage }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const page: PageResult<ErrandDemandStoreSummary> = {
  items: [
    {
      storeId: "3001",
      storeName: "SAST 小卖部",
      totalOriginUnitPriceCents: 1000,
      totalServiceFeeCents: 100,
      participantAvatars: [],
      updatedAt: null,
    },
  ],
  currentPage: 1,
  pageSize: 20,
  totalCount: 1,
  hasMore: false,
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearResourceCache();
  listErrandDemandStoresPage.mockReset().mockResolvedValue(page);
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
});

async function render(refreshKey = "initial") {
  await act(async () => {
    root.render(
      <CachedErrandLobby
        dataSource="local"
        connectBaseUrl="http://localhost/api/connect"
        refreshKey={refreshKey}
      />,
    );
  });
}

async function clickRetry() {
  const button = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent === "重新加载",
  );
  expect(button).toBeDefined();
  await act(async () => button!.click());
}

describe("cached errand lobby", () => {
  it("reuses loaded demand cards immediately on a return visit", async () => {
    await render();
    expect(container.textContent).toContain("SAST 小卖部");
    await act(async () => root.unmount());
    root = createRoot(container);
    await render("return-visit");
    expect(container.textContent).toContain("SAST 小卖部");
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("keeps cached cards during refresh and after a failed refresh, and retries", async () => {
    await render();
    let rejectRefresh!: (error: Error) => void;
    listErrandDemandStoresPage.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRefresh = reject;
        }),
    );
    await render("manual-refresh");
    expect(container.textContent).toContain("SAST 小卖部");
    await act(async () => rejectRefresh(new Error("offline")));
    expect(container.textContent).toContain("SAST 小卖部");
    expect(container.textContent).toContain("跑腿需求更新失败");
    await clickRetry();
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(3);
    expect(container.textContent).not.toContain("跑腿需求更新失败");
  });

  it("does not cache a first-load failure and retries after route refresh", async () => {
    listErrandDemandStoresPage.mockRejectedValueOnce(new Error("offline"));
    await render();
    expect(container.textContent).toContain("跑腿需求加载失败");
    expect(container.textContent).not.toContain("暂无待接单需求");
    await clickRetry();
    expect(refresh).toHaveBeenCalledTimes(1);
    await render("retry");
    expect(container.textContent).toContain("SAST 小卖部");
    expect(listErrandDemandStoresPage).toHaveBeenCalledTimes(2);
  });
});
