import { describe, expect, it, vi } from "vitest"

import { requestLarkAuthorizationCode, type LarkClientApi } from "./lark-auth"

describe("requestLarkAuthorizationCode", () => {
  it("uses requestAccess with the empty login scope", async () => {
    const requestAccess = vi.fn<NonNullable<LarkClientApi["requestAccess"]>>(
      (options) => options.success({ code: " access-code " }),
    )

    await expect(
      requestLarkAuthorizationCode({ requestAccess }, "cli_test"),
    ).resolves.toBe("access-code")
    expect(requestAccess).toHaveBeenCalledWith(
      expect.objectContaining({ appID: "cli_test", scopeList: [] }),
    )
  })

  it("falls back to requestAuthCode when requestAccess is unavailable", async () => {
    const requestAuthCode = vi.fn<NonNullable<LarkClientApi["requestAuthCode"]>>(
      (options) => options.success({ code: "legacy-code" }),
    )

    await expect(
      requestLarkAuthorizationCode({ requestAuthCode }, "cli_test"),
    ).resolves.toBe("legacy-code")
  })

  it("falls back for clients reporting errno 103", async () => {
    const requestAuthCode = vi.fn<NonNullable<LarkClientApi["requestAuthCode"]>>(
      (options) => options.success({ code: "fallback-code" }),
    )
    const requestAccess = vi.fn<NonNullable<LarkClientApi["requestAccess"]>>(
      (options) => options.fail({ errno: 103 }),
    )

    await expect(
      requestLarkAuthorizationCode(
        { requestAccess, requestAuthCode },
        "cli_test",
      ),
    ).resolves.toBe("fallback-code")
  })
})
