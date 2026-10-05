import { describe, expect, it } from "vitest";
import {
  getFeishuLoginRedirect,
  getFeishuLoginReturnTo,
  resolveFeishuRedirectUri,
} from "./feishu-redirect-uri";

describe("Feishu root authorization entry", () => {
  const origin = "https://shop.example.test";

  it("uses the configured same-origin root and permits local development", () => {
    expect(resolveFeishuRedirectUri(`${origin}/`, origin, true)).toBe(
      `${origin}/`,
    );
    expect(resolveFeishuRedirectUri(undefined, "http://localhost:3001")).toBe(
      "http://localhost:3001/",
    );
  });

  it.each([
    "https://foreign.example.test/",
    `${origin}/shop`,
    `${origin}/?returnTo=/shop`,
    `${origin}/#login`,
    "https://user:password@shop.example.test/",
  ])("rejects an unsafe authorization entry: %s", (uri) => {
    expect(() => resolveFeishuRedirectUri(uri, origin, true)).toThrow();
  });

  it("rejects HTTP in production", () => {
    expect(() =>
      resolveFeishuRedirectUri(
        "http://localhost:3001/",
        "http://localhost:3001",
        true,
      ),
    ).toThrow();
  });

  it("keeps authorization on root and preserves a deep link through login", () => {
    expect(getFeishuLoginRedirect(`${origin}/`, `${origin}/`)).toBeNull();
    const entry = new URL(
      getFeishuLoginRedirect(
        `${origin}/orders/spot/1?view=buyer#bill`,
        `${origin}/`,
      )!,
    );
    expect(entry.pathname).toBe("/");
    expect(getFeishuLoginReturnTo(entry.searchParams.get("returnTo"))).toBe(
      "/orders/spot/1?view=buyer#bill",
    );
  });

  it.each([
    null,
    "/",
    "//foreign.example.test/",
    "/\\foreign.example.test",
    "/api/auth/session",
    "/auth/callback",
  ])("rejects unsafe or recursive return destinations: %s", (value) => {
    expect(getFeishuLoginReturnTo(value)).toBe("/shop");
  });
});
