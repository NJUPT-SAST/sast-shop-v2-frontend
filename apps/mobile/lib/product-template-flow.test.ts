import { describe, expect, it } from "vitest"
import type { ProductTemplateMatch } from "@sast-shop/api"
import {
  canPublishProductTemplate,
  getBarcodeLookupIntent,
  normalizeBarcodeQuery,
  resolveProductTemplateMatches,
  shouldApplyBarcodeResult,
} from "./product-template-flow"

const match = (id: string, updatedAt = "2026-07-18T03:00:00Z") =>
  ({
    productTemplate: {
      id,
      title: `商品 ${id}`,
      description: "规格",
      priceCents: 100,
      storeId: id,
      mainImageUrl: "",
      barcode: "012345678901",
      updatedAt,
    },
    store: {
      id,
      name: `店铺 ${id}`,
      address: "仙林校区",
      logoUrl: "",
      themeColor: "",
    },
  }) satisfies ProductTemplateMatch

describe("product template flow", () => {
  it.each([
    ["", { kind: "idle" }],
    ["12A", { kind: "invalid", message: "商品条码只能包含数字" }],
    [" 012345 ", { kind: "lookup", barcode: "012345" }],
  ])("derives an automatic lookup intent for %j", (input, expected) => {
    expect(getBarcodeLookupIntent(input)).toEqual(expected)
  })

  it.each([
    [" 012345678901 ", { ok: true, barcode: "012345678901" }],
    ["", { ok: false, message: "请输入商品条码" }],
    ["ABC", { ok: false, message: "商品条码只能包含数字" }],
  ])("normalizes barcode input %j", (input, expected) => {
    expect(normalizeBarcodeQuery(input)).toEqual(expected)
  })

  it("does not depend on cached barcode lengths", () => {
    expect(normalizeBarcodeQuery("12345")).toEqual({
      ok: true,
      barcode: "12345",
    })
  })

  it("rejects barcodes longer than the facade limit", () => {
    expect(normalizeBarcodeQuery("1".repeat(65))).toEqual({
      ok: false,
      message: "商品条码不能超过 64 位",
    })
  })

  it("resolves zero, one, and many matches deterministically", () => {
    expect(resolveProductTemplateMatches([])).toEqual({ kind: "empty" })
    expect(resolveProductTemplateMatches([match("1")])).toEqual({
      kind: "selected",
      match: match("1"),
    })
    expect(resolveProductTemplateMatches([match("1"), match("2")])).toEqual({
      kind: "choose",
      matches: [match("1"), match("2")],
    })
  })

  it("ignores a response for an older barcode", () => {
    expect(shouldApplyBarcodeResult("123", "123")).toBe(true)
    expect(shouldApplyBarcodeResult("123", "456")).toBe(false)
  })

  it("requires a template version before publishing", () => {
    expect(canPublishProductTemplate(match("1"))).toBe(true)
    expect(canPublishProductTemplate(match("1", ""))).toBe(false)
  })
})
