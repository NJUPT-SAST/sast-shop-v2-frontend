// @vitest-environment jsdom

import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrandTaskBrief, ErrandTaskParticipants } from "@sast-shop/api";
import { clearResourceCache } from "@workspace/ui/lib/resource-cache";
import { ErrandTaskCard } from "../components/errand-task-card";

const { getErrandTaskParticipants } = vi.hoisted(() => ({
  getErrandTaskParticipants: vi.fn(),
}));
vi.mock("@sast-shop/api", () => ({ getErrandTaskParticipants }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("../components/managed-image", () => ({
  ManagedImage: ({ alt }: { alt: string }) => <span aria-label={alt} />,
}));

const task: ErrandTaskBrief = {
  id: "7001",
  storeId: "3001",
  storeName: "校园超市",
  status: "shopping",
  itemCount: 2,
  updatedAt: null,
  createdAt: null,
  items: [
    {
      id: "1",
      updatedAt: null,
      productTitle: "可乐",
      productImageUrl: "/cola.png",
      requiredQuantity: 5,
      purchasedQuantity: 2,
    },
    {
      id: "2",
      updatedAt: null,
      productTitle: "纸巾",
      productImageUrl: "/tissue.png",
      requiredQuantity: 7,
      purchasedQuantity: 3,
    },
  ],
};
const options = {
  dataSource: "mock" as const,
  connectBaseUrl: "http://localhost/api/connect",
};
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  clearResourceCache();
  getErrandTaskParticipants.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function render(current = task) {
  await act(async () =>
    root.render(<ErrandTaskCard task={current} options={options} />),
  );
}

describe("errand task card", () => {
  it("shows the purchase start time instead of the latest update time", async () => {
    getErrandTaskParticipants.mockResolvedValue({
      participantCount: 0,
      participantAvatars: [],
    });
    await render({
      ...task,
      createdAt: "2026-10-07T03:18:00Z",
      updatedAt: "2026-10-07T05:00:00Z",
    });
    expect(container.textContent).toContain("开始时间 10/07 11:18");
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-10-07T03:18:00Z",
    );
    expect(container.textContent).not.toContain("13:00");
  });

  it("shows progress and products immediately, then replaces the avatar skeleton independently", async () => {
    let resolve!: (value: ErrandTaskParticipants) => void;
    getErrandTaskParticipants.mockReturnValue(
      new Promise<ErrandTaskParticipants>((done) => {
        resolve = done;
      }),
    );
    await render();
    expect(container.textContent).toContain("已采购 5/12 件");
    expect(container.textContent).toContain("校园超市");
    expect(container.querySelector('[aria-label="可乐"]')).not.toBeNull();
    expect(
      container.querySelector('[aria-label="正在加载拼单人"]'),
    ).not.toBeNull();
    await act(async () =>
      resolve({
        participantCount: 6,
        participantAvatars: ["/a.png", "", "/c.png"],
      }),
    );
    expect(container.querySelector('[aria-label="正在加载拼单人"]')).toBeNull();
    expect(container.querySelector('[aria-label="6 人拼单"]')).not.toBeNull();
    expect(container.textContent).toContain("+3");
    expect(container.querySelectorAll('[data-slot="avatar"]')).toHaveLength(3);
    expect(getErrandTaskParticipants).toHaveBeenCalledOnce();
    expect(getErrandTaskParticipants).toHaveBeenCalledWith("7001", options);
  });

  it("keeps the card usable after avatar failure and retries only avatars", async () => {
    getErrandTaskParticipants
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ participantCount: 1, participantAvatars: [""] });
    await render();
    expect(container.textContent).toContain("已采购 5/12 件");
    expect(
      container.querySelector('a[href="/group/purchase/7001"]'),
    ).not.toBeNull();
    const retry = container.querySelector("button")!;
    expect(retry.textContent).toBe("重试头像");
    expect(retry.closest("a")).toBeNull();
    await act(async () => retry.click());
    expect(container.querySelector('[aria-label="1 人拼单"]')).not.toBeNull();
    expect(getErrandTaskParticipants).toHaveBeenCalledTimes(2);
  });

  it("does not count unprocessed and unavailable items as purchased", async () => {
    getErrandTaskParticipants.mockResolvedValue({
      participantCount: 0,
      participantAvatars: [],
    });
    await render({
      ...task,
      items: task.items.map((item, index) => ({
        ...item,
        purchasedQuantity: index === 0 ? null : 0,
      })),
    });
    expect(container.textContent).toContain("已采购 0/12 件");
    expect(container.querySelector('[aria-label="正在加载拼单人"]')).toBeNull();
  });

  it("does not apply a late avatar response to another task", async () => {
    let resolve!: (value: ErrandTaskParticipants) => void;
    getErrandTaskParticipants
      .mockReturnValueOnce(
        new Promise<ErrandTaskParticipants>((done) => {
          resolve = done;
        }),
      )
      .mockResolvedValueOnce({ participantCount: 1, participantAvatars: [] });
    await render();
    await render({ ...task, id: "7002" });
    await act(async () =>
      resolve({ participantCount: 6, participantAvatars: [] }),
    );
    expect(container.querySelector('[aria-label="1 人拼单"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="6 人拼单"]')).toBeNull();
  });

  it("reuses fresh avatar data after remount and keeps old avatars during stale refresh", async () => {
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    getErrandTaskParticipants.mockResolvedValueOnce({
      participantCount: 6,
      participantAvatars: [],
    });
    await render();
    await act(async () => root.render(null));
    await render();
    expect(getErrandTaskParticipants).toHaveBeenCalledOnce();
    expect(container.querySelector('[aria-label="正在加载拼单人"]')).toBeNull();

    await act(async () => root.render(null));
    now += 31_000;
    let resolve!: (value: ErrandTaskParticipants) => void;
    getErrandTaskParticipants.mockReturnValueOnce(
      new Promise<ErrandTaskParticipants>((done) => {
        resolve = done;
      }),
    );
    await render();
    expect(getErrandTaskParticipants).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[aria-label="6 人拼单"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="正在加载拼单人"]')).toBeNull();
    await act(async () =>
      resolve({ participantCount: 1, participantAvatars: [] }),
    );
    expect(container.querySelector('[aria-label="1 人拼单"]')).not.toBeNull();
  });

  it("clears participant data when the user session changes", async () => {
    getErrandTaskParticipants
      .mockResolvedValueOnce({ participantCount: 6, participantAvatars: [] })
      .mockResolvedValueOnce({ participantCount: 1, participantAvatars: [] });
    await render();
    expect(container.querySelector('[aria-label="6 人拼单"]')).not.toBeNull();
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changing")),
    );
    expect(container.querySelector('[aria-label="6 人拼单"]')).toBeNull();
    await act(async () =>
      window.dispatchEvent(new Event("sast-shop:session-changed")),
    );
    expect(container.querySelector('[aria-label="1 人拼单"]')).not.toBeNull();
    expect(getErrandTaskParticipants).toHaveBeenCalledTimes(2);
  });
});
