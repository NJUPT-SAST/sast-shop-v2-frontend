type DistributionItem = {
  purchasedQuantity: number | null;
  requesters: ReadonlyArray<{ distributedQuantity: number | null }>;
};

type PricedItem = {
  purchasedQuantity: number | null;
  actualUnitPriceCents: number | null;
};

export function isErrandItemFullyDistributed(item: DistributionItem): boolean {
  if (
    item.purchasedQuantity === null ||
    item.requesters.some((requester) => requester.distributedQuantity === null)
  ) {
    return false;
  }
  const totalDistributed = item.requesters.reduce(
    (sum, requester) => sum + (requester.distributedQuantity ?? 0),
    0,
  );
  return totalDistributed === item.purchasedQuantity;
}

export function isErrandItemPriceSaved(
  item: PricedItem,
  draftPriceCents: number | null,
): boolean {
  if (item.purchasedQuantity === null) return false;
  if (item.purchasedQuantity === 0) return true;
  return (
    draftPriceCents !== null && draftPriceCents === item.actualUnitPriceCents
  );
}
