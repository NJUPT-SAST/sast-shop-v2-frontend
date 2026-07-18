import { describe, expect, it } from "vitest";
import {
  hasMoreSpotGoods,
  mergeSpotGoodsPages,
  resolveNextSpotGoodsPage,
} from "./spot-goods-pagination";

describe("spot goods pagination", () => {
  it("merges pages by ID while preserving order and refreshing duplicates", () => {
    const firstPage = [
      { id: "5001", price: 200 },
      { id: "5002", price: 600 },
    ];
    const nextPage = [
      { id: "5002", price: 550 },
      { id: "5003", price: 900 },
      { id: "5003", price: 850 },
    ];

    expect(mergeSpotGoodsPages(firstPage, nextPage)).toEqual([
      { id: "5001", price: 200 },
      { id: "5002", price: 550 },
      { id: "5003", price: 850 },
    ]);
  });

  it.each([
    [{ currentPage: 1, pageSize: 20, totalCount: 21 }, true],
    [{ currentPage: 1, pageSize: 20, totalCount: 20 }, false],
    [{ currentPage: 2, pageSize: 20, totalCount: 40 }, false],
    [{ currentPage: 1, pageSize: 20, totalCount: 0 }, false],
  ])("resolves the has-more boundary for %o", (page, expected) => {
    expect(hasMoreSpotGoods(page)).toBe(expected);
  });

  it("blocks a repeated load while the previous request is pending", () => {
    expect(
      resolveNextSpotGoodsPage({
        currentPage: 1,
        pageSize: 20,
        totalCount: 60,
        loading: true,
        loadMoreError: false,
        trigger: "manual",
        query: "",
      }),
    ).toBeNull();
  });

  it("allows a manual retry after a load-more error", () => {
    expect(
      resolveNextSpotGoodsPage({
        currentPage: 1,
        pageSize: 20,
        totalCount: 60,
        loading: false,
        loadMoreError: true,
        trigger: "manual",
        query: "",
      }),
    ).toBe(2);
  });

  it("loads the next page when the viewport sentinel becomes visible", () => {
    expect(
      resolveNextSpotGoodsPage({
        currentPage: 1,
        pageSize: 20,
        totalCount: 60,
        loading: false,
        loadMoreError: false,
        trigger: "viewport",
        query: "",
      }),
    ).toBe(2);
  });

  it.each([
    ["矿泉水", false, 2],
    ["   ", false, null],
    ["矿泉水", true, null],
  ])(
    "resolves search-driven loading for query %j and error=%s",
    (query, loadMoreError, expected) => {
      expect(
        resolveNextSpotGoodsPage({
          currentPage: 1,
          pageSize: 20,
          totalCount: 60,
          loading: false,
          loadMoreError,
          trigger: "search",
          query,
        }),
      ).toBe(expected);
    },
  );

  it("does not load past the final page for either trigger", () => {
    const page = {
      currentPage: 3,
      pageSize: 20,
      totalCount: 60,
      loading: false,
      loadMoreError: false,
      query: "矿泉水",
    } as const;

    expect(resolveNextSpotGoodsPage({ ...page, trigger: "manual" })).toBeNull();
    expect(resolveNextSpotGoodsPage({ ...page, trigger: "search" })).toBeNull();
    expect(
      resolveNextSpotGoodsPage({ ...page, trigger: "viewport" }),
    ).toBeNull();
  });
});
