import { describe, expect, it } from "vitest";
import { safeAdminReturnTo } from "./admin-navigation";

describe("admin login return path", () => {
  it("preserves an admin deep link and its filters", () => {
    expect(safeAdminReturnTo("/admin/orders?query=123")).toBe(
      "/admin/orders?query=123",
    );
  });
  it.each([
    "https://evil.invalid/admin",
    "//evil.invalid/admin",
    "/administrator",
    "/shop",
    "/admin\\evil",
    "/admin/../api/auth/session",
  ])("rejects unsafe return path %s", (value) => {
    expect(safeAdminReturnTo(value)).toBe("/admin");
  });
});
