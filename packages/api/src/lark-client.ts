import type { JSAPIAuthConfig } from "./services/auth"

export interface LarkCallbackResult {
  code?: string
  result?: string
  errno?: number
  errString?: string
  errMsg?: string
}

type LarkCallback = (result: LarkCallbackResult) => void
const larkClientTimeoutMs = 15_000
const scanCancelledErrno = 1_505_002

export class LarkClientError extends Error {
  constructor(message: string, readonly errno?: number) {
    super(message)
    this.name = "LarkClientError"
  }
}

export interface LarkClientApi {
  requestAccess?: (options: {
    appID: string
    scopeList: string[]
    success: LarkCallback
    fail: LarkCallback
  }) => void
  requestAuthCode?: (options: {
    appId: string
    success: LarkCallback
    fail: LarkCallback
  }) => void
  scanCode?: (options: {
    scanType: ["barCode"]
    barCodeInput: boolean
    success: LarkCallback
    fail: LarkCallback
  }) => void
}

export interface LarkH5Sdk {
  ready?: (callback: () => void) => void
  config?: (options: Omit<JSAPIAuthConfig, "timestamp"> & {
    timestamp: number
    jsApiList: ["tt.scanCode"]
    onSuccess?: (result: unknown) => void
    onFail?: (result: unknown) => void
  }) => void
}

export function requestLarkAuthorizationCode(
  client: LarkClientApi,
  appId: string,
): Promise<string> {
  if (client.requestAccess) {
    return createLarkPromise("飞书免登录授权超时，请稍后重试", (resolve, reject) => {
      client.requestAccess?.({
        appID: appId,
        scopeList: [],
        success: (result) => settleAuthorization(result, resolve, reject),
        fail: (result) => {
          if (result.errno === 103) {
            requestLegacyAuthorizationCode(client, appId).then(resolve, reject)
            return
          }
          reject(createLarkError(result, "飞书免登录授权失败，请稍后重试"))
        },
      })
    })
  }

  return requestLegacyAuthorizationCode(client, appId)
}

export function configureLarkJsapi(
  sdk: LarkH5Sdk,
  config: JSAPIAuthConfig,
): Promise<void> {
  const timestamp = Number(config.timestamp)
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
    return Promise.reject(new Error("飞书扫码鉴权参数无效，请重新打开应用"))
  }

  return createLarkPromise("飞书扫码鉴权超时，请重新打开应用", (resolve, reject) => {
    if (!sdk.config) {
      reject(new Error("当前飞书客户端不支持扫码鉴权，请升级后重试"))
      return
    }

    const configure = () => {
      sdk.config?.({
        ...config,
        timestamp,
        jsApiList: ["tt.scanCode"],
        onSuccess: () => resolve(),
        onFail: () => reject(new Error("飞书扫码鉴权失败，请重新打开应用")),
      })
    }

    if (sdk.ready) sdk.ready(configure)
    else configure()
  })
}

export function scanLarkBarcode(client: LarkClientApi): Promise<string> {
  return createLarkPromise("扫码超时，请重试或手动输入", (resolve, reject) => {
    if (!client.scanCode) {
      reject(new Error("当前飞书客户端不支持扫码，请升级后重试"))
      return
    }

    client.scanCode({
      scanType: ["barCode"],
      barCodeInput: true,
      success: (result) => {
        const barcode = result.result?.trim() ?? ""
        if (!/^\d+$/.test(barcode) || barcode.length > 64) {
          reject(new Error("扫描结果不是有效商品条码，请手动输入"))
          return
        }
        resolve(barcode)
      },
      fail: (result) =>
        reject(createLarkError(result, "扫码失败，请重试或手动输入")),
    })
  })
}

export function waitForLarkReady(sdk: LarkH5Sdk): Promise<void> {
  return createLarkPromise("飞书客户端初始化超时，请重新打开应用", (resolve, reject) => {
    if (!sdk.ready) {
      reject(new Error("当前飞书客户端不支持免登录，请升级后重试"))
      return
    }
    sdk.ready(resolve)
  })
}

export function isLarkScanCancelledError(reason: unknown): boolean {
  return reason instanceof LarkClientError && reason.errno === scanCancelledErrno
}

function requestLegacyAuthorizationCode(
  client: LarkClientApi,
  appId: string,
): Promise<string> {
  return createLarkPromise("飞书免登录授权超时，请稍后重试", (resolve, reject) => {
    if (!client.requestAuthCode) {
      reject(new Error("当前飞书客户端不支持免登录，请升级后重试"))
      return
    }
    client.requestAuthCode({
      appId,
      success: (result) => settleAuthorization(result, resolve, reject),
      fail: (result) =>
        reject(createLarkError(result, "飞书免登录授权失败，请稍后重试")),
    })
  })
}

function settleAuthorization(
  result: LarkCallbackResult,
  resolve: (code: string) => void,
  reject: (reason: Error) => void,
) {
  if (result.code?.trim()) resolve(result.code.trim())
  else reject(createLarkError(result, "飞书免登录授权失败，请稍后重试"))
}

function createLarkError(result: LarkCallbackResult, fallback: string) {
  return new LarkClientError(
    result.errString?.trim() || result.errMsg?.trim() || fallback,
    result.errno,
  )
}

function createLarkPromise<T>(
  timeoutMessage: string,
  run: (
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void,
  ) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(
      () => finishReject(new Error(timeoutMessage)),
      larkClientTimeoutMs,
    )

    function finishResolve(value: T | PromiseLike<T>) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }

    function finishReject(reason?: unknown) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(reason)
    }

    try {
      run(finishResolve, finishReject)
    } catch (reason) {
      finishReject(reason)
    }
  })
}
