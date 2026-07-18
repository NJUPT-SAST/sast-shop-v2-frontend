import { describe, expect, it } from "vitest";
import type { ProductTemplateMatch } from "@sast-shop/api";

import {
  canPublishProductTemplate,
  getBarcodeLookupIntent,
  resolveProductTemplateMatches,
  shouldApplyBarcodeResult,
} from "./product-template-flow";

describe("desktop product template flow", () => {
  it("validates a manually entered barcode before lookup", () => {
    expect(getBarcodeLookupIntent(" ")).toEqual({ kind: "idle" });
    expect(getBarcodeLookupIntent("12A")).toEqual({
      kind: "invalid",
      message: "商品条码只能包含数字",
    });
    expect(getBarcodeLookupIntent(" 690000000001 ")).toEqual({
      kind: "lookup",
      barcode: "690000000001",
    });
  });

  it("selects one match and asks for a choice when several match", () => {
    const first = { productTemplate: { id: "1" } } as never;
    const second = { productTemplate: { id: "2" } } as never;

    expect(resolveProductTemplateMatches([])).toEqual({ kind: "empty" });
    expect(resolveProductTemplateMatches([first])).toEqual({
      kind: "selected",
      match: first,
    });
    expect(resolveProductTemplateMatches([first, second])).toEqual({
      kind: "choose",
      matches: [first, second],
    });
  });

  it("ignores a stale lookup response", () => {
    expect(shouldApplyBarcodeResult("123", "123")).toBe(true);
    expect(shouldApplyBarcodeResult("123", "456")).toBe(false);
  });

  it("does not publish a template without its store information", () => {
    const complete = {
      productTemplate: {
        id: "4001",
        title: "矿泉水",
        description: "550ml",
        priceCents: 200,
        storeId: "3001",
        mainImageUrl: "",
        barcode: "690000000001",
        updatedAt: "2026-07-18T03:00:00Z",
      },
      store: {
        id: "3001",
        name: "SAST 小卖部",
        address: "仙林校区",
        logoUrl: "",
        themeColor: "",
      },
    } satisfies ProductTemplateMatch;

    expect(canPublishProductTemplate(complete)).toBe(true);
    expect(canPublishProductTemplate({ ...complete, store: null })).toBe(false);
  });
});
