import type { ShoppingTaskItem } from "@sast-shop/api";

export function getShoppingProductTotalCents(
  items: ShoppingTaskItem[],
): number | null {
  let total = 0;

  for (const item of items) {
    if (item.purchasedQuantity === null || item.purchasedQuantity === 0) {
      continue;
    }
    if (item.actualUnitPriceCents === null) return null;
    total += item.actualUnitPriceCents * item.purchasedQuantity;
  }

  return total;
}
