import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/callback/route";
import {
  createFeishuOAuthState,
  feishuOAuthStateCookieName,
} from "./feishu-oauth";

const mocks = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  setSessionCookies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-mode", () => ({
  getServerAuthMode: () => "required",
}));
vi.mock("@/lib/feishu-oauth-config", () => ({
  getFeishuOAuthConfig: () => ({
    appId: "cli_test",
    redirectUri: "https://shop-pc.example.test/auth/callback",
    authorizeUrl: "https://accounts.feishu.cn/open-apis/authen/v1/authorize",
  }),
}));
vi.mock("@/lib/auth-session", () => ({
  createDesktopAuthSessionFromLarkCode: mocks.exchangeCode,
  setDesktopAuthSessionCookies: mocks.setSessionCookies,
  LoginConfigurationError: class extends Error {},
  LoginRateLimitedError: class extends Error {},
}));

const appOrigin = "https://shop-pc.example.test";
const session = {
  user: { id: "test-user", name: "测试用户", avatarUrl: "" },
  sessionToken: "test-session",
  expiresAt: "2030-01-01T00:00:00.000Z",
};

function callbackRequest({
  host = "shop-pc.example.test",
  forwardedHost = host,
  state = createFeishuOAuthState("/orders?status=paid"),
  cookieState = state,
  path = "/auth/callback",
}: {
  host?: string | null;
  forwardedHost?: string | null;
  state?: string;
  cookieState?: string;
  path?: string;
} = {}) {
  const headers = new Headers({
    cookie: `${feishuOAuthStateCookieName}=${cookieState}`,
    "x-forwarded-proto": "https",
  });
  if (host !== null) headers.set("host", host);
  if (forwardedHost !== null) headers.set("x-forwarded-host", forwardedHost);
  const url = new URL(path, "http://internal-app:3002");
  url.searchParams.set("code", "test-code");
  url.searchParams.set("state", state);
  return new NextRequest(url, { headers });
}

beforeEach(() => {
  mocks.exchangeCode.mockReset().mockResolvedValue({
    session,
    sessionUserCookie: "signed-test-user",
  });
  mocks.setSessionCookies.mockReset();
});

describe("desktop OAuth callback behind a reverse proxy", () => {
  it("exchanges the code and redirects to the configured public origin", async () => {
    const request = callbackRequest();
    expect(request.nextUrl.origin).toBe("http://internal-app:3002");

    const response = await GET(request);

    expect(mocks.exchangeCode).toHaveBeenCalledExactlyOnceWith("test-code", {
      redirectUri: `${appOrigin}/auth/callback`,
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${appOrigin}/orders?status=paid`,
    );
    expect(mocks.setSessionCookies).toHaveBeenCalledExactlyOnceWith(
      response,
      session,
      "signed-test-user",
    );
    expect(response.cookies.get(feishuOAuthStateCookieName)?.value).toBe("");
  });

  it("reports a failed code exchange as 401 after accepting the public host", async () => {
    mocks.exchangeCode.mockRejectedValueOnce(new Error("invalid OAuth code"));

    const response = await GET(callbackRequest());

    expect(response.status).toBe(401);
    expect(await response.text()).toContain("登录会话建立失败");
    expect(mocks.exchangeCode).toHaveBeenCalledOnce();
    expect(mocks.setSessionCookies).not.toHaveBeenCalled();
  });

  it.each(["attacker.test", null])(
    "rejects an invalid Host %s even with a forged public forwarded host",
    async (host) => {
      const response = await GET(
        callbackRequest({ host, forwardedHost: "shop-pc.example.test" }),
      );

      expect(response.status).toBe(500);
      expect(await response.text()).toContain("登录配置不可用");
      expect(mocks.exchangeCode).not.toHaveBeenCalled();
      expect(mocks.setSessionCookies).not.toHaveBeenCalled();
    },
  );

  it("never uses a supplied forwarded host for the successful redirect", async () => {
    const response = await GET(
      callbackRequest({ forwardedHost: "attacker.test" }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      `${appOrigin}/orders?status=paid`,
    );
  });

  it("rejects an unexpected callback path before exchanging the code", async () => {
    const response = await GET(
      callbackRequest({ path: "/auth/callback/unexpected" }),
    );

    expect(response.status).toBe(500);
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
  });

  it("rejects mismatched OAuth state before exchanging the code", async () => {
    const response = await GET(callbackRequest({ cookieState: "wrong-state" }));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("登录状态已失效");
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
    expect(mocks.setSessionCookies).not.toHaveBeenCalled();
  });

  it("rejects an expired OAuth state before exchanging the code", async () => {
    const state = createFeishuOAuthState("/shop", {
      issuedAt: Date.now() - 11 * 60_000,
    });

    const response = await GET(callbackRequest({ state }));

    expect(response.status).toBe(400);
    expect(mocks.exchangeCode).not.toHaveBeenCalled();
    expect(mocks.setSessionCookies).not.toHaveBeenCalled();
  });
});
