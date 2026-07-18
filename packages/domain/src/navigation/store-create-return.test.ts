import { describe, expect, it } from "vitest";
import { resolveStoreCreateReturnPath } from "./store-create-return";

const origin = "https://shop.example.test";

describe("store create return navigation", () => {
  it("falls back to the created store template page", () => {
    expect(resolveStoreCreateReturnPath(undefined, "3099", origin)).toBe(
      "/group/templates?store=3099",
    );
  });

  it("preserves template intent and injects the created store", () => {
    expect(
      resolveStoreCreateReturnPath(
        "/group/templates?create=1&barcode=690000000001",
        "3099",
        origin,
      ),
    ).toBe("/group/templates?create=1&barcode=690000000001&store=3099");
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "javascript:alert(1)",
  ])("rejects unsafe return path %s", (returnTo) => {
    expect(resolveStoreCreateReturnPath(returnTo, "3099", origin)).toBe(
      "/group/templates?store=3099",
    );
  });

  it("keeps another same-origin route unchanged", () => {
    expect(
      resolveStoreCreateReturnPath("/publish/spot?barcode=123", "3099", origin),
    ).toBe("/publish/spot?barcode=123");
  });
});
