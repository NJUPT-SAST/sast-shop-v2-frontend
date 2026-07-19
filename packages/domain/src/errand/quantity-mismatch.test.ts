import { describe, expect, it } from "vitest";
import { getQuantityMismatchLabel } from "./quantity-mismatch";

describe("errand quantity mismatch label", () => {
  it.each([
    [2, 2, 2, null],
    [2, 1, 1, "采购数量与需求不一致"],
    [2, 2, 1, "分发数量与采购不一致"],
    [2, 1, 2, "采购数量与需求、分发数量均不一致"],
    [3, 2, 1, "三项数量不一致"],
  ] as const)(
    "labels required=%i purchased=%i distributed=%i",
    (requiredQuantity, purchasedQuantity, distributedQuantity, expected) => {
      expect(
        getQuantityMismatchLabel({
          requiredQuantity,
          purchasedQuantity,
          distributedQuantity,
        }),
      ).toBe(expected);
    },
  );
});
