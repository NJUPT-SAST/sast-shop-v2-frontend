import { describe, expect, it } from "vitest"

import { sanitizeDesktopReturnTo } from "./navigation"

describe("sanitizeDesktopReturnTo", () => {
  it("allows the known desktop routes with query strings", () => {
    expect(sanitizeDesktopReturnTo("/orders?view=buyer")).toBe(
      "/orders?view=buyer",
    )
    expect(sanitizeDesktopReturnTo("/shop#goods")).toBe("/shop#goods")
  })

  it.each([
    undefined,
    "https://example.com",
    "//example.com",
    "/\\\\example.com",
    "/profile",
  ])("falls back for an unsafe return target: %s", (value) => {
    expect(sanitizeDesktopReturnTo(value)).toBe("/orders")
  })
})
