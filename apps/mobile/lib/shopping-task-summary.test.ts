import { describe, expect, it } from "vitest";

import type { ShoppingTaskItem } from "@sast-shop/api";

import { getShoppingProductTotalCents } from "./shopping-task-summary";

const item: ShoppingTaskItem = {
  id: "1",
  productTitle: "苹果",
  productDescription: "",
  productImageUrl: "",
  productBarcode: "",
  requiredQuantity: 2,
  purchasedQuantity: 2,
  nonPurchaseReason: null,
  actualUnitPriceCents: 300,
  updatedAt: null,
  deadline: null,
};

describe("getShoppingProductTotalCents", () => {
  it("returns the total for priced purchased items", () => {
    expect(getShoppingProductTotalCents([item])).toBe(600);
  });

  it("keeps the total pending when a purchased item has no actual price", () => {
    expect(
      getShoppingProductTotalCents([
        item,
        { ...item, id: "2", actualUnitPriceCents: null },
      ]),
    ).toBeNull();
  });

  it("ignores unpurchased and skipped items without a price", () => {
    expect(
      getShoppingProductTotalCents([
        item,
        {
          ...item,
          id: "2",
          purchasedQuantity: null,
          actualUnitPriceCents: null,
        },
        { ...item, id: "3", purchasedQuantity: 0, actualUnitPriceCents: null },
      ]),
    ).toBe(600);
  });
});
