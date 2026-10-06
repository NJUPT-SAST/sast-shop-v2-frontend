import { describe, expect, it } from "vitest";
import { hasMoreSpotGoods } from "./spot-goods-pagination";

describe("spot goods pagination", () => {
  it.each([
    [{ currentPage: 1, pageSize: 20, totalCount: 21 }, true],
    [{ currentPage: 1, pageSize: 20, totalCount: 20 }, false],
    [{ currentPage: 2, pageSize: 20, totalCount: 40 }, false],
    [{ currentPage: 1, pageSize: 20, totalCount: 0 }, false],
  ])("resolves the has-more boundary for %o", (page, expected) => {
    expect(hasMoreSpotGoods(page)).toBe(expected);
  });
});
