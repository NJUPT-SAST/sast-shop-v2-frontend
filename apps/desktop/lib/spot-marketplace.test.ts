import { describe, expect, it } from "vitest"
import type { SpotGoods } from "@sast-shop/api"

import {
  clampPurchaseQuantity,
  filterSpotProducts,
  mapSpotProducts,
  resolveAvailablePaymentPlatform,
} from "./spot-marketplace"

const goods: SpotGoods[] = [
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
    stock: 3,
    sellerId: "10001",
    sellerName: "阮小妍",
    updatedAt: "2026-07-18T00:00:00Z",
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
    stock: 0,
    sellerId: "10002",
    sellerName: "Christopher",
    updatedAt: "2026-07-18T00:00:00Z",
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
    stock: null,
    sellerId: null,
    sellerName: null,
    updatedAt: null,
  },
]

describe("desktop spot marketplace", () => {
  it("maps API goods and excludes known zero stock products", () => {
    expect(mapSpotProducts(goods).map((item) => item.id)).toEqual([
      "5001",
      "5003",
    ])
  })

  it("searches title, description, seller, and barcode case-insensitively", () => {
    const products = mapSpotProducts(goods)

    expect(filterSpotProducts(products, "矿泉水").map((item) => item.id)).toEqual([
      "5001",
    ])
    expect(filterSpotProducts(products, "sast").map((item) => item.id)).toEqual([
      "5003",
    ])
    expect(filterSpotProducts(products, "10001").map((item) => item.id)).toEqual([
      "5001",
    ])
    expect(filterSpotProducts(products, "690000000003").map((item) => item.id)).toEqual([
      "5003",
    ])
  })

  it("clamps quantities to one, stock, and the unbounded safety cap", () => {
    expect(clampPurchaseQuantity(0, 3)).toBe(1)
    expect(clampPurchaseQuantity(4, 3)).toBe(3)
    expect(clampPurchaseQuantity(120, null)).toBe(99)
  })

  it("falls back to a configured payment platform", () => {
    expect(resolveAvailablePaymentPlatform({ alipay: "qr" }, "wechat")).toBe(
      "alipay",
    )
    expect(resolveAvailablePaymentPlatform({}, "wechat")).toBe("wechat")
  })
})
