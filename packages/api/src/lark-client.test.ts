import { describe, expect, it, vi } from "vitest";

import {
  configureLarkJsapi,
  enterLarkChat,
  isLarkClientEnvironment,
  isLarkMobileClientEnvironment,
  isLarkScanCancelledError,
  requestLarkAuthorizationCode,
  scanLarkBarcode,
  waitForLarkReady,
  type LarkClientApi,
  type LarkH5Sdk,
} from "./lark-client";

describe("Lark client adapter", () => {
  it("requests the login code with requestAccess", async () => {
    const requestAccess = vi.fn<NonNullable<LarkClientApi["requestAccess"]>>(
      (options) => options.success({ code: " access-code " }),
    );

    await expect(
      requestLarkAuthorizationCode({ requestAccess }, "cli_test"),
    ).resolves.toBe("access-code");
    expect(requestAccess).toHaveBeenCalledWith(
      expect.objectContaining({ appID: "cli_test", scopeList: [] }),
    );
  });

  it("resolves when the Lark SDK becomes ready", async () => {
    await expect(
      waitForLarkReady({ ready: (callback) => callback() }),
    ).resolves.toBeUndefined();
  });

  it("rejects when the Lark SDK never becomes ready", async () => {
    vi.useFakeTimers();
    try {
      const expectation = expect(
        waitForLarkReady({ ready: () => undefined }),
      ).rejects.toThrow("初始化超时");

      await vi.advanceTimersByTimeAsync(15_000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("configures only the scanCode JSAPI", async () => {
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) =>
      options.onSuccess?.({}),
    );

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
    ).resolves.toBeUndefined();
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: 1_784_320_800_000,
        jsApiList: ["tt.scanCode"],
      }),
    );
  });

  it("rejects an invalid JSAPI timestamp before configuring the SDK", async () => {
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>();

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
    ).rejects.toThrow("JSAPI 鉴权参数无效");
    expect(config).not.toHaveBeenCalled();
  });

  it("configures the chat JSAPI when requested", async () => {
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) =>
      options.onSuccess?.({}),
    );

    await expect(
      configureLarkJsapi(
        { config },
        {
          appId: "cli_test",
          timestamp: "1784320800000",
          nonceStr: "nonce",
          signature: "signature",
        },
        ["tt.enterChat"],
      ),
    ).resolves.toBeUndefined();
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({ jsApiList: ["tt.enterChat"] }),
    );
  });

  it("opens a one-to-one chat with a Feishu open ID", async () => {
    const enterChat = vi.fn<NonNullable<LarkClientApi["enterChat"]>>(
      (options) => options.success({}),
    );

    await expect(
      enterLarkChat({ enterChat }, " ou_contact_123 "),
    ).resolves.toBeUndefined();
    expect(enterChat).toHaveBeenCalledWith(
      expect.objectContaining({ openid: "ou_contact_123" }),
    );
  });

  it("detects only Feishu desktop and mobile clients", () => {
    expect(
      isLarkClientEnvironment({
        browser: { versions: { PCFeishu: true } },
      }),
    ).toBe(true);
    expect(
      isLarkClientEnvironment({
        browser: { versions: { mobileFeishu: true } },
      }),
    ).toBe(true);
    expect(
      isLarkClientEnvironment({
        browser: { versions: { PCFeishu: false, mobileFeishu: false } },
      }),
    ).toBe(false);
    expect(isLarkClientEnvironment(undefined)).toBe(false);
  });

  it("exposes scanning only in the Feishu mobile client", () => {
    expect(
      isLarkMobileClientEnvironment({
        browser: { versions: { mobileFeishu: true } },
      }),
    ).toBe(true);
    expect(
      isLarkMobileClientEnvironment({
        browser: { versions: { PCFeishu: true } },
      }),
    ).toBe(false);
    expect(isLarkMobileClientEnvironment(undefined)).toBe(false);
  });

  it("recognizes mobile Feishu without private SDK browser metadata", () => {
    const userAgent = "Mozilla/5.0 (Linux; Android 15) Mobile Feishu/7.35.0";
    expect(isLarkMobileClientEnvironment({}, userAgent)).toBe(true);
    expect(isLarkMobileClientEnvironment(undefined, userAgent)).toBe(true);
    expect(isLarkClientEnvironment({}, userAgent)).toBe(true);
  });

  it("recognizes Lark on iOS while excluding desktop from scanning", () => {
    expect(
      isLarkMobileClientEnvironment(
        {},
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Lark/7.35.0",
      ),
    ).toBe(true);
    const desktopAgent = "Mozilla/5.0 (Macintosh) Feishu/7.35.0 WebApp";
    expect(isLarkClientEnvironment({}, desktopAgent)).toBe(true);
    expect(isLarkMobileClientEnvironment({}, desktopAgent)).toBe(false);
    expect(
      isLarkMobileClientEnvironment(
        {},
        "Mozilla/5.0 (Linux; Android 15) Mobile",
      ),
    ).toBe(false);
  });

  it("does not pass an internal numeric user ID to enterChat", async () => {
    const enterChat = vi.fn<NonNullable<LarkClientApi["enterChat"]>>();

    await expect(enterLarkChat({ enterChat }, "42")).rejects.toThrow(
      "联系人飞书标识无效",
    );
    expect(enterChat).not.toHaveBeenCalled();
  });

  it("scans only barcodes and preserves leading zeroes", async () => {
    const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>((options) =>
      options.success({ result: " 0690000000001 " }),
    );

    await expect(scanLarkBarcode({ scanCode })).resolves.toBe("0690000000001");
    expect(scanCode).toHaveBeenCalledWith(
      expect.objectContaining({ scanType: ["barCode"], barCodeInput: true }),
    );
  });

  it("rejects non-numeric scan results", async () => {
    const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>((options) =>
      options.success({ result: "https://example.com" }),
    );

    await expect(scanLarkBarcode({ scanCode })).rejects.toThrow(
      "扫描结果不是有效商品条码",
    );
  });

  it("preserves the Feishu cancellation errno", async () => {
    const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>((options) =>
      options.fail({ errno: 1_505_002, errString: "user cancel" }),
    );

    const error = await scanLarkBarcode({ scanCode }).catch((reason) => reason);

    expect(isLarkScanCancelledError(error)).toBe(true);
  });
});
