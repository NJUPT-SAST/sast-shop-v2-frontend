import { describe, expect, it } from "vitest";

import { calculateErrandCartTotal } from "./errand-cart-total";

describe("calculateErrandCartTotal", () => {
  it("adds product prices and per-unit service fees", () => {
    expect(
      calculateErrandCartTotal([
        { quantity: 2, priceCents: 300, serviceFeeDraft: "1.50" },
      ]),
    ).toEqual({
      quantity: 2,
      productCents: 600,
      serviceFeeCents: 300,
      totalCents: 900,
    });
  });

  it("keeps fee and total pending for an invalid draft", () => {
    expect(
      calculateErrandCartTotal([
        { quantity: 1, priceCents: 300, serviceFeeDraft: "invalid" },
      ]),
    ).toEqual({
      quantity: 1,
      productCents: 300,
      serviceFeeCents: null,
      totalCents: null,
    });
  });
});
