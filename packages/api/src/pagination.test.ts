import { describe, expect, it } from "vitest";

import { FeatureUnavailableError } from "./errors";
import { createPageResult } from "./pagination";

describe("page result", () => {
  it("derives whether another page is available", () => {
    expect(
      createPageResult({
        items: [{ id: "1" }],
        currentPage: 1,
        pageSize: 20,
        totalCount: 21,
        expectedPage: 1,
        feature: "listItems",
      }),
    ).toEqual({
      items: [{ id: "1" }],
      currentPage: 1,
      pageSize: 20,
      totalCount: 21,
      hasMore: true,
    });
  });

  it.each([
    { currentPage: 1, pageSize: 0, totalCount: 1 },
    { currentPage: 1, pageSize: 20, totalCount: -1 },
  ])("rejects invalid response metadata: %o", (metadata) => {
    expect(() =>
      createPageResult({
        items: [],
        ...metadata,
        expectedPage: 1,
        feature: "listItems",
      }),
    ).toThrow(FeatureUnavailableError);
  });

  it("rejects pages that exceed their item or total-count bounds", () => {
    expect(() =>
      createPageResult({
        items: [{ id: "1" }, { id: "2" }],
        currentPage: 1,
        pageSize: 1,
        totalCount: 2,
        expectedPage: 1,
        feature: "listItems",
      }),
    ).toThrow(FeatureUnavailableError);
  });

  it("accepts an empty final page when the collection shrinks", () => {
    expect(
      createPageResult({
        items: [],
        currentPage: 2,
        pageSize: 20,
        totalCount: 1,
        expectedPage: 2,
        feature: "listItems",
      }),
    ).toMatchObject({ items: [], hasMore: false });
  });

  it("accepts an empty page while the backend reports more items", () => {
    expect(
      createPageResult({
        items: [],
        currentPage: 2,
        pageSize: 20,
        totalCount: 41,
        expectedPage: 2,
        feature: "listItems",
      }),
    ).toMatchObject({ items: [], hasMore: true });
  });
});
