import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  ApiConfigurationError,
  ApiRequestError,
  AuthRequiredError,
  FeatureUnavailableError,
} from "../errors";
import type { AuthSession, CurrentUser, JSAPIAuthConfig } from "./auth";
import {
  getCurrentUser,
  getJSAPIAuthConfig,
  loginWithLarkCode,
  validateSessionUser,
} from "./auth";

describe("auth service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exposes stable auth return types", () => {
    expectTypeOf<typeof getCurrentUser>().returns.toEqualTypeOf<
      Promise<CurrentUser>
    >();
    expectTypeOf<typeof loginWithLarkCode>().returns.toEqualTypeOf<
      Promise<AuthSession>
    >();
    expectTypeOf<typeof getJSAPIAuthConfig>().returns.toEqualTypeOf<
      Promise<JSAPIAuthConfig>
    >();
    expectTypeOf<CurrentUser>().toEqualTypeOf<{
      id: string;
      name: string;
      avatarUrl: string;
    }>();
  });

  it("returns JSAPI signing fields without exposing a ticket", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            appId: "cli_test",
            timestamp: "1784320800000",
            nonceStr: "nonce-value",
            signature: "signed-value",
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getJSAPIAuthConfig(
        "https://shop.example.com/publish/spot?source=nav#ignored",
        {
          dataSource: "local",
          connectBaseUrl: "http://127.0.0.1:6660",
        },
      ),
    ).resolves.toEqual({
      appId: "cli_test",
      timestamp: "1784320800000",
      nonceStr: "nonce-value",
      signature: "signed-value",
    });
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AuthService/GetJSAPIAuthConfig",
      body: { url: "https://shop.example.com/publish/spot?source=nav" },
    });
  });

  it.each([
    "javascript:alert(1)",
    "https://user:secret@shop.example.com/publish/spot",
    "not a url",
  ])("rejects unsafe JSAPI signing URL %s", async (url) => {
    await expect(
      getJSAPIAuthConfig(url, {
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      }),
    ).rejects.toThrow("JSAPI 签名地址不正确");
  });

  it("returns current user from the fauxrpc backend in mock mode", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          userInfo: {
            id: "10001",
            name: "fauxrpc 同学",
            avatarUrl: "https://example.test/avatar.png",
          },
        }),
        {
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = await getCurrentUser({
      dataSource: "mock",
      connectBaseUrl: "http://127.0.0.1:6660",
    });

    expect(user).toEqual({
      id: "10001",
      name: "fauxrpc 同学",
      avatarUrl: "https://example.test/avatar.png",
    });
    expect(user).not.toHaveProperty("department");
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.UserService/GetUserInfo",
      body: { userId: "10001" },
    });
  });

  it("returns current user from the local Connect backend", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          userInfo: {
            id: "10001",
            name: "南邮同学",
            avatarUrl: "https://example.test/avatar.png",
          },
        }),
        {
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = await getCurrentUser({
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    });

    expect(user).toEqual({
      id: "10001",
      name: "南邮同学",
      avatarUrl: "https://example.test/avatar.png",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.UserService/GetUserInfo",
      body: { userId: "10001" },
    });
  });

  it("validates the OAuth session against its returned user ID", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        userInfo: {
          id: "42",
          name: "OAuth 用户",
          avatarUrl: "https://example.test/oauth-user.png",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      validateSessionUser("42", {
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      }),
    ).resolves.toBeUndefined();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.UserService/GetUserInfo",
      body: { userId: "42" },
    });
  });

  it("rejects a session probe that resolves to another user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          userInfo: {
            id: "10001",
            name: "其他用户",
            avatarUrl: "",
          },
        }),
      ),
    );

    await expect(
      validateSessionUser("42", {
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      }),
    ).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it("uses the authenticated user returned by OAuth without another RPC", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const currentUser = {
      id: "42",
      name: "OAuth 用户",
      avatarUrl: "https://example.test/oauth-user.png",
    };

    await expect(
      getCurrentUser({
        dataSource: "local",
        currentUser,
        requiresAuthenticatedUser: true,
      }),
    ).resolves.toEqual(currentUser);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fall back to the smoke user for an authenticated deployment", async () => {
    await expect(
      getCurrentUser({
        dataSource: "local",
        requiresAuthenticatedUser: true,
      }),
    ).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it("returns a login session from the local Connect backend", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.UTC(2026, 6, 18, 0, 0, 0));
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          accessToken: "local-session-token",
          expiresIn: 3600,
          member: {
            id: "10001",
            displayName: "南邮同学",
            avatarUrl: "https://example.test/avatar.png",
          },
        }),
        {
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await loginWithLarkCode("lark-code", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    });

    expect(session).toEqual({
      sessionToken: "local-session-token",
      expiresAt: "2026-07-18T01:00:00.000Z",
      user: {
        id: "10001",
        name: "南邮同学",
        avatarUrl: "https://example.test/avatar.png",
      },
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AuthService/Login",
      body: { code: "lark-code" },
    });
  });

  it.each([
    { accessToken: "", expiresIn: 3600, member: true },
    { accessToken: "token", expiresIn: 0, member: true },
    { accessToken: "token", expiresIn: 3600, member: false },
  ])(
    "rejects an invalid login session",
    async ({ accessToken, expiresIn, member }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                accessToken,
                expiresIn,
                member: member
                  ? {
                      id: "10001",
                      displayName: "南邮同学",
                      avatarUrl: "https://example.test/avatar.png",
                    }
                  : undefined,
              }),
              { headers: { "content-type": "application/json" } },
            ),
        ),
      );

      await expect(
        loginWithLarkCode("lark-code", {
          dataSource: "local",
          connectBaseUrl: "http://127.0.0.1:6660",
        }),
      ).rejects.toBeInstanceOf(FeatureUnavailableError);
    },
  );

  it("wraps local Connect failures in an API request error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            code: "unavailable",
            message: "backend unavailable",
          }),
          {
            status: 503,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }),
    );

    await expect(
      getCurrentUser({
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      }),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("requires a configured Connect base URL for local and mock modes", async () => {
    await expect(
      getCurrentUser({ dataSource: "local" }),
    ).rejects.toBeInstanceOf(ApiConfigurationError);
    await expect(getCurrentUser({ dataSource: "mock" })).rejects.toBeInstanceOf(
      ApiConfigurationError,
    );
  });

  it("throws for remote mode before backend client is wired", async () => {
    await expect(
      getCurrentUser({ dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
    await expect(
      loginWithLarkCode("abc", { dataSource: "remote" }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError);
  });

  it("returns a login session from the fauxrpc backend in mock mode", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          accessToken: "mock-session-token",
          expiresIn: 3600,
          member: {
            id: "10001",
            displayName: "fauxrpc 同学",
            avatarUrl: "https://example.test/avatar.png",
          },
        }),
        {
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await loginWithLarkCode("abc", {
      dataSource: "mock",
      connectBaseUrl: "http://127.0.0.1:6660",
    });

    expect(session.sessionToken).toBe("mock-session-token");
    expect(fetchMock).toHaveBeenCalledOnce();
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AuthService/Login",
      body: { code: "abc" },
    });
  });
});

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string;
    body: Record<string, string>;
  },
) {
  const [input, init] = fetchMock.mock.calls[0] ?? [];
  const url = typeof input === "string" ? input : (input as Request).url;
  const body =
    typeof input === "string"
      ? init?.body
      : await (input as Request).clone().text();

  expect(new URL(url).pathname).toBe(expected.path);
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body);
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body);
  }

  return String(body);
}
