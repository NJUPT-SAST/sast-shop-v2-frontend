import type { SpotOrderView } from "./order-filters"

export function parseSpotOrderView(value: string | null): SpotOrderView {
  return value === "seller" ? "seller" : "buyer"
}

export function buildSpotOrderDetailHref(
  id: string,
  view: SpotOrderView
): string {
  return `/orders/spot/${id}?view=${view}`
}
