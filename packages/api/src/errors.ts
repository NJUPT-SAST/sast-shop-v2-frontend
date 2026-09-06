import { ConnectError } from "@connectrpc/connect";

//功能不可用
export class FeatureUnavailableError extends Error {
  constructor(feature: string) {
    super(`${feature} is not available for the selected data source`);
    this.name = "FeatureUnavailableError";
  }
}
//接口网络或请求层面失败
export class ApiRequestError extends Error {
  constructor(feature: string, cause?: unknown) {
    // 优先透出后端返回的错误文案（ConnectError.rawMessage），后端文案缺失时回退通用提示
    const backendMessage =
      cause instanceof ConnectError && cause.rawMessage
        ? cause.rawMessage
        : `${feature} request failed`;
    super(backendMessage, { cause }); //支持传入原始底层错误（fetch 失败、axios 异常）
    this.name = "ApiRequestError";
  }
}
//目标资源不存在
export class ResourceNotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} was not found`);
    this.name = "ResourceNotFoundError";
  }
}
//缺少必要配置项飞书 appId、connectBaseUrl
export class ApiConfigurationError extends Error {
  constructor(key: string) {
    super(`${key} must be configured`);
    this.name = "ApiConfigurationError";
  }
}
// 需要登录，绘画失效
//后端会话过期时抛出该异常，前端统一拦截做登录跳转。
export class AuthRequiredError extends Error {
  //捕获到此异常 → 派发 sast-shop:session-expired 全局事件 → 页面自动触发重新登录。
  static readonly browserEventName = "sast-shop:session-expired";

  constructor() {
    super("Authentication is required");
    this.name = "AuthRequiredError";
  }
}
//数据校验失败
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
