import { describe, expect, it } from "vitest";

import type { ErrandTaskBrief } from "@sast-shop/api";

import {
  buildErrandTaskPaymentHref,
  getActiveErrandTasks,
  resolveErrandTaskPage,
  resolveErrandTaskRoute,
} from "./errand-task-route";

const tasks: ErrandTaskBrief[] = [
  createTask("7001", "shopping"),
  createTask("7002", "pending_distributing"),
  createTask("7003", "distributing"),
  createTask("7004", "collecting_payment"),
  createTask("7005", "completed"),
  createTask("7006", "cancelled"),
  createTask("7007", "unknown"),
];

describe("resolveErrandTaskPage", () => {
  it.each([
    ["7001", { kind: "shopping" }],
    ["7002", { kind: "distributing", mode: "pending_distributing" }],
    ["7003", { kind: "distributing", mode: "distributing" }],
    ["7004", { kind: "payment" }],
    ["7005", { kind: "terminal", status: "completed" }],
    ["7006", { kind: "terminal", status: "cancelled" }],
    ["7007", { kind: "unsupported" }],
  ] as const)("resolves task %s to its page", (taskId, expectedState) => {
    expect(resolveErrandTaskPage(tasks, taskId)).toMatchObject({
      ...expectedState,
      task: { id: taskId },
    });
  });

  it("returns null for invalid or unavailable task ids", () => {
    expect(resolveErrandTaskPage(tasks, "missing")).toBeNull();
    expect(resolveErrandTaskPage(tasks, "9999")).toBeNull();
  });
});

describe("resolveErrandTaskRoute", () => {
  it("uses the independent payment URL as the collecting-payment canonical route", () => {
    const paymentState = resolveErrandTaskPage(tasks, "7004");
    expect(paymentState).not.toBeNull();
    if (!paymentState) return;

    expect(resolveErrandTaskRoute("7004", "main", paymentState)).toEqual({
      kind: "redirect",
      href: "/group/purchase/7004/payment",
    });
    expect(resolveErrandTaskRoute("7004", "payment", paymentState)).toEqual({
      kind: "render",
    });
    expect(buildErrandTaskPaymentHref("7004")).toBe(
      "/group/purchase/7004/payment",
    );
  });

  it.each(["7001", "7002", "7005", "7006", "7007"])(
    "redirects non-payment task %s away from the payment page",
    (taskId) => {
      const state = resolveErrandTaskPage(tasks, taskId);
      expect(state).not.toBeNull();
      if (!state) return;

      expect(resolveErrandTaskRoute(taskId, "main", state)).toEqual({
        kind: "render",
      });
      expect(resolveErrandTaskRoute(taskId, "payment", state)).toEqual({
        kind: "redirect",
        href: `/group/purchase/${taskId}`,
      });
    },
  );
});

describe("getActiveErrandTasks", () => {
  it("keeps actionable tasks and orders the newest task first", () => {
    const originalOrder = tasks.map((task) => task.id);

    expect(getActiveErrandTasks(tasks).map((task) => task.id)).toEqual([
      "7004",
      "7003",
      "7002",
      "7001",
    ]);
    expect(tasks.map((task) => task.id)).toEqual(originalOrder);
  });

  it("places missing and invalid creation times last", () => {
    const withoutDate = { ...createTask("8001", "shopping"), createdAt: null };
    const invalidDate = {
      ...createTask("8002", "shopping"),
      createdAt: "not-a-date",
    };

    expect(
      getActiveErrandTasks([
        withoutDate,
        createTask("8003", "shopping"),
        invalidDate,
      ]).map((task) => task.id),
    ).toEqual(["8003", "8001", "8002"]);
  });
});

function createTask(
  id: string,
  status: ErrandTaskBrief["status"],
): ErrandTaskBrief {
  return {
    id,
    storeId: "3001",
    storeName: "SAST 小卖部",
    status,
    itemCount: 2,
    createdAt: `2026-06-${id.slice(-2)}T09:00:00.000Z`,
  };
}
