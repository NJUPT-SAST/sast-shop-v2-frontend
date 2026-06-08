import { describe, expect, expectTypeOf, it } from "vitest"
import { FeatureUnavailableError } from "../errors"
import type { AuthSession, CurrentUser } from "./auth"
import { getCurrentUser, loginWithLarkCode } from "./auth"

describe("auth service", () => {
  it("exposes stable auth return types", () => {
    expectTypeOf(getCurrentUser()).toEqualTypeOf<Promise<CurrentUser>>()
    expectTypeOf(loginWithLarkCode("abc")).toEqualTypeOf<Promise<AuthSession>>()
  })

  it("returns mock user in mock mode", async () => {
    const user = await getCurrentUser({ dataSource: "mock" })
    expect(user.name).toBe("南邮同学")
  })

  it.each(["local", "remote"] as const)(
    "throws for %s mode before backend client is wired",
    async (dataSource) => {
      await expect(getCurrentUser({ dataSource })).rejects.toBeInstanceOf(
        FeatureUnavailableError
      )
      await expect(loginWithLarkCode("abc", { dataSource })).rejects.toBeInstanceOf(
        FeatureUnavailableError
      )
    }
  )

  it("returns a mock session in mock mode", async () => {
    const session = await loginWithLarkCode("abc", { dataSource: "mock" })
    expect(session.sessionToken).toBe("mock-session-abc")
  })
})
