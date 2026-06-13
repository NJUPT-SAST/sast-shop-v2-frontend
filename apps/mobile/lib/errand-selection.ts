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

function isSelectableRequester(requester: ErrandSelectionRequester): boolean {
  return Boolean(requester.errandDemandItemId && requester.updatedAt)
}

export function getSelectableRequesterIds(
  groups: ErrandSelectionGroup[]
): string[] {
  return groups.flatMap((group) =>
    group.requesters
      .filter(isSelectableRequester)
      .map((requester) => requester.errandDemandItemId)
  )
}

export function toggleRequesterSelection(
  selectedIds: Set<string>,
  requesterId: string
): Set<string> {
  const nextSelectedIds = new Set(selectedIds)

  if (nextSelectedIds.has(requesterId)) {
    nextSelectedIds.delete(requesterId)
  } else {
    nextSelectedIds.add(requesterId)
  }

  return nextSelectedIds
}

export function toggleProductSelection(
  selectedIds: Set<string>,
  group: ErrandSelectionGroup
): Set<string> {
  const selectableIds = group.requesters
    .filter(isSelectableRequester)
    .map((requester) => requester.errandDemandItemId)
  const nextSelectedIds = new Set(selectedIds)
  const allSelected = selectableIds.every((id) => nextSelectedIds.has(id))

  selectableIds.forEach((id) => {
    if (allSelected) {
      nextSelectedIds.delete(id)
    } else {
      nextSelectedIds.add(id)
    }
  })

  return nextSelectedIds
}

export function calculateErrandSelectionTotals(
  groups: ErrandSelectionGroup[],
  selectedIds: Set<string>
): ErrandSelectionTotals {
  return groups.reduce<ErrandSelectionTotals>(
    (totals, group) =>
      group.requesters.reduce<ErrandSelectionTotals>((nextTotals, requester) => {
        if (
          !isSelectableRequester(requester) ||
          !selectedIds.has(requester.errandDemandItemId)
        ) {
          return nextTotals
        }

        const productAmountCents =
          group.estimatedUnitPriceCents * requester.quantity
        const serviceFeeCents =
          requester.serviceFeePerUnitCents * requester.quantity

        return {
          selectedRowCount: nextTotals.selectedRowCount + 1,
          selectedQuantity: nextTotals.selectedQuantity + requester.quantity,
          productAmountCents: nextTotals.productAmountCents + productAmountCents,
          serviceFeeCents: nextTotals.serviceFeeCents + serviceFeeCents,
          totalAmountCents:
            nextTotals.totalAmountCents + productAmountCents + serviceFeeCents,
        }
      }, totals),
    {
      selectedRowCount: 0,
      selectedQuantity: 0,
      productAmountCents: 0,
      serviceFeeCents: 0,
      totalAmountCents: 0,
    }
  )
}
