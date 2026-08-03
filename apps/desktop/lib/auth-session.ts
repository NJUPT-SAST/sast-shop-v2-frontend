import "server-only";

import { loginWithLarkCode, type AuthSession } from "@sast-shop/api";
import {
  createSessionUserCookie,
  getSessionCookieSecret,
  loginExchangeGuard,
  sessionCookieName,
  sessionUserCookieName,
} from "@sast-shop/api/server";
import type { NextResponse } from "next/server";

import { desktopAppConfig } from "@/lib/app-config";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";
//认证服务未配置
export class LoginConfigurationError extends Error {
  constructor() {
    super("Authentication service is not configured");
    this.name = "LoginConfigurationError";
  }
}
//登录次数过多
export class LoginRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many login attempts");
    this.name = "LoginRateLimitedError";
  }
}
//授权码交换失败
export class LoginExchangeError extends Error {
  constructor() {
    super("Authorization code exchange failed");
    this.name = "LoginExchangeError";
  }
}

export async function createDesktopAuthSessionFromLarkCode(
  code: string,
  options: { redirectUri?: string } = {},
): Promise<{
  session: AuthSession;
  sessionUserCookie: string;
}> {
  let connectBaseUrl: string;
  let sessionSecret: string;
  try {
    connectBaseUrl = getServerConnectBaseUrl();
    sessionSecret = getSessionCookieSecret();
  } catch {
    throw new LoginConfigurationError();
  }
  // 速率限制检查
  const permit = loginExchangeGuard.tryAcquire();
  if (!permit.allowed) {
    throw new LoginRateLimitedError(permit.retryAfterSeconds);
  }

  try {
    // 授权码交换
    const session = await loginWithLarkCode(code, {
      dataSource: desktopAppConfig.dataSource,  // 数据源pc端
      connectBaseUrl,
      redirectUri: options.redirectUri,
    });
    return {
      session,
      sessionUserCookie: await createSessionUserCookie(
        session.user,
        session.sessionToken,
        session.expiresAt,
        sessionSecret,
      ),
    };
  }  catch (error) {
  console.error("[oauth] login exchange failed", {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error ? error.cause : undefined,
    dataSource: desktopAppConfig.dataSource,
    redirectUri: options.redirectUri,
    connectBaseUrl,
  });

  throw new LoginExchangeError();
} finally {
    permit.release();
  }
}

export function setDesktopAuthSessionCookies(
  response: NextResponse,
  session: AuthSession,
  sessionUserCookie: string,
) {
  const cookieOptions = {
    httpOnly: true, //防止xss
    sameSite: "lax",  // 防止csrf
    secure:
      process.env.NODE_ENV === "production" ||
      desktopAppConfig.appOrigin.startsWith("https://"), // ngrok内网穿透用
      // 服务器执行 npm run start（生产启动）时，Cookie 自动带上 Secure 标记（仅 HTTPS）
    path: "/",
    expires: new Date(session.expiresAt),
  } as const;

  response.cookies.set(sessionCookieName, session.sessionToken, cookieOptions);
  response.cookies.set(sessionUserCookieName, sessionUserCookie, cookieOptions);
}

export function clearDesktopAuthSessionCookies(response: NextResponse) {
  const expiredCookieOptions = {
    httpOnly: true, //防止xss
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      desktopAppConfig.appOrigin.startsWith("https://"),
    path: "/",
    expires: new Date(0),
  } as const;

  response.cookies.set(sessionCookieName, "", expiredCookieOptions);
  response.cookies.set(sessionUserCookieName, "", expiredCookieOptions);
}
