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

export class LoginConfigurationError extends Error {
  constructor() {
    super("Authentication service is not configured");
    this.name = "LoginConfigurationError";
  }
}

export class LoginRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many login attempts");
    this.name = "LoginRateLimitedError";
  }
}

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

  const permit = loginExchangeGuard.tryAcquire();
  if (!permit.allowed) {
    throw new LoginRateLimitedError(permit.retryAfterSeconds);
  }

  try {
    const session = await loginWithLarkCode(code, {
      dataSource: desktopAppConfig.dataSource,
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
  } catch {
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
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(session.expiresAt),
  } as const;

  response.cookies.set(sessionCookieName, session.sessionToken, cookieOptions);
  response.cookies.set(
    sessionUserCookieName,
    sessionUserCookie,
    cookieOptions,
  );
}

export function clearDesktopAuthSessionCookies(response: NextResponse) {
  const expiredCookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  } as const;

  response.cookies.set(sessionCookieName, "", expiredCookieOptions);
  response.cookies.set(sessionUserCookieName, "", expiredCookieOptions);
}
