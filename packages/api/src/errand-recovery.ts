import type {
  CollectingPaymentBill,
  DistributingRequester,
  DistributingTaskItem,
  ShoppingTaskItem,
} from "./services/errand-tasks";

const UTC_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/;

export function compareUpdatedAt(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  if (left === right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  const leftParts = UTC_TIMESTAMP.exec(left);
  const rightParts = UTC_TIMESTAMP.exec(right);
  if (leftParts && rightParts) {
    if (leftParts[1]! < rightParts[1]!) return -1;
    if (leftParts[1]! > rightParts[1]!) return 1;
    const leftFraction = (leftParts[2] ?? "").padEnd(9, "0");
    const rightFraction = (rightParts[2] ?? "").padEnd(9, "0");
    if (leftFraction < rightFraction) return -1;
    if (leftFraction > rightFraction) return 1;
    return 0;
  }

  if (!leftParts) return -1;
  if (!rightParts) return 1;
  return 0;
}

export function latestUpdatedAt(
  current: string | null,
  incoming: string | null,
): string | null {
  return compareUpdatedAt(incoming, current) > 0 ? incoming : current;
}

function mergeVersioned<T>(
  current: T[],
  incoming: T[],
  getId: (item: T) => string,
  getVersion: (item: T) => string | null,
  allowRemovals = false,
  mergeCurrent: (currentItem: T, incomingItem: T) => T = (currentItem) =>
    currentItem,
): T[] {
  const currentById = new Map(current.map((item) => [getId(item), item]));
  const incomingIds = new Set(incoming.map(getId));
  return [
    ...incoming.map((item) => {
      const prior = currentById.get(getId(item));
      if (!prior) return item;
      return compareUpdatedAt(getVersion(item), getVersion(prior)) > 0
        ? item
        : mergeCurrent(prior, item);
    }),
    ...(allowRemovals
      ? []
      : current.filter((item) => !incomingIds.has(getId(item)))),
  ];
}

export function mergeShoppingTaskItems(
  current: ShoppingTaskItem[],
  incoming: ShoppingTaskItem[],
  allowRemovals = false,
): ShoppingTaskItem[] {
  return mergeVersioned(
    current,
    incoming,
    (item) => item.id,
    (item) => item.updatedAt,
    allowRemovals,
  );
}

function mergeDistributingRequesters(
  current: DistributingRequester[],
  incoming: DistributingRequester[],
): DistributingRequester[] {
  return mergeVersioned(
    current,
    incoming,
    (requester) => requester.errandTaskAssignmentId,
    (requester) => requester.assignmentUpdatedAt,
    false,
  );
}

export function mergeDistributingTaskItems(
  current: DistributingTaskItem[],
  incoming: DistributingTaskItem[],
  allowRemovals = false,
): DistributingTaskItem[] {
  const currentById = new Map(
    current.map((item) => [item.errandTaskItemId, item]),
  );
  const incomingById = new Map(
    incoming.map((item) => [item.errandTaskItemId, item]),
  );
  return mergeVersioned(
    current,
    incoming,
    (item) => item.errandTaskItemId,
    (item) => item.itemUpdatedAt,
    allowRemovals,
  ).map((item) => {
    const previous = currentById.get(item.errandTaskItemId);
    const received = incomingById.get(item.errandTaskItemId);
    return previous && received
      ? {
          ...item,
          requesters: mergeDistributingRequesters(
            previous.requesters,
            received.requesters,
          ),
        }
      : item;
  });
}

export function mergeCollectingPaymentBills(
  current: CollectingPaymentBill[],
  incoming: CollectingPaymentBill[],
): CollectingPaymentBill[] {
  return mergeVersioned(
    current,
    incoming,
    (bill) => bill.billId ?? bill.requesterId,
    (bill) => bill.billUpdatedAt,
    false,
  );
}
