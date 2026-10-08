import type {
  PaymentQrChannel,
  SpotGoods,
  SpotGoodsBrief,
} from "@sast-shop/api";

export interface SpotProductBrief {
  id: string;
  stock: number;
  title: string;
  description: string;
  imageUrl: string;
  barcode: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  originalPriceCents: number;
  salePriceCents: number;
}

export interface SpotProduct extends SpotProductBrief {
  sellerId: string;
  sellerName: string;
  sellerAvatarUrl: string;
  stock: number;
  updatedAt: string;
}

export function mapSpotProductBriefs(
  goods: SpotGoodsBrief[],
): SpotProductBrief[] {
  return goods.map((item) => ({
    id: item.id,
    stock: item.stock,
    title: item.product.title,
    description: item.product.description,
    imageUrl: item.product.mainImageUrl,
    barcode: item.product.barcode,
    storeId: item.product.storeId,
    storeName: item.store.name,
    storeAddress: item.store.address,
    originalPriceCents: item.product.priceCents,
    salePriceCents: item.salePriceCents,
  }));
}

export function mapSpotProductDetail(
  brief: SpotProductBrief,
  detail: SpotGoods,
): SpotProduct {
  return {
    ...brief,
    title: detail.product.title,
    description: detail.product.description,
    imageUrl: detail.product.mainImageUrl,
    barcode: detail.product.barcode,
    originalPriceCents: detail.product.priceCents,
    salePriceCents: detail.salePriceCents,
    sellerId: detail.sellerId,
    sellerName: detail.sellerName,
    sellerAvatarUrl: detail.sellerAvatarUrl,
    stock: detail.stock,
    updatedAt: detail.updatedAt,
  };
}

export function clampPurchaseQuantity(value: number, stock: number): number {
  const upperBound = Math.max(1, stock);
  return Math.min(upperBound, Math.max(1, Math.trunc(value) || 1));
}

export function resolveAvailablePaymentPlatform(
  qrCodes: Partial<Record<PaymentQrChannel, string>>,
  preferred: PaymentQrChannel,
): PaymentQrChannel {
  if (qrCodes[preferred]) return preferred;
  return preferred === "wechat" && qrCodes.alipay ? "alipay" : "wechat";
}
