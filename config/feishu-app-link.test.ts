import { describe, expect, it } from "vitest";
import { getFeishuAppLink } from "./feishu-app-link";

const origin = "https://shop.example.test";

function target(href: string) {
  return new URL(
    new URL(getFeishuAppLink("cli_test", href)!).searchParams.get(
      "lk_target_url",
    )!,
  );
}

describe("Feishu app link destinations", () => {
  it("preserves encoded business query parameters and fragments", () => {
    const href = `${origin}/shop?search=${encodeURIComponent("牛奶 & 面包")}&view=buyer#goods`;
    expect(target(href).href).toBe(href);
    expect(
      new URL(getFeishuAppLink(" cli_test ", href)!).searchParams.get("appId"),
    ).toBe("cli_test");
  });

  it.each([
    "/auth/callback?code=private&state=private",
    "/api/auth/session?code=private",
  ])("uses the storefront instead of forwarding a private route: %s", (path) =>
    expect(target(`${origin}${path}`).href).toBe(`${origin}/shop`),
  );

  it("removes authorization parameters without losing the business destination", () => {
    expect(
      target(
        `${origin}/orders?code=private&state=private&access_token=private&refresh_token=private&id_token=private&view=buyer#bill`,
      ).href,
    ).toBe(`${origin}/orders?view=buyer#bill`);
    expect(
      target(`${origin}/shop#access_token=private&state=private`).href,
    ).toBe(`${origin}/shop`);
  });

  it.each([
    "#?access_token=private",
    "#/auth/callback?code=private&state=private",
    "#user_access_token=private",
  ])("does not forward authorization fragments: %s", (hash) =>
    expect(target(`${origin}/shop${hash}`).href).toBe(`${origin}/shop`),
  );

  it("sanitizes the login return path including nested authorization parameters", () => {
    const nested = `/orders?view=buyer&returnTo=${encodeURIComponent("/shop?code=private#id_token=private")}`;
    const href = `${origin}/?code=private&returnTo=${encodeURIComponent(nested)}`;
    const returnTo = target(href).searchParams.get("returnTo")!;
    expect(new URL(returnTo, origin).searchParams.get("view")).toBe("buyer");
    expect(new URL(returnTo, origin).searchParams.get("returnTo")).toBe(
      "/shop",
    );
    expect(decodeURIComponent(target(href).href)).not.toContain("private");
  });

  it.each([
    "//outside.example.test/",
    "/auth/callback?code=private",
    "/api/auth/session",
  ])("replaces unsafe login return paths: %s", (returnTo) => {
    expect(
      target(
        `${origin}/?returnTo=${encodeURIComponent(returnTo)}`,
      ).searchParams.get("returnTo"),
    ).toBe("/shop");
  });

  it.each([
    "javascript:alert(1)",
    "https://user:password@shop.example.test/shop",
    "invalid-url",
  ])("does not build a link for an unsafe current URL: %s", (href) =>
    expect(getFeishuAppLink("cli_test", href)).toBeNull(),
  );

  it("does not build a link without an app ID", () => {
    expect(getFeishuAppLink(" ", `${origin}/shop`)).toBeNull();
  });
});
