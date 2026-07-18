import { describe, expect, it } from "vitest";

import { buildBuyerErrandOrderDetailHref } from "./buyer-errand-order-route";

describe("buyer errand order route", () => {
  it("builds the buyer errand order detail route", () => {
    expect(buildBuyerErrandOrderDetailHref("9001")).toBe("/orders/errand/9001");
  });
});
