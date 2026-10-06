import type { JSAPIAuthConfig } from "./services/auth";

export interface LarkCallbackResult {
  code?: string;
  result?: string;
  errno?: number;
  errString?: string;
  errMsg?: string;
}

type LarkCallback = (result: LarkCallbackResult) => void;
export type LarkJsapiName = "tt.enterChat" | "tt.scanCode";
const larkClientTimeoutMs = 15_000;
const scanCancelledErrno = 1_505_002;

export class LarkClientError extends Error {
  constructor(
    message: string,
    readonly errno?: number,
  ) {
    super(message);
    this.name = "LarkClientError";
  }
}

export interface LarkClientApi {
  requestAccess?: (options: {
    appID: string;
    scopeList: string[];
    success: LarkCallback;
    fail: LarkCallback;
  }) => void;
  requestAuthCode?: (options: {
    appId: string;
    success: LarkCallback;
    fail: LarkCallback;
  }) => void;
  scanCode?: (options: {
    scanType: ["barCode"];
    barCodeInput: boolean;
    success: LarkCallback;
    fail: LarkCallback;
  }) => void;
  enterChat?: (options: {
    openid: string;
    success: LarkCallback;
    fail: LarkCallback;
  }) => void;
}

export interface LarkH5Sdk {
  browser?: {
    versions?: {
      PCFeishu?: boolean;
      mobileFeishu?: boolean;
    };
  };
  ready?: (callback: () => void) => void;
  config?: (
    options: Omit<JSAPIAuthConfig, "timestamp"> & {
      timestamp: number;
      jsApiList: LarkJsapiName[];
      onSuccess?: (result: unknown) => void;
      onFail?: (result: unknown) => void;
    },
  ) => void | Promise<unknown>;
}

export function isLarkClientEnvironment(
  sdk: LarkH5Sdk | undefined,
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
): boolean {
  const versions = sdk?.browser?.versions;
  return Boolean(
    versions?.PCFeishu ||
    versions?.mobileFeishu ||
    /(?:Lark|Feishu)(?:-staging|-prerelease|-oversea)?\/[\d.]+/i.test(
      userAgent,
    ),
  );
}

export function isLarkMobileClientEnvironment(
  sdk: LarkH5Sdk | undefined,
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
): boolean {
  return Boolean(
    sdk?.browser?.versions?.mobileFeishu ||
    (isLarkClientEnvironment(undefined, userAgent) &&
      /Android|Mobile|iPhone|iPad|iPod|iOS/i.test(userAgent)),
  );
}

