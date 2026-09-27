import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/auth/callback/route";
import {
  createFeishuOAuthState,
  feishuOAuthStateCookieName,
  feishuOAuthStateCookiePath,
  feishuOAuthStateMaxAgeSeconds,
} from "./feishu-oauth";

const auth = vi.hoisted(() => ({
  mode: "required",
  exchange: vi.fn(),
  setCookies: vi.fn(),
  config: {
    appId: "cli_test",
    redirectUri: "https://shop-pc.julien.net.cn/auth/callback",
    authorizeUrl: "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/app-config", () => ({
  desktopAppConfig: { appOrigin: "https://shop-pc.julien.net.cn" },
}));
vi.mock("@/lib/auth-mode", () => ({ getServerAuthMode: () => auth.mode }));
vi.mock("@/lib/feishu-oauth-config", () => ({
  getFeishuOAuthConfig: () => auth.config,
}));
vi.mock("@/lib/auth-session", () => ({
  createDesktopAuthSessionFromLarkCode: auth.exchange,
  setDesktopAuthSessionCookies: auth.setCookies,
  LoginConfigurationError: class extends Error {},
  LoginRateLimitedError: class extends Error {
    constructor(readonly retryAfterSeconds: number) {
      super("Too many login attempts");
    }
  },
}));

const now = new Date("2026-09-20T12:00:00Z");
const session = {
  sessionToken: "server-session-token",
  expiresAt: "2026-09-21T12:00:00Z",
  user: { id: "1", name: "Test user" },
};

function freshState(issuedAt = now.getTime()) {
  return createFeishuOAuthState("/orders?status=paid", {
    nonce: "test_nonce_for_oauth_callback",
    issuedAt,
  });
}

function callbackRequest({
  state = freshState(),
  cookieState = state,
  host = "shop-pc.julien.net.cn",
  path = "/auth/callback",
}: {
  state?: string;
  cookieState?: string;
  host?: string;
  path?: string;
} = {}) {
  const url = new URL(path, "http://0.0.0.0:3002");
  url.searchParams.set("code", "authorization-code");
  url.searchParams.set("state", state);
  return new NextRequest(url, {
    headers: {
      host,
      cookie: `${feishuOAuthStateCookieName}=${cookieState}`,
      "x-forwarded-host": "shop-pc.julien.net.cn",
      "x-forwarded-proto": "https",
    },
  });
}

function expectClearedState(response: NextResponse) {
  const cookie = response.cookies.get(feishuOAuthStateCookieName);
  expect(cookie?.value).toBe("");
  expect(cookie?.path).toBe(feishuOAuthStateCookiePath);
  expect(cookie?.expires).toBeInstanceOf(Date);
  expect(cookie?.expires instanceof Date ? cookie.expires.getTime() : null).toBe(0);
}

describe("desktop OAuth callback behind the HTTPS reverse proxy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    auth.mode = "required";
    auth.exchange.mockReset();
    auth.exchange.mockResolvedValue({
      session,
      sessionUserCookie: "signed-session-user",
    });
    auth.setCookies.mockReset();
    auth.setCookies.mockImplementation((response: NextResponse) => {
      response.cookies.set("sast_shop_session", session.sessionToken, {
        httpOnly: true,
        secure: true,
        path: "/",
      });
      response.cookies.set("sast_shop_session_user", "signed-session-user", {
        httpOnly: true,
        secure: true,
        path: "/",
      });
    });
  });
  afterEach(() => vi.useRealTimers());

  it("accepts the public Host with an internal HTTP URL and redirects publicly", async () => {
    const request = callbackRequest();
    expect(request.nextUrl.origin).toBe("http://0.0.0.0:3002");

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://shop-pc.julien.net.cn/orders?status=paid",
    );
    expect(auth.exchange).toHaveBeenCalledExactlyOnceWith("authorization-code", {
      redirectUri: auth.config.redirectUri,
    });
    expect(auth.setCookies).toHaveBeenCalledExactlyOnceWith(
      response,
      session,
      "signed-session-user",
    );
    expect(response.cookies.get("sast_shop_session")?.value).toBe(
      session.sessionToken,
    );
    expect(response.cookies.get("sast_shop_session_user")?.value).toBe(
      "signed-session-user",
    );
    expectClearedState(response);
  });

  it("reports a rejected code as 401 after reaching the exchange, not configuration 500", async () => {
    auth.exchange.mockRejectedValue(new Error("invalid authorization code"));

    const response = await GET(callbackRequest());

    expect(response.status).toBe(401);
    expect(auth.exchange).toHaveBeenCalledOnce();
    expect(auth.setCookies).not.toHaveBeenCalled();
    expect(await response.text()).toContain("登录会话建立失败");
    expectClearedState(response);
  });

  it("rejects an unexpected Host even when forwarded headers claim the public host", async () => {
    const response = await GET(callbackRequest({ host: "evil.example" }));

    expect(response.status).toBe(500);
    expect(auth.exchange).not.toHaveBeenCalled();
    expect(auth.setCookies).not.toHaveBeenCalled();
    expectClearedState(response);
  });

  it("rejects a callback pathname different from the configured redirect URI", async () => {
    const response = await GET(callbackRequest({ path: "/auth/other" }));

    expect(response.status).toBe(500);
    expect(auth.exchange).not.toHaveBeenCalled();
    expectClearedState(response);
  });

  it("rejects state that does not match the browser cookie before exchanging the code", async () => {
    const response = await GET(callbackRequest({ cookieState: "different-state" }));

    expect(response.status).toBe(400);
    expect(auth.exchange).not.toHaveBeenCalled();
    expect(auth.setCookies).not.toHaveBeenCalled();
    expectClearedState(response);
  });

  it("rejects an expired state even when it still matches the browser cookie", async () => {
    const state = freshState(
      now.getTime() - feishuOAuthStateMaxAgeSeconds * 1000 - 1,
    );
    const response = await GET(callbackRequest({ state }));

    expect(response.status).toBe(400);
    expect(auth.exchange).not.toHaveBeenCalled();
    expect(auth.setCookies).not.toHaveBeenCalled();
    expectClearedState(response);
  });

  it("uses the configured public origin when authentication is disabled", async () => {
    auth.mode = "off";

    const response = await GET(callbackRequest());

    expect(response.headers.get("location")).toBe(
      "https://shop-pc.julien.net.cn/shop",
    );
    expect(auth.exchange).not.toHaveBeenCalled();
  });
});
