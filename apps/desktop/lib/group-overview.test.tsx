import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
vi.mock("../lib/server-service-options", () => ({
  getServerServiceOptions: async () => ({ dataSource: "mock" }),
}));

describe("desktop group overview", () => {
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());

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

    const html = renderToStaticMarkup(await GroupPage());

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
