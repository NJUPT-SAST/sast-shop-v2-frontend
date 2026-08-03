import { type NextRequest, NextResponse } from "next/server";

import {
  createDesktopAuthSessionFromLarkCode,
  LoginConfigurationError,
  LoginRateLimitedError,
  setDesktopAuthSessionCookies,
} from "@/lib/auth-session";
import { createAuthErrorResponse } from "@/lib/auth-error-response";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import {
  feishuOAuthStateCookieName,
  feishuOAuthStateCookiePath,
  isFreshFeishuOAuthState,
  parseFeishuOAuthState,
} from "@/lib/feishu-oauth";
import { getFeishuOAuthConfig } from "@/lib/feishu-oauth-config";

const maxCodeLength = 4096;
// 如果是required直接重定向到/shop
export async function GET(request: NextRequest) {
  if (getServerAuthMode() !== "required") {
    return NextResponse.redirect(new URL("/shop", request.nextUrl.origin));
  }

  if (request.nextUrl.searchParams.has("error")) {
    return clearStateCookie(
      createAuthErrorResponse({
        title: "飞书授权未完成",
        description: "飞书没有返回可用的授权码，请重新发起登录。",
        status: 400,
      }),
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code?.trim() || code.length > maxCodeLength) {
    return clearStateCookie(
      createAuthErrorResponse({
        title: "授权码无效",
        description: "飞书回调缺少有效授权码，请重新发起登录。",
        status: 400,
      }),
    );
  }

  const state = request.nextUrl.searchParams.get("state") ?? "";
  const storedState = request.cookies.get(feishuOAuthStateCookieName)?.value;
  const parsedState = parseFeishuOAuthState(state);
  // if (
  //   !storedState ||
  //   state !== storedState ||
  //   !parsedState ||
  //   !isFreshFeishuOAuthState(parsedState)
  // ) {
  //   return clearStateCookie(
  //     createAuthErrorResponse({
  //       title: "登录状态已失效",
  //       description: "为了保护账号安全，请重新发起飞书登录。",
  //       status: 400,
  //     }),
  //   );
  // }

  let config;
  let configuredRedirectOrigin = "";
  try {
    config = getFeishuOAuthConfig();
    const configuredRedirectUri = new URL(config.redirectUri);
    configuredRedirectOrigin = configuredRedirectUri.origin;
    if (
      configuredRedirectUri.origin !== desktopAppConfig.appOrigin ||
      configuredRedirectUri.pathname !== request.nextUrl.pathname
    ) {
      throw new Error("Mismatched OAuth callback URL");
    }
  } catch {
    return clearStateCookie(
      createAuthErrorResponse({
        title: "登录配置不可用",
        description:
          "飞书 OAuth 参数未正确配置，请联系管理员检查应用 ID 和回调地址。",
        status: 500,
      }),
    );
  }

  try {
    const { session, sessionUserCookie } =
      await createDesktopAuthSessionFromLarkCode(code.trim(), {
        redirectUri: config.redirectUri,
      });
    const response = NextResponse.redirect(
      new URL(parsedState.returnTo, configuredRedirectOrigin),
    );
    setDesktopAuthSessionCookies(response, session, sessionUserCookie);
    return clearStateCookie(response);
  } catch (error) {
    if (error instanceof LoginRateLimitedError) {
      const response = createAuthErrorResponse({
        title: "登录请求过于频繁",
        description: `请 ${error.retryAfterSeconds} 秒后再重试。`,
        status: 429,
      });
      response.headers.set("retry-after", String(error.retryAfterSeconds));
      return clearStateCookie(response);
    }

    return clearStateCookie(
      createAuthErrorResponse({
        title:
          error instanceof LoginConfigurationError
            ? "登录服务不可用"
            : "登录会话建立失败",
        description:
          error instanceof LoginConfigurationError
            ? "后端登录服务未正确配置，请联系管理员处理。"
            : "飞书授权码交换失败，请重新发起登录。",
        status: error instanceof LoginConfigurationError ? 500 : 401,
      }),
    );
  }
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(feishuOAuthStateCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      desktopAppConfig.appOrigin.startsWith("https://"),
    path: feishuOAuthStateCookiePath,
    expires: new Date(0),
  });
  return response;
}
