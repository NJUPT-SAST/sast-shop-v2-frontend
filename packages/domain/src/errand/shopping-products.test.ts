import { describe, expect, it } from "vitest";
import {
  allocateShoppingProductPurchase,
  groupShoppingTaskItems,
  type ShoppingProductTaskItem,
} from "./shopping-products";

function item(
  overrides: Partial<ShoppingProductTaskItem>,
): ShoppingProductTaskItem {
  return {
    id: "item-1",
    productTemplateId: "product-1",
    productTitle: "矿泉水",
    productDescription: "550ml",
    productImageUrl: "https://example.test/water.png",
    productBarcode: "690000000001",
    requiredQuantity: 1,
    purchasedQuantity: null,
    nonPurchaseReason: null,
    actualUnitPriceCents: null,
    updatedAt: null,
    deadline: null,
    ...overrides,
  };
}

describe("shopping product groups", () => {
  it("groups task items by product template and totals actual purchase state", () => {
    const groups = groupShoppingTaskItems([
      item({
        id: "item-1",
        requiredQuantity: 2,
        purchasedQuantity: 2,
        actualUnitPriceCents: 200,
        deadline: "2026-07-18T02:00:00.000Z",
      }),
      item({
        id: "item-2",
        requiredQuantity: 3,
        purchasedQuantity: 1,
        actualUnitPriceCents: 200,
        deadline: "2026-07-19T02:00:00.000Z",
      }),
      item({
        id: "item-3",
        productTemplateId: "product-2",
        productTitle: "三明治",
        productBarcode: "690000000002",
        requiredQuantity: 1,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      productTemplateId: "product-1",
      requiredQuantity: 5,
      purchasedQuantity: 3,
      actualUnitPriceCents: 200,
      productAmountCents: 600,
      earliestDeadline: "2026-07-18T02:00:00.000Z",
      latestDeadline: "2026-07-19T02:00:00.000Z",
      deadlineCount: 2,
    });
    expect(groups[0]?.items.map((taskItem) => taskItem.id)).toEqual([
      "item-1",
      "item-2",
    ]);
    expect(groups[1]).toMatchObject({
      productTemplateId: "product-2",
      requiredQuantity: 1,
      purchasedQuantity: null,
    });
  });

  it("keeps a product group unprocessed until all underlying task items are handled", () => {
    const [group] = groupShoppingTaskItems([
      item({ id: "item-1", requiredQuantity: 2, purchasedQuantity: 2 }),
      item({ id: "item-2", requiredQuantity: 3, purchasedQuantity: null }),
    ]);

    expect(group?.requiredQuantity).toBe(5);
    expect(group?.purchasedQuantity).toBeNull();
  });

  it("allocates a product-level purchased quantity back to task items", () => {
    const [group] = groupShoppingTaskItems([
      item({ id: "item-1", requiredQuantity: 2 }),
      item({ id: "item-2", requiredQuantity: 3 }),
      item({ id: "item-3", requiredQuantity: 4 }),
    ]);

    expect(allocateShoppingProductPurchase(group!, 6)).toEqual([
      { item: group!.items[0], purchasedQuantity: 2 },
      { item: group!.items[1], purchasedQuantity: 3 },
      { item: group!.items[2], purchasedQuantity: 1 },
    ]);
  });

  it("uses -1 for every task item when revoking a product group", () => {
    const [group] = groupShoppingTaskItems([
      item({ id: "item-1", requiredQuantity: 2, purchasedQuantity: 2 }),
      item({ id: "item-2", requiredQuantity: 3, purchasedQuantity: 1 }),
    ]);

    expect(allocateShoppingProductPurchase(group!, -1)).toEqual([
      { item: group!.items[0], purchasedQuantity: -1 },
      { item: group!.items[1], purchasedQuantity: -1 },
    ]);
  });
});
