import { describe, expect, it } from "vitest";
import type { DistributingTaskItem, ShoppingTaskItem } from "@sast-shop/api";
import {
  getDistributionQuantityAvailable,
  isDistributionTaskComplete,
} from "./distribution-progress";
import {
  compareUpdatedAt,
  mergeDistributingTaskItems,
  mergeShoppingTaskItems,
} from "./errand-recovery";

const oldVersion = "2026-10-05T08:00:00.000000001Z";
const newVersion = "2026-10-05T08:00:00.000000002Z";

function distributionItem(): DistributingTaskItem {
  return {
    errandTaskItemId: "item-1",
    title: "矿泉水",
    description: "",
    imageUrl: "",
    originUnitPriceCents: 200,
    actualUnitPriceCents: 200,
    purchasedQuantity: 2,
    itemUpdatedAt: newVersion,
    requesters: [
      {
        purchaserId: "buyer-1",
        purchaserName: "小李",
        purchaserAvatarUrl: "",
        quantity: 1,
        distributedQuantity: 1,
        errandTaskAssignmentId: "assignment-1",
        errandDemandItemId: "demand-1",
        assignmentUpdatedAt: newVersion,
      },
      {
        purchaserId: "buyer-2",
        purchaserName: "小王",
        purchaserAvatarUrl: "",
        quantity: 2,
        distributedQuantity: 1,
        errandTaskAssignmentId: "assignment-2",
        errandDemandItemId: "demand-2",
        assignmentUpdatedAt: newVersion,
      },
    ],
  };
}

function shoppingItem(): ShoppingTaskItem {
  return {
    id: "item-1",
    productTitle: "矿泉水",
    productDescription: "",
    productImageUrl: "",
    productBarcode: "690000000001",
    requiredQuantity: 2,
    purchasedQuantity: 2,
    nonPurchaseReason: null,
    actualUnitPriceCents: null,
    updatedAt: newVersion,
    deadline: null,
  };
}

describe("desktop errand purchase rules", () => {
  it("requires a result for every buyer and an exact distribution total", () => {
    const item = distributionItem();
    expect(isDistributionTaskComplete([item])).toBe(true);
    expect(
      isDistributionTaskComplete([
        {
          ...item,
          requesters: [
            { ...item.requesters[0]!, distributedQuantity: 2 },
            { ...item.requesters[1]!, distributedQuantity: null },
          ],
        },
      ]),
    ).toBe(false);
    expect(
      isDistributionTaskComplete([
        {
          ...item,
          requesters: [
            { ...item.requesters[0]!, distributedQuantity: 1 },
            { ...item.requesters[1]!, distributedQuantity: 2 },
          ],
        },
      ]),
    ).toBe(false);
    expect(
      isDistributionTaskComplete([{ ...item, purchasedQuantity: null }]),
    ).toBe(false);
    expect(
      isDistributionTaskComplete([{ ...item, actualUnitPriceCents: null }]),
    ).toBe(false);
  });

  it("caps each buyer at their demand and the remaining purchased quantity", () => {
    const item = distributionItem();
    expect(getDistributionQuantityAvailable(item, "assignment-1")).toBe(1);
    expect(getDistributionQuantityAvailable(item, "assignment-2")).toBe(1);
  });

  it.each([
    ["over-allocation", 2, 0],
    ["negative offset", -1, 3],
    ["fractional quantities", 0.5, 1.5],
  ])("rejects %s even when totals match", (_case, first, second) => {
    const item = distributionItem();
    expect(
      isDistributionTaskComplete([
        {
          ...item,
          requesters: [
            { ...item.requesters[0]!, distributedQuantity: first },
            { ...item.requesters[1]!, distributedQuantity: second },
          ],
        },
      ]),
    ).toBe(false);
  });

  it("keeps newer item and buyer results when an older server snapshot arrives", () => {
    expect(compareUpdatedAt(newVersion, oldVersion)).toBeGreaterThan(0);
    const item = distributionItem();
    const stale = {
      ...item,
      itemUpdatedAt: oldVersion,
      actualUnitPriceCents: null,
      requesters: item.requesters.map((requester) => ({
        ...requester,
        distributedQuantity: null,
        assignmentUpdatedAt: oldVersion,
      })),
    };
    expect(mergeDistributingTaskItems([item], [stale])[0]).toEqual(item);
    expect(
      mergeShoppingTaskItems(
        [shoppingItem()],
        [{ ...shoppingItem(), updatedAt: oldVersion, purchasedQuantity: null }],
      )[0]?.purchasedQuantity,
    ).toBe(2);
  });
});
