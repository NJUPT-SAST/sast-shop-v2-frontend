import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
} from "../errors"
import type { AuthSession, CurrentUser, JSAPIAuthConfig } from "./auth"
import { getCurrentUser, getJSAPIAuthConfig, loginWithLarkCode } from "./auth"

describe("auth service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable auth return types", () => {
    expectTypeOf<typeof getCurrentUser>().returns.toEqualTypeOf<
      Promise<CurrentUser>
    >()
    expectTypeOf<typeof loginWithLarkCode>().returns.toEqualTypeOf<
      Promise<AuthSession>
    >()
    expectTypeOf<typeof getJSAPIAuthConfig>().returns.toEqualTypeOf<
      Promise<JSAPIAuthConfig>
    >()
    expectTypeOf<CurrentUser>().toEqualTypeOf<{
      id: string
      name: string
      avatarUrl: string
    }>()
  })

  it("returns JSAPI signing fields without exposing a ticket", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          appId: "cli_test",
          timestamp: "1784320800000",
          nonceStr: "nonce-value",
          signature: "signed-value",
        }),
        { headers: { "content-type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getJSAPIAuthConfig("https://shop.example.com/publish/spot?source=nav#ignored", {
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      }),
    ).resolves.toEqual({
      appId: "cli_test",
      timestamp: "1784320800000",
      nonceStr: "nonce-value",
      signature: "signed-value",
    })
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AuthService/GetJSAPIAuthConfig",
      body: { url: "https://shop.example.com/publish/spot?source=nav" },
    })
  })

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
    ).rejects.toThrow("JSAPI 签名地址不正确")
  })

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
        }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const user = await getCurrentUser({
      dataSource: "mock",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(user).toEqual({
      id: "10001",
      name: "fauxrpc 同学",
      avatarUrl: "https://example.test/avatar.png",
    })
    expect(user).not.toHaveProperty("department")
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.UserService/GetUserInfo",
      body: { userId: "10001" },
    })
  })

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
        }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const user = await getCurrentUser({
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(user).toEqual({
      id: "10001",
      name: "南邮同学",
      avatarUrl: "https://example.test/avatar.png",
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.UserService/GetUserInfo",
      body: { userId: "10001" },
    })
  })

  it("returns a login session from the local Connect backend", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          sessionToken: "local-session-token",
          expiresAt: "2099-12-31T23:59:59Z",
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
        }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const session = await loginWithLarkCode("lark-code", {
      dataSource: "local",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(session).toEqual({
      sessionToken: "local-session-token",
      expiresAt: "2099-12-31T23:59:59.000Z",
      user: {
        id: "10001",
        name: "南邮同学",
        avatarUrl: "https://example.test/avatar.png",
      },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AuthService/Login",
      body: { code: "lark-code" },
    })
  })

  it.each([
    { sessionToken: "", expiresAt: "2099-12-31T23:59:59Z" },
    { sessionToken: "expired-token", expiresAt: "2020-01-01T00:00:00Z" },
  ])("rejects an invalid login session", async ({ sessionToken, expiresAt }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            sessionToken,
            expiresAt,
            userInfo: {
              id: "10001",
              name: "南邮同学",
              avatarUrl: "https://example.test/avatar.png",
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    )

    await expect(
      loginWithLarkCode("lark-code", {
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      }),
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
  })

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
          }
        )
      })
    )

    await expect(
      getCurrentUser({
        dataSource: "local",
        connectBaseUrl: "http://127.0.0.1:6660",
      })
    ).rejects.toBeInstanceOf(ApiRequestError)
  })

  it("requires a configured Connect base URL for local and mock modes", async () => {
    await expect(getCurrentUser({ dataSource: "local" })).rejects.toBeInstanceOf(
      ApiConfigurationError
    )
    await expect(getCurrentUser({ dataSource: "mock" })).rejects.toBeInstanceOf(
      ApiConfigurationError
    )
  })

  it("throws for remote mode before backend client is wired", async () => {
    await expect(getCurrentUser({ dataSource: "remote" })).rejects.toBeInstanceOf(
      FeatureUnavailableError
    )
    await expect(
      loginWithLarkCode("abc", { dataSource: "remote" })
    ).rejects.toBeInstanceOf(FeatureUnavailableError)
  })

  it("returns a login session from the fauxrpc backend in mock mode", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          sessionToken: "mock-session-token",
          expiresAt: "2099-12-31T23:59:59Z",
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
        }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const session = await loginWithLarkCode("abc", {
      dataSource: "mock",
      connectBaseUrl: "http://127.0.0.1:6660",
    })

    expect(session.sessionToken).toBe("mock-session-token")
    expect(fetchMock).toHaveBeenCalledOnce()
    await expectConnectRequest(fetchMock, {
      path: "/sast.sastshopv2.user.v1.AuthService/Login",
      body: { code: "abc" },
    })
  })
})

async function expectConnectRequest(
  fetchMock: ReturnType<typeof vi.fn>,
  expected: {
    path: string
    body: Record<string, string>
  }
) {
  const [input, init] = fetchMock.mock.calls[0] ?? []
  const url = typeof input === "string" ? input : (input as Request).url
  const body =
    typeof input === "string" ? init?.body : await (input as Request).clone().text()

  expect(new URL(url).pathname).toBe(expected.path)
  expect(JSON.parse(bodyToText(body))).toEqual(expected.body)
}

function bodyToText(body: unknown): string {
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body)
  }

  if (body instanceof ArrayBuffer) {
    return new TextDecoder().decode(body)
  }

  return String(body)
}
