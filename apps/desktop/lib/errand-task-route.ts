import type { ErrandTaskBrief, ErrandTaskStatusValue } from "@sast-shop/api";

export type ErrandTaskPageState =
  | { kind: "shopping"; task: ErrandTaskBrief }
  | {
      kind: "distributing";
      mode: "pending_distributing" | "distributing";
      task: ErrandTaskBrief;
    }
  | { kind: "payment"; task: ErrandTaskBrief }
  | {
      kind: "terminal";
      status: "completed" | "cancelled";
      task: ErrandTaskBrief;
    }
  | { kind: "unsupported"; task: ErrandTaskBrief };

export type ErrandTaskRouteDecision =
  { kind: "render" } | { kind: "redirect"; href: string };

const activeStatuses = new Set<ErrandTaskStatusValue>([
  "shopping",
  "pending_distributing",
  "distributing",
  "collecting_payment",
]);

export function resolveErrandTaskPage(
  tasks: ErrandTaskBrief[],
  taskId: string,
): ErrandTaskPageState | null {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return null;
  if (task.status === "shopping") return { kind: "shopping", task };
  if (
    task.status === "pending_distributing" ||
    task.status === "distributing"
  ) {
    return { kind: "distributing", mode: task.status, task };
  }
  if (task.status === "collecting_payment") return { kind: "payment", task };
  if (task.status === "completed" || task.status === "cancelled") {
    return { kind: "terminal", status: task.status, task };
  }
  return { kind: "unsupported", task };
}

export function buildErrandTaskPaymentHref(taskId: string): string {
  return `/group/purchase/${taskId}/payment`;
}

export function resolveErrandTaskRoute(
  taskId: string,
  page: "main" | "payment",
  state: ErrandTaskPageState,
): ErrandTaskRouteDecision {
  if (page === "main" && state.kind === "payment") {
    return { kind: "redirect", href: buildErrandTaskPaymentHref(taskId) };
  }
  if (page === "payment" && state.kind !== "payment") {
    return { kind: "redirect", href: `/group/purchase/${taskId}` };
  }
  return { kind: "render" };
}

export function getActiveErrandTasks(
  tasks: ErrandTaskBrief[],
): ErrandTaskBrief[] {
  return tasks
    .filter((task) => activeStatuses.has(task.status))
    .map((task, index) => ({ task, index }))
    .sort(
      (left, right) =>
        parseCreatedAt(right.task.createdAt) -
          parseCreatedAt(left.task.createdAt) || left.index - right.index,
    )
    .map(({ task }) => task);
}

function parseCreatedAt(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
