import { ApiConfigurationError } from "./errors";

export type DataSource = "mock" | "local" | "remote";

export interface CurrentUser {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface ServiceOptions {
  dataSource?: DataSource;
  connectBaseUrl?: string;
  fetch?: typeof globalThis.fetch; // 可自定义fetch实现（用于拦截、mock、适配SSR）
  currentUser?: CurrentUser;
  requiresAuthenticatedUser?: boolean;  // 是否要求必须携带登录用户
}
// 优先传入调用方传入的options.dataSource；
export function resolveDataSource(options: ServiceOptions = {}): DataSource {
  return options.dataSource ?? "mock"; //不传则默认兜底为 "mock" 模拟模式。
}

export function resolveConnectBaseUrl(options: ServiceOptions = {}): string {
  const baseUrl =
    options.connectBaseUrl ?? process.env.NEXT_PUBLIC_CONNECT_BASE_URL;

  if (!baseUrl) {
    throw new ApiConfigurationError("NEXT_PUBLIC_CONNECT_BASE_URL");
  }

  return baseUrl;
}
