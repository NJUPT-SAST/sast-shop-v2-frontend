import type { ProductTemplateMatch } from "@sast-shop/api";

const maxBarcodeLength = 64;

export type BarcodeLookupIntent =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "lookup"; barcode: string };

export type ProductTemplateMatchResolution =
  | { kind: "empty" }
  | { kind: "selected"; match: ProductTemplateMatch }
  | { kind: "choose"; matches: ProductTemplateMatch[] };

export function getBarcodeLookupIntent(value: string): BarcodeLookupIntent {
  const barcode = value.trim();
  if (!barcode) return { kind: "idle" };
  if (!/^\d+$/.test(barcode)) {
    return { kind: "invalid", message: "商品条码只能包含数字" };
  }
  if (barcode.length > maxBarcodeLength) {
    return {
      kind: "invalid",
      message: `商品条码不能超过 ${maxBarcodeLength} 位`,
    };
  }
  return { kind: "lookup", barcode };
}

export function resolveProductTemplateMatches(
  matches: ProductTemplateMatch[],
): ProductTemplateMatchResolution {
  if (matches.length === 0) return { kind: "empty" };
  if (matches.length === 1) return { kind: "selected", match: matches[0] };
  return { kind: "choose", matches };
}

export function shouldApplyBarcodeResult(
  requestedBarcode: string,
  currentBarcode: string,
): boolean {
  return requestedBarcode === currentBarcode.trim();
}

export function canPublishProductTemplate(
  match: ProductTemplateMatch | null,
): boolean {
  return Boolean(match?.store && match.productTemplate.updatedAt);
}
