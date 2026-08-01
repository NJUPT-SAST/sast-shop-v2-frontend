import { describe, expect, it } from "vitest";
import type { ErrandTaskBrief } from "@sast-shop/api";

import {
  buildErrandTaskPaymentHref,
  getActiveErrandTasks,
  resolveErrandTaskPage,
  resolveErrandTaskRoute,
} from "./errand-task-route";

const baseTask: ErrandTaskBrief = {
  id: "5001",
  storeId: "3001",
  storeName: "仙林小卖部",
  status: "shopping",
  itemCount: 2,
  items: [],
  updatedAt: "2026-07-18T08:00:00.000Z",
  createdAt: "2026-07-18T08:00:00.000Z",
};

describe("desktop errand task routing", () => {
  it("maps protocol states to the corresponding desktop workflow", () => {
    expect(resolveErrandTaskPage([baseTask], "5001")?.kind).toBe("shopping");
    expect(
      resolveErrandTaskPage(
        [{ ...baseTask, status: "pending_distributing" }],
        "5001",
      ),
    ).toMatchObject({ kind: "distributing", mode: "pending_distributing" });
    expect(
      resolveErrandTaskPage(
        [{ ...baseTask, status: "collecting_payment" }],
        "5001",
      )?.kind,
    ).toBe("payment");
  });

  it("keeps only active tasks and sorts newest first", () => {
    expect(
      getActiveErrandTasks([
        { ...baseTask, id: "old", createdAt: "2026-07-17T08:00:00.000Z" },
        { ...baseTask, id: "done", status: "completed" },
        { ...baseTask, id: "new", createdAt: "2026-07-18T09:00:00.000Z" },
      ]).map((task) => task.id),
    ).toEqual(["new", "old"]);
  });

  it("keeps collecting payment on the dedicated canonical route", () => {
    const state = resolveErrandTaskPage(
      [{ ...baseTask, status: "collecting_payment" }],
      "5001",
    );
    expect(state).not.toBeNull();
    if (!state) return;

    expect(resolveErrandTaskRoute("5001", "main", state)).toEqual({
      kind: "redirect",
      href: "/group/purchase/5001/payment",
    });
    expect(resolveErrandTaskRoute("5001", "payment", state)).toEqual({
      kind: "render",
    });
    expect(buildErrandTaskPaymentHref("5001")).toBe(
      "/group/purchase/5001/payment",
    );
  });

  it.each([
    "shopping",
    "pending_distributing",
    "completed",
    "cancelled",
    "unknown",
  ] as const)("keeps %s tasks off the payment route", (status) => {
    const state = resolveErrandTaskPage([{ ...baseTask, status }], "5001");
    expect(state).not.toBeNull();
    if (!state) return;

    expect(resolveErrandTaskRoute("5001", "main", state)).toEqual({
      kind: "render",
    });
    expect(resolveErrandTaskRoute("5001", "payment", state)).toEqual({
      kind: "redirect",
      href: "/group/purchase/5001",
    });
  });
});
