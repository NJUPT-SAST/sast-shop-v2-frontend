import { describe, expect, it } from "vitest"

import { normalizeJsapiSigningUrl } from "./jsapi-config"

describe("normalizeJsapiSigningUrl", () => {
  it("keeps the query and removes the hash", () => {
    expect(
      normalizeJsapiSigningUrl(
        "https://shop.example.com/publish/spot?source=nav#drawer",
        "https://shop.example.com",
      ),
    ).toBe("https://shop.example.com/publish/spot?source=nav")
  })

  it.each([
    ["https://evil.example.com/publish/spot", "https://shop.example.com"],
    ["javascript:alert(1)", "https://shop.example.com"],
    ["https://user:secret@shop.example.com/publish/spot", "https://shop.example.com"],
  ])("rejects an unsafe signing URL", (url, origin) => {
    expect(() => normalizeJsapiSigningUrl(url, origin)).toThrow(
      "JSAPI 签名地址不正确",
    )
  })
})
