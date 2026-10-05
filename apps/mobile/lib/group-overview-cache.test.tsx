// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { GroupOverviewClient } from "../components/group-overview-client";

const { listStores, listErrandTasks } = vi.hoisted(() => ({
  listStores: vi.fn(),
  listErrandTasks: vi.fn(),
}));
vi.mock("@sast-shop/api", () => ({ listStores, listErrandTasks }));
vi.mock("../components/store-create-dialog", () => ({
  StoreCreateDialog: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: () => null,
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearResourceCache();
  listStores
    .mockReset()
    .mockResolvedValue([
      { id: "3001", name: "已加载的店铺", logoUrl: "", address: "" },
    ]);
  listErrandTasks
    .mockReset()
    .mockImplementation(async ({ status }) =>
      status === "shopping"
        ? [
            {
              id: "4001",
              storeName: "已加载的采购任务",
              status: "shopping",
              itemCount: 2,
              createdAt: "2026-10-05T08:00:00Z",
            },
          ]
        : [],
    );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(refreshKey: string) {
  await act(async () =>
    root.render(
      <GroupOverviewClient
        dataSource="mock"
        connectBaseUrl="http://localhost/api/connect"
        refreshKey={refreshKey}
      />,
    ),
  );
}

describe("group cached overview", () => {
  it("preserves successful store and task cards when a background update fails", async () => {
    await render("visit-1");
    listStores.mockRejectedValue(new Error("店铺离线"));
    listErrandTasks.mockRejectedValue(new Error("任务离线"));
    await render("refresh-1");
    expect(container.textContent).toContain("已加载的店铺");
    expect(container.textContent).toContain("已加载的采购任务");
    expect(container.textContent).toContain("店铺更新失败");
    expect(container.textContent).toContain("采购任务更新失败");
    expect(container.textContent).not.toContain("暂无店铺");
  });

  it("keeps the successful section usable and retries the failed section locally", async () => {
    listStores.mockRejectedValueOnce(new Error("店铺离线"));
    await render("visit-1");
    expect(container.textContent).toContain("店铺");
    expect(container.textContent).toContain("已加载的采购任务");
    const retry = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "重新加载",
    );
    expect(retry).toBeDefined();
    await act(async () => retry!.click());
    expect(container.textContent).toContain("已加载的店铺");
    expect(listStores).toHaveBeenCalledTimes(2);
    expect(listErrandTasks).toHaveBeenCalledTimes(4);
  });
});
