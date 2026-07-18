import { describe, expect, it } from "vitest";

import {
  formatErrandDisplayCount,
  formatErrandDisplayPrice,
} from "./errand-display";

describe("errand display helpers", () => {
  it("caps oversized prices for compact errand UI", () => {
    expect(formatErrandDisplayPrice(0)).toBe("¥0");
    expect(formatErrandDisplayPrice(1200)).toBe("¥12");
    expect(formatErrandDisplayPrice(1234)).toBe("¥12");
    expect(formatErrandDisplayPrice(12345)).toBe("¥123");
    expect(formatErrandDisplayPrice(99900)).toBe("¥999");
    expect(formatErrandDisplayPrice(99901)).toBe("¥999+");
    expect(formatErrandDisplayPrice(12_345_678)).toBe("¥999+");
  });

  it("caps oversized counts for compact errand UI", () => {
    expect(formatErrandDisplayCount(0)).toBe("0");
    expect(formatErrandDisplayCount(12)).toBe("12");
    expect(formatErrandDisplayCount(999)).toBe("999");
    expect(formatErrandDisplayCount(1000)).toBe("999+");
  });
});
