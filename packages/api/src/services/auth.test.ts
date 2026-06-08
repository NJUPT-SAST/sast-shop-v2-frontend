import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import {
  ApiConfigurationError,
  ApiRequestError,
  FeatureUnavailableError,
} from "../errors"
import type { AuthSession, CurrentUser } from "./auth"
import { getCurrentUser, loginWithLarkCode } from "./auth"

describe("auth service", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("exposes stable auth return types", () => {
    expectTypeOf(getCurrentUser()).toEqualTypeOf<Promise<CurrentUser>>()
    expectTypeOf(loginWithLarkCode("abc")).toEqualTypeOf<Promise<AuthSession>>()
    expectTypeOf<CurrentUser>().toEqualTypeOf<{
      id: string
      name: string
      avatarUrl: string
    }>()
  })

  it("returns mock user in mock mode", async () => {
    const user = await getCurrentUser({ dataSource: "mock" })
    expect(user.name).toBe("南邮同学")
    expect(user).not.toHaveProperty("department")
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

  it("requires a configured Connect base URL for local mode", async () => {
    await expect(getCurrentUser({ dataSource: "local" })).rejects.toBeInstanceOf(
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

  it("returns a mock session in mock mode", async () => {
    const session = await loginWithLarkCode("abc", { dataSource: "mock" })
    expect(session.sessionToken).toBe("mock-session-abc")
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
