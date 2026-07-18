export type ErrandSelectionRequester = {
  errandDemandItemId: string
  quantity: number
  serviceFeePerUnitCents: number
  updatedAt: string | null
}

export type ErrandSelectionGroup = {
  productId: string
  estimatedUnitPriceCents: number
  requesters: ErrandSelectionRequester[]
}

export type ErrandSelectionTotals = {
  selectedRowCount: number
  selectedQuantity: number
  productAmountCents: number
  serviceFeeCents: number
  totalAmountCents: number
}

export function getSelectableRequesterIds(
  groups: ErrandSelectionGroup[],
): string[] {
  return groups.flatMap((group) =>
    group.requesters
      .filter(isSelectableRequester)
      .map((requester) => requester.errandDemandItemId),
  )
}

export function toggleRequesterSelection(
  selectedIds: Set<string>,
  requesterId: string,
): Set<string> {
  const next = new Set(selectedIds)
  if (next.has(requesterId)) next.delete(requesterId)
  else next.add(requesterId)
  return next
}

export function toggleProductSelection(
  selectedIds: Set<string>,
  group: ErrandSelectionGroup,
): Set<string> {
  const selectableIds = group.requesters
    .filter(isSelectableRequester)
    .map((requester) => requester.errandDemandItemId)
  const next = new Set(selectedIds)
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => next.has(id))

  for (const id of selectableIds) {
    if (allSelected) next.delete(id)
    else next.add(id)
  }

  return next
}

export function calculateErrandSelectionTotals(
  groups: ErrandSelectionGroup[],
  selectedIds: Set<string>,
): ErrandSelectionTotals {
  return groups.reduce<ErrandSelectionTotals>(
    (totals, group) =>
      group.requesters.reduce<ErrandSelectionTotals>((next, requester) => {
        if (
          !isSelectableRequester(requester) ||
          !selectedIds.has(requester.errandDemandItemId)
        ) {
          return next
        }

        const productAmountCents =
          group.estimatedUnitPriceCents * requester.quantity
        const serviceFeeCents =
          requester.serviceFeePerUnitCents * requester.quantity

        return {
          selectedRowCount: next.selectedRowCount + 1,
          selectedQuantity: next.selectedQuantity + requester.quantity,
          productAmountCents: next.productAmountCents + productAmountCents,
          serviceFeeCents: next.serviceFeeCents + serviceFeeCents,
          totalAmountCents:
            next.totalAmountCents + productAmountCents + serviceFeeCents,
        }
      }, totals),
    {
      selectedRowCount: 0,
      selectedQuantity: 0,
      productAmountCents: 0,
      serviceFeeCents: 0,
      totalAmountCents: 0,
    },
  )
}

function isSelectableRequester(requester: ErrandSelectionRequester): boolean {
  return Boolean(requester.errandDemandItemId && requester.updatedAt)
}