export function subscribeLarkEnvironment(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  document.addEventListener("load", onChange, true);
  window.addEventListener("pageshow", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    document.removeEventListener("load", onChange, true);
    window.removeEventListener("pageshow", onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function requestLarkAuthorizationCode(
  client: LarkClientApi,
  appId: string,
): Promise<string> {
  if (client.requestAccess) {
    return createLarkPromise(
      "飞书免登录授权超时，请稍后重试",
      (resolve, reject) => {
        client.requestAccess?.({
          appID: appId,
          scopeList: [],
          success: (result) => settleAuthorization(result, resolve, reject),
          fail: (result) => {
            if (result.errno === 103) {
              requestLegacyAuthorizationCode(client, appId).then(
                resolve,
                reject,
              );
              return;
            }
            reject(createLarkError(result, "飞书免登录授权失败，请稍后重试"));
          },
        });
      },
    );
  }

  return requestLegacyAuthorizationCode(client, appId);
}

export function configureLarkJsapi(
  sdk: LarkH5Sdk,
  config: JSAPIAuthConfig,
  jsApiList: LarkJsapiName[] = ["tt.scanCode"],
): Promise<void> {
  const timestamp = Number(config.timestamp);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return Promise.reject(new Error("飞书 JSAPI 鉴权参数无效，请重新打开应用"));
  }

  return createLarkPromise(
    "飞书 JSAPI 鉴权超时，请重新打开应用",
    (resolve, reject) => {
      if (!sdk.config) {
        reject(new Error("当前飞书客户端不支持 JSAPI 鉴权，请升级后重试"));
        return;
      }

      const configuring = sdk.config({
        ...config,
        timestamp,
        jsApiList,
        onSuccess: () => {
          if (sdk.ready) sdk.ready(() => resolve());
          else resolve();
        },
        onFail: (result) => reject(createJsapiAuthError(result)),
      });
      void Promise.resolve(configuring).catch((result: unknown) =>
        reject(createJsapiAuthError(result)),
      );
    },
  );
}

export async function configureLarkPageJsapi(
  sdk: LarkH5Sdk,
  getConfig: (signingUrl: string) => Promise<JSAPIAuthConfig>,
  jsApiList: LarkJsapiName[] = ["tt.scanCode"],
): Promise<void> {
  const signingUrl = window.location.href.split("#", 1)[0] ?? "";
  const navigation = window.performance.getEntriesByType?.("navigation")[0];
  let entryUrl: string | undefined;
  if (navigation?.name) {
    try {
      const url = new URL(navigation.name);
      if (
        url.origin === window.location.origin &&
        !url.username &&
        !url.password
      ) {
        url.hash = "";
        entryUrl = url.href;
      }
    } catch {
      entryUrl = undefined;
    }
  }

  try {
    await configureLarkJsapi(sdk, await getConfig(signingUrl), jsApiList);
  } catch (reason) {
    if (
      !(reason instanceof LarkClientError) ||
      reason.errno !== 333441 ||
      !entryUrl ||
      entryUrl === signingUrl
    ) {
      throw reason;
    }
    // Native URL validation may retain the document URL across SPA navigation.
    await configureLarkJsapi(sdk, await getConfig(entryUrl), jsApiList);
  }
}

function createJsapiAuthError(result: unknown): LarkClientError {
  const fields =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : {};
  const code = fields.errorCode ?? fields.errCode ?? fields.errno;
  const errno =
    (typeof code === "number" ||
      (typeof code === "string" && /^\d+$/.test(code))) &&
    Number.isSafeInteger(Number(code))
      ? Number(code)
      : undefined;
  const messages: Record<number, string> = {
    333441: "飞书 JSAPI 签名校验失败，请重新打开应用",
    333442: "飞书 JSAPI 票据无效，请稍后重试",
    333443: "飞书 JSAPI 签名已使用，请重试",
    333444: "飞书 JSAPI 签名已过期，请重试",
    333447: "飞书应用尚未配置 H5 可信域名，请联系管理员",
    333448: "当前地址不在飞书应用的 H5 可信域名内，请联系管理员",
    333449: "当前账号不在飞书应用的可用范围内，请联系管理员",
  };
  const message =
    (errno === undefined ? undefined : messages[errno]) ??
    "飞书 JSAPI 鉴权失败，请重新打开应用";
  return new LarkClientError(
    errno === undefined ? message : `${message}（错误码：${errno}）`,
    errno,
  );
}

export function enterLarkChat(
  client: LarkClientApi,
  openId: string,
): Promise<void> {
  const normalizedOpenId = openId.trim();
  if (!/^ou_[A-Za-z0-9_-]+$/.test(normalizedOpenId)) {
    return Promise.reject(new Error("联系人飞书标识无效，请稍后重试"));
  }

  return createLarkPromise(
    "打开飞书会话超时，请稍后重试",
    (resolve, reject) => {
      if (!client.enterChat) {
        reject(new Error("当前飞书客户端不支持打开会话，请升级后重试"));
        return;
      }

      client.enterChat({
        openid: normalizedOpenId,
        success: () => resolve(),
        fail: (result) =>
          reject(createLarkError(result, "打开飞书会话失败，请稍后重试")),
      });
    },
  );
}

export function scanLarkBarcode(client: LarkClientApi): Promise<string> {
  return createLarkPromise("扫码超时，请重试或手动输入", (resolve, reject) => {
    if (!client.scanCode) {
      reject(new Error("当前飞书客户端不支持扫码，请升级后重试"));
      return;
    }

    client.scanCode({
      scanType: ["barCode"],
      barCodeInput: true,
      success: (result) => {
        const barcode = result.result?.trim() ?? "";
        if (!/^\d+$/.test(barcode) || barcode.length > 64) {
          reject(new Error("扫描结果不是有效商品条码，请手动输入"));
          return;
        }
        resolve(barcode);
      },
      fail: (result) =>
        reject(createLarkError(result, "扫码失败，请重试或手动输入")),
    });
  });
}

export function waitForLarkReady(sdk: LarkH5Sdk): Promise<void> {
  return createLarkPromise(
    "飞书客户端初始化超时，请重新打开应用",
    (resolve, reject) => {
      if (!sdk.ready) {
        reject(new Error("当前飞书客户端不支持免登录，请升级后重试"));
        return;
      }
      sdk.ready(resolve);
    },
  );
}

export function isLarkScanCancelledError(reason: unknown): boolean {
  return (
    reason instanceof LarkClientError && reason.errno === scanCancelledErrno
  );
}

function requestLegacyAuthorizationCode(
  client: LarkClientApi,
  appId: string,
): Promise<string> {
  return createLarkPromise(
    "飞书免登录授权超时，请稍后重试",
    (resolve, reject) => {
      if (!client.requestAuthCode) {
        reject(new Error("当前飞书客户端不支持免登录，请升级后重试"));
        return;
      }
      client.requestAuthCode({
        appId,
        success: (result) => settleAuthorization(result, resolve, reject),
        fail: (result) =>
          reject(createLarkError(result, "飞书免登录授权失败，请稍后重试")),
      });
    },
  );
}

function settleAuthorization(
  result: LarkCallbackResult,
  resolve: (code: string) => void,
  reject: (reason: Error) => void,
) {
  if (result.code?.trim()) resolve(result.code.trim());
  else reject(createLarkError(result, "飞书免登录授权失败，请稍后重试"));
}

function createLarkError(result: LarkCallbackResult, fallback: string) {
  return new LarkClientError(
    result.errString?.trim() || result.errMsg?.trim() || fallback,
    result.errno,
  );
}

function createLarkPromise<T>(
  timeoutMessage: string,
  run: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
  ) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(
      () => finishReject(new Error(timeoutMessage)),
      larkClientTimeoutMs,
    );

    function finishResolve(value: T | PromiseLike<T>) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }

    function finishReject(reason?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(reason);
    }

    try {
      run(finishResolve, finishReject);
    } catch (reason) {
      finishReject(reason);
    }
  });
}
