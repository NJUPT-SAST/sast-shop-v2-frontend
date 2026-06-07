import { describe, expect, it } from "vitest";

import { formatPrice } from "./format-price";

describe("formatPrice", () => {
  it("formats cents as yuan with decimals when needed", () => {
    expect(formatPrice(0)).toBe("¥0");
    expect(formatPrice(1)).toBe("¥0.01");
    expect(formatPrice(1234)).toBe("¥12.34");
  });

  it("omits decimals for whole yuan values", () => {
    expect(formatPrice(1200)).toBe("¥12");
  });
});
