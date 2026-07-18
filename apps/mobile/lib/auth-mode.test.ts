import { describe, expect, it } from "vitest"

import { resolveServerAuthMode } from "./auth-mode"

describe("resolveServerAuthMode", () => {
  it("requires authentication by default in production", () => {
    expect(resolveServerAuthMode(undefined, "production")).toBe("required")
  })

  it("allows authentication to be disabled only outside production", () => {
    expect(resolveServerAuthMode("off", "development")).toBe("off")
    expect(() => resolveServerAuthMode("off", "production")).toThrow(
      "AUTH_MODE=off is not allowed in production",
    )
  })

  it("rejects unknown modes", () => {
    expect(() => resolveServerAuthMode("optional", "development")).toThrow(
      "AUTH_MODE must be either off or required",
    )
  })
})
