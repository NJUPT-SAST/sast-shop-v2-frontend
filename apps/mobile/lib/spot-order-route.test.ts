import { describe, expect, it } from "vitest";

import {
  buildSpotOrderDetailHref,
  parseSpotOrderView,
} from "./spot-order-route";

describe("spot order detail route", () => {
  it.each([
    ["buyer", "buyer"],
    ["seller", "seller"],
    ["captain", "buyer"],
    [null, "buyer"],
  ] as const)("parses %s as %s", (input, expected) => {
    expect(parseSpotOrderView(input)).toBe(expected);
  });

  it("preserves the presentation view in detail links", () => {
    expect(buildSpotOrderDetailHref("5001", "buyer")).toBe(
      "/orders/spot/5001?view=buyer",
    );
    expect(buildSpotOrderDetailHref("5001", "seller")).toBe(
      "/orders/spot/5001?view=seller",
    );
  });
});
