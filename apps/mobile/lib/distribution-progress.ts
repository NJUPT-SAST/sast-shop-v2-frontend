import type { DistributingTaskItem } from "@sast-shop/api";

type DistributionItem = Pick<
  DistributingTaskItem,
  "purchasedQuantity" | "actualUnitPriceCents"
> & {
  requesters: Array<{ distributedQuantity: number | null }>;
};

export function isDistributionItemComplete(item: DistributionItem): boolean {
  if (item.purchasedQuantity === null) return false;
  if (item.purchasedQuantity > 0 && item.actualUnitPriceCents === null) {
    return false;
  }
  if (
    item.requesters.some((requester) => requester.distributedQuantity === null)
  ) {
    return false;
  }

  return (
    item.requesters.reduce(
      (total, requester) => total + (requester.distributedQuantity ?? 0),
      0,
    ) === item.purchasedQuantity
  );
}

export function isDistributionTaskComplete(items: DistributionItem[]): boolean {
  return items.length > 0 && items.every(isDistributionItemComplete);
}

type DistributionAssignment = Pick<
  DistributingTaskItem["requesters"][number],
  "errandTaskAssignmentId" | "quantity" | "distributedQuantity"
>;

export function getDistributionQuantityAvailable(
  item: {
    purchasedQuantity: number | null;
    requesters: DistributionAssignment[];
  },
  assignmentId: string,
): number {
  const requester = item.requesters.find(
    (candidate) => candidate.errandTaskAssignmentId === assignmentId,
  );
  if (!requester || item.purchasedQuantity === null) return 0;

  const assignedToOthers = item.requesters.reduce(
    (total, candidate) =>
      candidate.errandTaskAssignmentId === assignmentId
        ? total
        : total + (candidate.distributedQuantity ?? 0),
    0,
  );
  return Math.max(
    0,
    Math.min(requester.quantity, item.purchasedQuantity - assignedToOthers),
  );
}
