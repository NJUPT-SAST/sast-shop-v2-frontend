import { describe, expect, it } from "vitest";

import {
  isErrandItemFullyDistributed,
  isErrandItemPriceSaved,
} from "./distribution";

describe("errand distribution completion", () => {
  it.each([
    [2, [2, null], false],
    [2, [2, 0], true],
    [0, [null], false],
    [0, [0], true],
    [null, [0], false],
    [2, [1, 0], false],
    [2, [2, 1], false],
  ] as const)(
    "requires explicit results and the purchased quantity %s for %j",
    (purchasedQuantity, quantities, expected) => {
      expect(
        isErrandItemFullyDistributed({
          purchasedQuantity,
          requesters: quantities.map((distributedQuantity) => ({
            distributedQuantity,
          })),
        }),
      ).toBe(expected);
    },
  );
});

describe("errand price confirmation", () => {
  it("does not require a hidden price for an unpurchased product", () => {
    expect(
      isErrandItemPriceSaved(
        { purchasedQuantity: 0, actualUnitPriceCents: null },
        null,
      ),
    ).toBe(true);
  });

  it.each([
    [2, null, null, false],
    [2, 100, 120, false],
    [2, 100, null, false],
    [2, 100, 100, true],
    [2, 0, 0, true],
    [null, 100, 100, false],
  ] as const)(
    "validates saved prices for purchased quantity %s, price %s and draft %s",
    (purchasedQuantity, actualUnitPriceCents, draftPriceCents, expected) => {
      expect(
        isErrandItemPriceSaved(
          { purchasedQuantity, actualUnitPriceCents },
          draftPriceCents,
        ),
      ).toBe(expected);
    },
  );
});
