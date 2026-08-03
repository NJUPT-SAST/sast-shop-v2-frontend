import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ServiceOptions } from "@sast-shop/api";
import {
  loadShopSpotGoodsPage,
  mobileShopSpotGoodsPageSize,
  type ShopSpotGoodsLoader,
} from "./shop-page-data";

const serviceOptions: ServiceOptions = {
  dataSource: "local",
  connectBaseUrl: "http://127.0.0.1:6660",
};

describe("mobile shop page data", () => {
  it("loads the first ListSpotGoods page for the shop route", async () => {
    const requestListSpotGoods = vi.fn<ShopSpotGoodsLoader>(
      async (options) => ({
        goods: [],
        currentPage: options.page,
        totalCount: 0,
        pageSize: options.pageSize,
      }),
    );

    const result = await loadShopSpotGoodsPage(
      serviceOptions,
      requestListSpotGoods,
    );

    expect(requestListSpotGoods).toHaveBeenCalledOnce();
    expect(requestListSpotGoods).toHaveBeenCalledWith({
      ...serviceOptions,
      page: 1,
      pageSize: mobileShopSpotGoodsPageSize,
    });
    expect(result.error).toBeNull();
    expect(result.page).toMatchObject({
      currentPage: 1,
      pageSize: mobileShopSpotGoodsPageSize,
    });
  });

  it("returns an empty fallback page when ListSpotGoods fails", async () => {
    const requestListSpotGoods = vi.fn<ShopSpotGoodsLoader>(async () => {
      throw new Error("backend unavailable");
    });

    const result = await loadShopSpotGoodsPage(
      serviceOptions,
      requestListSpotGoods,
    );

    expect(result.error).toBeTruthy();
    expect(result.page).toEqual({
      goods: [],
      currentPage: 0,
      totalCount: 0,
      pageSize: mobileShopSpotGoodsPageSize,
    });
  });

  it("keeps /shop dynamically rendered so goods are requested at runtime", () => {
    const pageSource = readFileSync(
      resolve(import.meta.dirname, "../app/shop/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('export const dynamic = "force-dynamic";');
    expect(pageSource).toContain("loadShopSpotGoodsPage");
  });
});
