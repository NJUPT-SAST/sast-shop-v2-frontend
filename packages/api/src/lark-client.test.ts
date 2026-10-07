import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configureLarkJsapi,
  configureLarkPageJsapi,
  withLarkPageJsapi,
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
  afterEach(() => vi.unstubAllGlobals());

  const authConfig = {
    appId: "cli_test",
    timestamp: "1784320800000",
    nonceStr: "nonce",
    signature: "signature",
  };

  function stubPage(entryUrl = "https://shop.example.com/?source=workplace") {
    vi.stubGlobal("window", {
      location: new URL("https://shop.example.com/shop#drawer"),
      performance: {
        getEntriesByType: () => [{ name: entryUrl }],
      },
    });
  }

  it("configures before waiting for SDK readiness and waits before resolving", async () => {
    let succeed: (() => void) | undefined;
    let readyCallback: (() => void) | undefined;
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) => {
      succeed = () => options.onSuccess?.({});
    });
    const ready = vi.fn((callback: () => void) => {
      readyCallback = callback;
    });
    const resolved = vi.fn();
    const pending = configureLarkJsapi({ config, ready }, authConfig).then(
      resolved,
    );

    expect(config).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
    succeed!();
    expect(ready).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(resolved).not.toHaveBeenCalled();
    readyCallback!();
    await pending;
    expect(resolved).toHaveBeenCalledTimes(1);
  });

  it.each(["errorCode", "errCode", "errno"])(
    "preserves the JSAPI %s without exposing signature diagnostics",
    async (field) => {
      const config: NonNullable<LarkH5Sdk["config"]> = (options) => {
        options.onFail?.({
          [field]: "333441",
          errorMessage:
            "invalid signature: jsticket: secret-ticket, signature: secret-signature",
        });
      };
      const error = await configureLarkJsapi({ config }, authConfig).catch(
        (reason: unknown) => reason,
      );
      expect(error).toMatchObject({ errno: 333441 });
      expect(error).toHaveProperty(
        "message",
        expect.stringContaining("333441"),
      );
      expect(error).toHaveProperty(
        "message",
        expect.not.stringContaining("secret"),
      );
    },
  );

  it("re-signs the document entry URL after a signature failure following SPA navigation", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    const config = vi
      .fn<NonNullable<LarkH5Sdk["config"]>>()
      .mockImplementationOnce((options) =>
        options.onFail?.({ errorCode: 333441 }),
      )
      .mockImplementationOnce((options) => options.onSuccess?.({}));

    await configureLarkPageJsapi({ config }, getConfig);

    expect(getConfig.mock.calls).toEqual([
      ["https://shop.example.com/shop"],
      ["https://shop.example.com/?source=workplace"],
    ]);
    expect(config).toHaveBeenCalledTimes(2);
  });

  it("does not retry domain configuration failures", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    const config: NonNullable<LarkH5Sdk["config"]> = (options) =>
      options.onFail?.({ errorCode: 333448 });

    await expect(configureLarkPageJsapi({ config }, getConfig)).rejects.toThrow(
      "H5 可信域名",
    );
    expect(getConfig).toHaveBeenCalledTimes(1);
  });

  it("shares concurrent page authorization and reuses it without caching signatures", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    let succeed!: () => void;
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) => {
      succeed = () => options.onSuccess?.({});
    });
    const sdk = { config };
    const first = configureLarkPageJsapi(sdk, getConfig);
    const second = configureLarkPageJsapi(sdk, getConfig);
    await vi.waitFor(() => expect(config).toHaveBeenCalledOnce());
    succeed();
    await Promise.all([first, second]);
    await configureLarkPageJsapi(sdk, getConfig);
    expect(getConfig).toHaveBeenCalledOnce();
    expect(config).toHaveBeenCalledOnce();
  });

  it("preserves existing API authorization when expanding the list and signs a changed page", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) =>
      options.onSuccess?.({}),
    );
    const sdk = { config };
    await configureLarkPageJsapi(sdk, getConfig);
    await configureLarkPageJsapi(sdk, getConfig, ["tt.enterChat"]);
    await configureLarkPageJsapi(sdk, getConfig);
    expect(config).toHaveBeenCalledTimes(2);
    expect(config).toHaveBeenLastCalledWith(
      expect.objectContaining({ jsApiList: ["tt.scanCode", "tt.enterChat"] }),
    );
    window.location.href = "https://shop.example.com/profile";
    await configureLarkPageJsapi(sdk, getConfig);
    expect(getConfig).toHaveBeenLastCalledWith(
      "https://shop.example.com/profile",
    );
    expect(config).toHaveBeenCalledTimes(3);
    await configureLarkPageJsapi({ config }, getConfig);
    expect(config).toHaveBeenCalledTimes(4);
  });

  it("does not cache failed authorization", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    const config = vi
      .fn<NonNullable<LarkH5Sdk["config"]>>()
      .mockImplementationOnce((options) => options.onFail?.({ errno: 333444 }))
      .mockImplementationOnce((options) => options.onSuccess?.({}));
    const sdk = { config };
    await expect(configureLarkPageJsapi(sdk, getConfig)).rejects.toThrow(
      "已过期",
    );
    await configureLarkPageJsapi(sdk, getConfig);
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it("serializes concurrent expansion of different API permissions", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    let finish!: () => void;
    const config = vi
      .fn<NonNullable<LarkH5Sdk["config"]>>()
      .mockImplementationOnce((options) => {
        finish = () => options.onSuccess?.({});
      })
      .mockImplementation((options) => options.onSuccess?.({}));
    const sdk = { config };
    const scan = configureLarkPageJsapi(sdk, getConfig);
    const chat = configureLarkPageJsapi(sdk, getConfig, ["tt.enterChat"]);
    await vi.waitFor(() => expect(config).toHaveBeenCalledOnce());
    finish();
    await Promise.all([scan, chat]);
    expect(config).toHaveBeenCalledTimes(2);
    expect(config).toHaveBeenLastCalledWith(
      expect.objectContaining({ jsApiList: ["tt.scanCode", "tt.enterChat"] }),
    );
  });

  it("shares reauthorization when two native operations reject the same cached authorization", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) =>
      options.onSuccess?.({}),
    );
    const failures: Array<() => void> = [];
    const enterChat = vi
      .fn<NonNullable<LarkClientApi["enterChat"]>>()
      .mockImplementationOnce((options) => {
        failures.push(() => options.fail({ errno: 105 }));
      })
      .mockImplementationOnce((options) => {
        failures.push(() => options.fail({ errno: 105 }));
      })
      .mockImplementation((options) => options.success({}));
    const sdk = { config };
    const operation = () => enterLarkChat({ enterChat }, "ou_test");
    const first = withLarkPageJsapi(sdk, getConfig, operation, [
      "tt.enterChat",
    ]);
    const second = withLarkPageJsapi(sdk, getConfig, operation, [
      "tt.enterChat",
    ]);
    await vi.waitFor(() => expect(failures).toHaveLength(2));
    failures.forEach((fail) => fail());
    await Promise.all([first, second]);
    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(enterChat).toHaveBeenCalledTimes(4);
  });

  it.each([105, 333442, 333444, 333445])(
    "refreshes authorization once after native API auth failure %s",
    async (errno) => {
      stubPage();
      const getConfig = vi.fn(async () => ({
        ...authConfig,
        nonceStr: String(getConfig.mock.calls.length),
      }));
      const config = vi.fn<NonNullable<LarkH5Sdk["config"]>>((options) =>
        options.onSuccess?.({}),
      );
      const scanCode = vi
        .fn<NonNullable<LarkClientApi["scanCode"]>>()
        .mockImplementationOnce((options) =>
          options.fail({ errorCode: String(errno) }),
        )
        .mockImplementationOnce((options) =>
          options.success({ result: "0690001" }),
        );
      const sdk = { config };
      await configureLarkPageJsapi(sdk, getConfig);
      await expect(
        withLarkPageJsapi(sdk, getConfig, () => scanLarkBarcode({ scanCode })),
      ).resolves.toBe("0690001");
      expect(getConfig).toHaveBeenCalledTimes(2);
      expect(scanCode).toHaveBeenCalledTimes(2);
    },
  );

  it.each([1505002, 333448, 123])(
    "does not reauthorize or repeat native operations after error %s",
    async (errno) => {
      stubPage();
      const getConfig = vi.fn(async () => authConfig);
      const config: NonNullable<LarkH5Sdk["config"]> = (options) =>
        options.onSuccess?.({});
      const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>(
        (options) => options.fail({ errno }),
      );
      await expect(
        withLarkPageJsapi({ config }, getConfig, () =>
          scanLarkBarcode({ scanCode }),
        ),
      ).rejects.toMatchObject({ errno });
      expect(getConfig).toHaveBeenCalledOnce();
      expect(scanCode).toHaveBeenCalledOnce();
    },
  );

  it("stops after one native authorization retry", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    const config: NonNullable<LarkH5Sdk["config"]> = (options) =>
      options.onSuccess?.({});
    const scanCode = vi.fn<NonNullable<LarkClientApi["scanCode"]>>((options) =>
      options.fail({ errno: 333444 }),
    );
    const sdk = { config };
    await expect(
      withLarkPageJsapi(sdk, getConfig, () => scanLarkBarcode({ scanCode })),
    ).rejects.toMatchObject({ errno: 333444 });
    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(scanCode).toHaveBeenCalledTimes(2);
    await configureLarkPageJsapi(sdk, getConfig);
    expect(getConfig).toHaveBeenCalledTimes(3);
  });

  it("handles the SDK config promise rejection without exposing its diagnostics", async () => {
    const config: NonNullable<LarkH5Sdk["config"]> = () =>
      Promise.reject({
        errorCode: 333442,
        errorMessage: "jsticket: secret-ticket",
      });

    await expect(configureLarkJsapi({ config }, authConfig)).rejects.toThrow(
      "飞书 JSAPI 票据无效，请稍后重试（错误码：333442）",
    );
  });

  it.each([
    "https://shop.example.com/shop",
    "https://untrusted.example.com/",
    "https://user:secret@shop.example.com/",
    "not-a-url",
  ])(
    "does not retry an unchanged or unsafe document URL %s",
    async (entryUrl) => {
      stubPage(entryUrl);
      const getConfig = vi.fn(async () => authConfig);
      const config: NonNullable<LarkH5Sdk["config"]> = (options) =>
        options.onFail?.({ errorCode: 333441 });

      await expect(
        configureLarkPageJsapi({ config }, getConfig),
      ).rejects.toThrow("333441");
      expect(getConfig).toHaveBeenCalledTimes(1);
    },
  );

  it("stops after one entry URL retry", async () => {
    stubPage();
    const getConfig = vi.fn(async () => authConfig);
    const config: NonNullable<LarkH5Sdk["config"]> = (options) =>
      options.onFail?.({ errorCode: 333441 });

    await expect(configureLarkPageJsapi({ config }, getConfig)).rejects.toThrow(
      "333441",
    );
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

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
