import { listSpotGoods, type ListSpotGoodsResult } from "@sast-shop/api";
import type { ServiceOptions } from "@sast-shop/api";

export const desktopShopSpotGoodsPageSize = 24;

export type ShopSpotGoodsLoader = (
  options: ServiceOptions & {
    page: number;
    pageSize: number;
  },
) => Promise<ListSpotGoodsResult>;

export type ShopSpotGoodsPageData = {
  page: ListSpotGoodsResult;
  error: string | null;
};

export async function loadShopSpotGoodsPage(
  options: ServiceOptions,
  requestListSpotGoods: ShopSpotGoodsLoader = listSpotGoods,
): Promise<ShopSpotGoodsPageData> {
  try {
    return {
      page: await requestListSpotGoods({
        ...options,
        page: 1,
        pageSize: desktopShopSpotGoodsPageSize,
      }),
      error: null,
    };
  } catch {
    return {
      page: {
        goods: [],
        currentPage: 0,
        totalCount: 0,
        pageSize: desktopShopSpotGoodsPageSize,
      },
      error:
        "\u73b0\u8d27\u5546\u54c1\u6682\u4e0d\u53ef\u7528\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5",
    };
  }
}
