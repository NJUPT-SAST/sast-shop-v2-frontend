import type { ProductTemplateMatch } from "@sast-shop/api"

const maxBarcodeLength = 64

export type BarcodeQueryResult =
  | { ok: true; barcode: string }
  | { ok: false; message: string }

export type BarcodeLookupIntent =
  | { kind: "idle" }
  | { kind: "invalid"; message: string }
  | { kind: "lookup"; barcode: string }

export type ProductTemplateMatchResolution =
  | { kind: "empty" }
  | { kind: "selected"; match: ProductTemplateMatch }
  | { kind: "choose"; matches: ProductTemplateMatch[] }

export function normalizeBarcodeQuery(value: string): BarcodeQueryResult {
  const barcode = value.trim()

  if (!barcode) {
    return { ok: false, message: "请输入商品条码" }
  }

  if (!/^\d+$/.test(barcode)) {
    return { ok: false, message: "商品条码只能包含数字" }
  }

  if (barcode.length > maxBarcodeLength) {
    return { ok: false, message: `商品条码不能超过 ${maxBarcodeLength} 位` }
  }

  return { ok: true, barcode }
}

export function getBarcodeLookupIntent(value: string): BarcodeLookupIntent {
  if (!value.trim()) return { kind: "idle" }

  const normalized = normalizeBarcodeQuery(value)
  return normalized.ok
    ? { kind: "lookup", barcode: normalized.barcode }
    : { kind: "invalid", message: normalized.message }
}

export function resolveProductTemplateMatches(
  matches: ProductTemplateMatch[]
): ProductTemplateMatchResolution {
  if (matches.length === 0) {
    return { kind: "empty" }
  }

  if (matches.length === 1) {
    return { kind: "selected", match: matches[0] }
  }

  return { kind: "choose", matches }
}

export function shouldApplyBarcodeResult(
  requestedBarcode: string,
  currentBarcode: string
): boolean {
  return requestedBarcode === currentBarcode.trim()
}

export function canPublishProductTemplate(
  match: ProductTemplateMatch | null
): boolean {
  return Boolean(match?.productTemplate.updatedAt)
}
