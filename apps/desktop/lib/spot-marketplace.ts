import type { PaymentQrChannel, SpotGoods } from "@sast-shop/api"

export interface SpotProduct {
  id: string
  title: string
  description: string
  imageUrl: string
  barcode: string
  storeId: string
  sellerId: string | null
  sellerName: string
  originalPriceCents: number
  salePriceCents: number
  stock: number | null
  updatedAt: string | null
}

export function mapSpotProducts(goods: SpotGoods[]): SpotProduct[] {
  return goods
    .filter((item) => item.stock !== 0)
    .map((item) => ({
      id: item.id,
      title: item.product.title,
      description: item.product.description,
      imageUrl: item.product.mainImageUrl,
      barcode: item.product.barcode,
      storeId: item.product.storeId,
      sellerId: item.sellerId,
      sellerName: item.sellerName ?? item.sellerId ?? "未知卖家",
      originalPriceCents: item.product.priceCents,
      salePriceCents: item.salePriceCents,
      stock: item.stock,
      updatedAt: item.updatedAt,
    }))
}

export function filterSpotProducts(
  products: SpotProduct[],
  query: string,
): SpotProduct[] {
  const keyword = query.trim().toLocaleLowerCase("zh-CN")
  if (!keyword) return products

  return products.filter((item) =>
    [
      item.title,
      item.description,
      item.sellerName,
      item.sellerId,
      item.barcode,
    ].some((value) => value?.toLocaleLowerCase("zh-CN").includes(keyword)),
  )
}

export function clampPurchaseQuantity(
  value: number,
  stock: number | null,
): number {
  const upperBound = stock === null ? 99 : Math.max(1, stock)
  return Math.min(upperBound, Math.max(1, Math.trunc(value) || 1))
}

export function resolveAvailablePaymentPlatform(
  qrCodes: Partial<Record<PaymentQrChannel, string>>,
  preferred: PaymentQrChannel,
): PaymentQrChannel {
  if (qrCodes[preferred]) return preferred
  return preferred === "wechat" && qrCodes.alipay ? "alipay" : "wechat"
}
