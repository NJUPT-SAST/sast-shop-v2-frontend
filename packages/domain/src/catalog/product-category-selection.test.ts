import { describe, expect, it } from "vitest";

import { getDefaultProductCategoryId } from "./product-category-selection";

describe("getDefaultProductCategoryId", () => {
  it("selects the first child of the first ordered root category", () => {
    expect(
      getDefaultProductCategoryId([
        { id: "20", parentId: null, sortOrder: 2 },
        { id: "21", parentId: "20", sortOrder: 1 },
        { id: "11", parentId: null, sortOrder: 1 },
        { id: "12", parentId: "11", sortOrder: 2 },
        { id: "13", parentId: "11", sortOrder: 1 },
      ]),
    ).toBe("13");
  });

  it("uses a root directly when it has no children", () => {
    expect(
      getDefaultProductCategoryId([
        { id: "20", parentId: null, sortOrder: 2 },
        { id: "11", parentId: null, sortOrder: 1 },
      ]),
    ).toBe("11");
  });

  it("returns null when the store has no categories", () => {
    expect(getDefaultProductCategoryId([])).toBeNull();
  });
});
