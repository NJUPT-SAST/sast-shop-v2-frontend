import { describe, expect, it } from "vitest";
import type { SpotGoods, SpotGoodsBrief } from "@sast-shop/api";

import {
  clampPurchaseQuantity,
  mapSpotProductBriefs,
  mapSpotProductDetail,
  resolveAvailablePaymentPlatform,
} from "./spot-marketplace";

const goods: SpotGoodsBrief[] = [
  {
    id: "5001",
    product: {
      id: "4001",
      title: "农夫山泉矿泉水",
      description: "550ml 瓶装水",
      priceCents: 200,
      storeId: "3001",
      mainImageUrl: "https://example.test/water.png",
      barcode: "690000000001",
      updatedAt: "2026-07-18T00:00:00Z",
    },
    salePriceCents: 180,
    updatedAt: "2026-07-18T00:00:00Z",
    store: {
      id: "3001",
      name: "SAST 小卖部",
      address: "仙林校区活动室",
      logoUrl: "",
      themeColor: "",
    },
  },
  {
    id: "5002",
    product: {
      id: "4002",
      title: "经典火腿三明治",
      description: "冷藏即食",
      priceCents: 1200,
      storeId: "3001",
      mainImageUrl: "",
      barcode: "690000000002",
      updatedAt: "2026-07-18T00:00:00Z",
    },
    salePriceCents: 990,
    updatedAt: "2026-07-18T00:00:00Z",
    store: {
      id: "3001",
      name: "SAST 小卖部",
      address: "仙林校区活动室",
      logoUrl: "",
      themeColor: "",
    },
  },
  {
    id: "5003",
    product: {
      id: "4003",
      title: "SAST 活动贴纸包",
      description: "10 枚装",
      priceCents: 800,
      storeId: "3002",
      mainImageUrl: "",
      barcode: "690000000003",
      updatedAt: null,
    },
    salePriceCents: 600,
    updatedAt: "2026-07-18T00:00:00Z",
    store: {
      id: "3002",
      name: "南邮校园超市",
      address: "仙林校区南二门",
      logoUrl: "",
      themeColor: "",
    },
  },
];

describe("desktop spot marketplace", () => {
  it("maps brief goods without detail-only stock and seller fields", () => {
    const products = mapSpotProductBriefs(goods);

    expect(products.map((item) => item.id)).toEqual(["5001", "5002", "5003"]);
    expect(products[0]).not.toHaveProperty("stock");
    expect(products[0]).not.toHaveProperty("sellerName");
  });

  it("combines a selected brief with its fetched detail", () => {
    const detail: SpotGoods = {
      id: "5001",
      product: goods[0]!.product,
      salePriceCents: 180,
      stock: 3,
      sellerId: "10001",
      sellerName: "阮小妍",
      sellerAvatarUrl: "https://example.test/avatar.png",
      updatedAt: "2026-07-18T00:00:00Z",
    };

    expect(
      mapSpotProductDetail(mapSpotProductBriefs(goods)[0]!, detail),
    ).toMatchObject({
      storeName: "SAST 小卖部",
      storeAddress: "仙林校区活动室",
      stock: 3,
      sellerName: "阮小妍",
      sellerAvatarUrl: "https://example.test/avatar.png",
    });
  });

  it("clamps quantities to one and available stock", () => {
    expect(clampPurchaseQuantity(0, 3)).toBe(1);
    expect(clampPurchaseQuantity(4, 3)).toBe(3);
    expect(clampPurchaseQuantity(120, 99)).toBe(99);
  });

  it("falls back to a configured payment platform", () => {
    expect(resolveAvailablePaymentPlatform({ alipay: "qr" }, "wechat")).toBe(
      "alipay",
    );
    expect(resolveAvailablePaymentPlatform({}, "wechat")).toBe("wechat");
  });
});
