import { describe, expect, it } from "vitest";

import {
  getDistributionQuantityAvailable,
  isDistributionItemComplete,
  isDistributionTaskComplete,
} from "./distribution-progress";

const ready = {
  purchasedQuantity: 2,
  actualUnitPriceCents: 300,
  requesters: [
    { quantity: 1, distributedQuantity: 1 },
    { quantity: 2, distributedQuantity: 1 },
  ],
};

describe("distribution progress", () => {
  it("limits a requester's action by stock already assigned to others", () => {
    const item = {
      purchasedQuantity: 3,
      requesters: [
        { errandTaskAssignmentId: "a", quantity: 2, distributedQuantity: 2 },
        { errandTaskAssignmentId: "b", quantity: 2, distributedQuantity: null },
      ],
    };

    expect(getDistributionQuantityAvailable(item, "b")).toBe(1);
    expect(getDistributionQuantityAvailable(item, "missing")).toBe(0);
  });

  it("requires every assignment to be recorded even when the quantity adds up", () => {
    expect(
      isDistributionItemComplete({
        ...ready,
        requesters: [
          { quantity: 2, distributedQuantity: 2 },
          { quantity: 1, distributedQuantity: null },
        ],
      }),
    ).toBe(false);
  });

  it("requires the distributed sum to equal the purchased quantity", () => {
    expect(
      isDistributionItemComplete({
        ...ready,
        requesters: [{ quantity: 3, distributedQuantity: 3 }],
      }),
    ).toBe(false);
  });

  it("requires handled and priced items", () => {
    expect(
      isDistributionItemComplete({ ...ready, purchasedQuantity: null }),
    ).toBe(false);
    expect(
      isDistributionItemComplete({ ...ready, actualUnitPriceCents: null }),
    ).toBe(false);
  });

  it("accepts a fully handled task, including a recorded no-purchase item", () => {
    expect(
      isDistributionTaskComplete([
        ready,
        {
          ...ready,
          purchasedQuantity: 0,
          actualUnitPriceCents: null,
          requesters: [{ quantity: 2, distributedQuantity: 0 }],
        },
      ]),
    ).toBe(true);
    expect(isDistributionTaskComplete([])).toBe(false);
    expect(
      isDistributionItemComplete({
        ...ready,
        purchasedQuantity: 0,
        actualUnitPriceCents: null,
        requesters: [{ quantity: 2, distributedQuantity: null }],
      }),
    ).toBe(false);
  });

  it("rejects an over-allocation even when the total matches the purchase", () => {
    expect(
      isDistributionItemComplete({
        ...ready,
        requesters: [
          { quantity: 1, distributedQuantity: 2 },
          { quantity: 2, distributedQuantity: 0 },
        ],
      }),
    ).toBe(false);
  });

  it("rejects negative offsets even when the total matches", () => {
    expect(
      isDistributionItemComplete({
        ...ready,
        requesters: [
          { quantity: 1, distributedQuantity: -1 },
          { quantity: 3, distributedQuantity: 3 },
        ],
      }),
    ).toBe(false);
  });

  it("rejects fractional distribution quantities", () => {
    expect(
      isDistributionItemComplete({
        ...ready,
        requesters: [
          { quantity: 1, distributedQuantity: 0.5 },
          { quantity: 2, distributedQuantity: 1.5 },
        ],
      }),
    ).toBe(false);
  });
});
