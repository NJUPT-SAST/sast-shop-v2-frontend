import { describe, expect, it } from "vitest";

import {
  createFeishuOAuthAuthorizeUrl,
  createFeishuOAuthState,
  defaultFeishuOAuthAuthorizeUrl,
  isFreshFeishuOAuthState,
  normalizeAuthReturnTo,
  parseFeishuOAuthState,
  resolveFeishuOAuthConfig,
} from "./feishu-oauth";

describe("desktop Feishu OAuth helpers", () => {
  it("builds the Feishu authorization URL with app id, redirect URI and state", () => {
    const config = resolveFeishuOAuthConfig({
      appId: " cli_test ",
      redirectUri: "http://localhost:3002/auth/callback",
      appOrigin: "http://localhost:3002",
    });
    const url = createFeishuOAuthAuthorizeUrl(config, "state-value");

    expect(`${url.origin}${url.pathname}`).toBe(defaultFeishuOAuthAuthorizeUrl);
    expect(url.searchParams.get("client_id")).toBe("cli_test");
    expect(url.searchParams.get("app_id")).toBeNull();
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3002/auth/callback",
    );
    expect(url.searchParams.get("state")).toBe("state-value");
  });

  it("rejects cross-origin OAuth callback URLs", () => {
    expect(() =>
      resolveFeishuOAuthConfig({
        appId: "cli_test",
        redirectUri: "http://localhost:3000/auth/callback",
        appOrigin: "http://localhost:3002",
      }),
    ).toThrow("FEISHU_REDIRECT_URI is invalid");
  });

  it("requires a Feishu app id in cli_ format", () => {
    expect(() =>
      resolveFeishuOAuthConfig({
        appId: "app_123",
        redirectUri: "http://localhost:3002/auth/callback",
        appOrigin: "http://localhost:3002",
      }),
    ).toThrow("FEISHU_APP_ID is not configured or invalid");
  });

  it.each([
    "http://localhost:3002/shop",
    "http://localhost:3002/auth/callback?next=/shop",
  ])("rejects non-canonical OAuth callback URLs %s", (redirectUri) => {
    expect(() =>
      resolveFeishuOAuthConfig({
        appId: "cli_test",
        redirectUri,
        appOrigin: "http://localhost:3002",
      }),
    ).toThrow("FEISHU_REDIRECT_URI is invalid");
  });

  it("keeps OAuth return paths same-origin and outside auth endpoints", () => {
    expect(normalizeAuthReturnTo("/orders?status=paid")).toBe(
      "/orders?status=paid",
    );
    expect(normalizeAuthReturnTo("https://evil.example/shop")).toBe("/shop");
    expect(normalizeAuthReturnTo("//evil.example/shop")).toBe("/shop");
    expect(normalizeAuthReturnTo("/auth/callback?code=abc")).toBe("/shop");
    expect(normalizeAuthReturnTo("/api/auth/session")).toBe("/shop");
  });

  it("round-trips a fresh OAuth state", () => {
    const state = createFeishuOAuthState("/profile", {
      nonce: "state_nonce_value",
      issuedAt: 1_784_320_800_000,
    });

    expect(parseFeishuOAuthState(state)).toEqual({
      nonce: "state_nonce_value",
      returnTo: "/profile",
      issuedAt: 1_784_320_800_000,
    });
    expect(
      isFreshFeishuOAuthState(
        {
          nonce: "state_nonce_value",
          returnTo: "/profile",
          issuedAt: 1_784_320_800_000,
        },
        1_784_320_805_000,
      ),
    ).toBe(true);
  });

});
