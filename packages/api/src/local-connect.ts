import { Code, ConnectError } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { resolveConnectBaseUrl, type ServiceOptions } from "./data-source";
import {
  ApiRequestError,
  AuthRequiredError,
  ResourceNotFoundError,
} from "./errors";
// 创建RPC网络传输层
export function createLocalTransport(options: ServiceOptions = {}) {
  return createConnectTransport({
    baseUrl: resolveConnectBaseUrl(options),
    defaultTimeoutMs: 15_000,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}
// RPC统一一场拦截包装器
export async function requestLocal<T>(
  feature: string,
  request: () => Promise<T>,
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    const connectError = ConnectError.from(error);

    if (connectError.code === Code.Unauthenticated) {  // 401未登录/绘画过期
      if (typeof window !== "undefined") { // 如果是浏览器
        window.dispatchEvent(new Event(AuthRequiredError.browserEventName));  // 触发自动登录
      }
      throw new AuthRequiredError();
    }

    if (connectError.code === Code.NotFound) {
      throw new ResourceNotFoundError(feature);
    }

    throw new ApiRequestError(feature, error);
  }
}
