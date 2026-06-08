import { describe, expect, it } from "vitest"
import { FeatureUnavailableError } from "../errors"
import { getCurrentUser, loginWithLarkCode } from "./auth"

describe("auth service", () => {
  it("returns mock user in mock mode", async () => {
    const user = await getCurrentUser({ dataSource: "mock" })
    expect(user.name).toBe("南邮同学")
  })

  it("throws for local mode before backend client is wired", async () => {
    await expect(getCurrentUser({ dataSource: "local" })).rejects.toBeInstanceOf(
      FeatureUnavailableError
    )
  })

  it("returns a mock session in mock mode", async () => {
    const session = await loginWithLarkCode("abc", { dataSource: "mock" })
    expect(session.sessionToken).toBe("mock-session-abc")
  })
})
