import { describe, expect, it } from "vitest";

import { isJsapiAuthConfig, normalizeJsapiSigningUrl } from "./jsapi-config";

describe("normalizeJsapiSigningUrl", () => {
  it("keeps the query and removes the hash", () => {
    expect(
      normalizeJsapiSigningUrl(
        "https://shop.example.com/publish/spot?source=nav#drawer",
        "https://shop.example.com",
      ),
    ).toBe("https://shop.example.com/publish/spot?source=nav");
  });

  it.each([
    ["https://evil.example.com/publish/spot", "https://shop.example.com"],
    ["javascript:alert(1)", "https://shop.example.com"],
    [
      "https://user:secret@shop.example.com/publish/spot",
      "https://shop.example.com",
    ],
  ])("rejects an unsafe signing URL", (url, origin) => {
    expect(() => normalizeJsapiSigningUrl(url, origin)).toThrow(
      "JSAPI 签名地址不正确",
    );
  });
});

describe("isJsapiAuthConfig", () => {
  it("accepts a complete JSAPI config", () => {
    expect(
      isJsapiAuthConfig({
        appId: "cli_test",
        timestamp: "1784320800000",
        nonceStr: "nonce",
        signature: "signature",
      }),
    ).toBe(true);
  });

  it.each([null, {}, { appId: "cli_test" }, { appId: 42 }])(
    "rejects an incomplete JSAPI config",
    (value) => {
      expect(isJsapiAuthConfig(value)).toBe(false);
    },
  );
});
