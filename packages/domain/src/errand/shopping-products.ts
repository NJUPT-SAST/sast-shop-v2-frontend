export type ShoppingProductTaskItem = {
  id: string;
  productTemplateId: string;
  productTitle: string;
  productDescription: string;
  productImageUrl: string;
  productBarcode: string;
  requiredQuantity: number;
  purchasedQuantity: number | null;
  nonPurchaseReason: string | null;
  actualUnitPriceCents: number | null;
  updatedAt: string | null;
  deadline: string | null;
};

export type ShoppingProductTaskGroup<
  TItem extends ShoppingProductTaskItem = ShoppingProductTaskItem,
> = {
  id: string;
  productTemplateId: string;
  productTitle: string;
  productDescription: string;
  productImageUrl: string;
  productBarcode: string;
  requiredQuantity: number;
  purchasedQuantity: number | null;
  nonPurchaseReason: string | null;
  actualUnitPriceCents: number | null;
  productAmountCents: number;
  earliestDeadline: string | null;
  latestDeadline: string | null;
  deadlineCount: number;
  items: TItem[];
};

export type ShoppingProductPurchaseAllocation<
  TItem extends ShoppingProductTaskItem = ShoppingProductTaskItem,
> = {
  item: TItem;
  purchasedQuantity: number;
};

export function groupShoppingTaskItems<TItem extends ShoppingProductTaskItem>(
  items: readonly TItem[],
): ShoppingProductTaskGroup<TItem>[] {
  const groups: ShoppingProductTaskGroup<TItem>[] = [];
  const groupByKey = new Map<string, ShoppingProductTaskGroup<TItem>>();

  for (const item of items) {
    const key = getShoppingProductKey(item);
    let group = groupByKey.get(key);
    if (!group) {
      group = createShoppingProductGroup(key, item);
      groupByKey.set(key, group);
      groups.push(group);
    }

    group.items.push(item);
    recalculateShoppingProductGroup(group);
  }

  return groups;
}

export function allocateShoppingProductPurchase<
  TItem extends ShoppingProductTaskItem,
>(
  group: ShoppingProductTaskGroup<TItem>,
  purchasedQuantity: number,
): ShoppingProductPurchaseAllocation<TItem>[] {
  if (!Number.isInteger(purchasedQuantity)) {
    throw new RangeError("Purchased quantity must be an integer");
  }

  if (purchasedQuantity === -1) {
    return group.items.map((item) => ({ item, purchasedQuantity }));
  }

  if (purchasedQuantity < 0 || purchasedQuantity > group.requiredQuantity) {
    throw new RangeError("Purchased quantity is outside the product demand");
  }

  let remaining = purchasedQuantity;
  return group.items.map((item) => {
    const allocated = Math.min(item.requiredQuantity, remaining);
    remaining -= allocated;
    return { item, purchasedQuantity: allocated };
  });
}

function createShoppingProductGroup<TItem extends ShoppingProductTaskItem>(
  key: string,
  item: TItem,
): ShoppingProductTaskGroup<TItem> {
  return {
    id: key,
    productTemplateId: item.productTemplateId,
    productTitle: item.productTitle,
    productDescription: item.productDescription,
    productImageUrl: item.productImageUrl,
    productBarcode: item.productBarcode,
    requiredQuantity: 0,
    purchasedQuantity: null,
    nonPurchaseReason: null,
    actualUnitPriceCents: null,
    productAmountCents: 0,
    earliestDeadline: null,
    latestDeadline: null,
    deadlineCount: 0,
    items: [],
  };
}

function recalculateShoppingProductGroup<TItem extends ShoppingProductTaskItem>(
  group: ShoppingProductTaskGroup<TItem>,
) {
  group.requiredQuantity = group.items.reduce(
    (total, item) => total + item.requiredQuantity,
    0,
  );

  const allHandled = group.items.every(
    (item) => item.purchasedQuantity !== null,
  );
  group.purchasedQuantity = allHandled
    ? group.items.reduce(
        (total, item) => total + (item.purchasedQuantity ?? 0),
        0,
      )
    : null;

  group.nonPurchaseReason =
    group.purchasedQuantity === 0
      ? formatNonPurchaseReason(group.items)
      : null;

  group.actualUnitPriceCents = getSharedActualUnitPrice(group.items);
  group.productAmountCents = group.items.reduce((total, item) => {
    if (item.purchasedQuantity === null || item.purchasedQuantity === 0) {
      return total;
    }
    return total + (item.actualUnitPriceCents ?? 0) * item.purchasedQuantity;
  }, 0);

  const deadlines = uniqueSortedDeadlines(group.items);
  group.deadlineCount = deadlines.length;
  group.earliestDeadline = deadlines[0] ?? null;
  group.latestDeadline = deadlines[deadlines.length - 1] ?? null;
}

function getShoppingProductKey(item: ShoppingProductTaskItem): string {
  if (item.productTemplateId) return `template:${item.productTemplateId}`;
  if (item.productBarcode) return `barcode:${item.productBarcode}`;
  return JSON.stringify([
    "snapshot",
    item.productTitle,
    item.productDescription,
    item.productImageUrl,
  ]);
}

function getSharedActualUnitPrice(
  items: readonly ShoppingProductTaskItem[],
): number | null {
  const prices = new Set(
    items
      .map((item) => item.actualUnitPriceCents)
      .filter((price): price is number => price !== null),
  );
  return prices.size === 1 ? [...prices][0]! : null;
}

function formatNonPurchaseReason(
  items: readonly ShoppingProductTaskItem[],
): string | null {
  const reasons = [
    ...new Set(
      items
        .map((item) => item.nonPurchaseReason?.trim() ?? "")
        .filter(Boolean),
    ),
  ];
  return reasons.length ? reasons.join(" / ") : null;
}

function uniqueSortedDeadlines(
  items: readonly ShoppingProductTaskItem[],
): string[] {
  return [
    ...new Set(
      items
        .map((item) => item.deadline)
        .filter((deadline): deadline is string => Boolean(deadline)),
    ),
  ].sort(compareDeadline);
}

function compareDeadline(a: string, b: string): number {
  const parsedA = Date.parse(a);
  const parsedB = Date.parse(b);
  if (Number.isNaN(parsedA) || Number.isNaN(parsedB)) {
    return a.localeCompare(b);
  }
  return parsedA - parsedB;
}
