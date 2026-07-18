import { describe, expect, it, vi } from "vitest"

import {
  configureLarkJsapi,
  isLarkScanCancelledError,
  requestLarkAuthorizationCode,
  scanLarkBarcode,
  type LarkClientApi,
  type LarkH5Sdk,
} from "./lark-client"

describe("Lark client adapter", () => {
  it("requests the login code with requestAccess", async () => {
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

  it("configures only the scanCode JSAPI", async () => {
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) =>
      options.onSuccess?.({}),
    )

    await expect(
      configureLarkJsapi(
        { config },
        {
          appId: "cli_test",
          timestamp: "1784320800000",
          nonceStr: "nonce",
          signature: "signature",
        },
      ),
    ).resolves.toBeUndefined()
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: 1_784_320_800_000,
        jsApiList: ["tt.scanCode"],
      }),
    )
  })

  it("rejects an invalid JSAPI timestamp before configuring the SDK", async () => {
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>()

    await expect(
      configureLarkJsapi(
        { config },
        {
          appId: "cli_test",
          timestamp: "not-a-timestamp",
          nonceStr: "nonce",
          signature: "signature",
        },
      ),
    ).rejects.toThrow("扫码鉴权参数无效")
    expect(config).not.toHaveBeenCalled()
  })

  it("scans only barcodes and preserves leading zeroes", async () => {
    const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>((options) =>
      options.success({ result: " 0690000000001 " }),
    )

    await expect(scanLarkBarcode({ scanCode })).resolves.toBe("0690000000001")
    expect(scanCode).toHaveBeenCalledWith(
      expect.objectContaining({ scanType: ["barCode"], barCodeInput: true }),
    )
  })

  it("rejects non-numeric scan results", async () => {
    const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>((options) =>
      options.success({ result: "https://example.com" }),
    )

    await expect(scanLarkBarcode({ scanCode })).rejects.toThrow(
      "扫描结果不是有效商品条码",
    )
  })

  it("preserves the Feishu cancellation errno", async () => {
    const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>((options) =>
      options.fail({ errno: 1_505_002, errString: "user cancel" }),
    )

    const error = await scanLarkBarcode({ scanCode }).catch((reason) => reason)

    expect(isLarkScanCancelledError(error)).toBe(true)
  })
})
