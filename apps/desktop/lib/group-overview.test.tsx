// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GroupPage from "../app/group/page";

const { listErrandTasks, listStores } = vi.hoisted(() => ({
  listErrandTasks: vi.fn(),
  listStores: vi.fn(),
}));

vi.mock("@sast-shop/api", () => ({ listErrandTasks, listStores }));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));
vi.mock("../components/store-create-dialog", () => ({
  StoreCreateDialog: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));
vi.mock("../components/brand-illustration", () => ({
  BrandIllustration: () => null,
}));
vi.mock("../lib/app-config", () => ({
  desktopAppConfig: {
    dataSource: "mock",
    connectBaseUrl: "http://localhost/api/connect",
  },
}));

describe("desktop group overview", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    clearResourceCache();
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("shows an active task even when the first unfiltered page contains terminal tasks", async () => {
    listStores.mockResolvedValue([]);
    listErrandTasks.mockImplementation(
      async ({ status }: { status?: string }) =>
        status === "shopping"
          ? [
              {
                id: "7002",
                storeName: "进行中的小卖部",
                status: "shopping",
                itemCount: 2,
                items: [],
                createdAt: "2026-10-05T08:00:00Z",
              },
            ]
          : status
            ? []
            : [
                {
                  id: "7001",
                  storeName: "已结束的店铺",
                  status: "completed",
                  itemCount: 1,
                  createdAt: "2026-10-05T09:00:00Z",
                },
              ],
    );

    await act(async () => root.render(<GroupPage />));
    const html = container.innerHTML;

    expect(
      listErrandTasks.mock.calls.map(([options]) => options.status),
    ).toEqual([
      "shopping",
      "pending_distributing",
      "distributing",
      "collecting_payment",
    ]);
    expect(html).toContain("进行中的小卖部");
    expect(html).not.toContain("已结束的店铺");
  });
});
