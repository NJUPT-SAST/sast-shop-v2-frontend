import { describe, expect, it } from "vitest";

import { getMobileLoginReturnTo, getMobileLoginUrl } from "./lark-login-navigation";

describe("mobile Feishu login navigation", () => {
  it("authorizes on the registered root instead of the marketplace path", () => {
    expect(getMobileLoginUrl("https://shop.julien.net.cn/shop")).toBe(
      "https://shop.julien.net.cn/?returnTo=%2Fshop",
    );
  });

  it("keeps deep links including their query and fragment after login", () => {
    const login = new URL(
      getMobileLoginUrl(
        "https://shop.julien.net.cn/orders/42?tab=payment#bill",
      )!,
    );
    expect(login.origin + login.pathname).toBe("https://shop.julien.net.cn/");
    expect(getMobileLoginReturnTo(login.search)).toBe(
      "/orders/42?tab=payment#bill",
    );
  });

  it("does not reload the canonical authorization page", () => {
    expect(getMobileLoginUrl("https://shop.julien.net.cn/")).toBeNull();
    expect(
      getMobileLoginUrl("https://shop.julien.net.cn/?returnTo=%2Forders"),
    ).toBeNull();
  });

  it.each([
    "",
    "/",
    "/?returnTo=/orders",
    "https://attacker.invalid/orders",
    "//attacker.invalid/orders",
    "/\\attacker.invalid/orders",
    "/\n/attacker.invalid/orders",
    "/api/auth/session",
    "/shop/../",
  ])("rejects unsafe or looping return target %j", (returnTo) => {
    expect(
      getMobileLoginReturnTo(new URLSearchParams({ returnTo }).toString()),
    ).toBe("/shop");
  });

  it("defaults to the marketplace for a workbench launch", () => {
    expect(getMobileLoginReturnTo("")).toBe("/shop");
  });
});
