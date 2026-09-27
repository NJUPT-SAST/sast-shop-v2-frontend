import { type NextRequest, NextResponse } from "next/server";

import { createAuthErrorResponse } from "@/lib/auth-error-response";
import { getServerAuthMode } from "@/lib/auth-mode";
import {
  createFeishuOAuthAuthorizeUrl,
  createFeishuOAuthState,
  feishuOAuthStateCookieName,
  feishuOAuthStateCookiePath,
  feishuOAuthStateMaxAgeSeconds,
  normalizeAuthReturnTo,
} from "@/lib/feishu-oauth";
import { getFeishuOAuthConfig } from "@/lib/feishu-oauth-config";
import { desktopAppConfig } from "@/lib/app-config";

export async function GET(request: NextRequest) {
  const returnTo = normalizeAuthReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
  );

  if (getServerAuthMode() !== "required") {
    return NextResponse.redirect(new URL(returnTo, desktopAppConfig.appOrigin));
  }

  let destination: URL;
  let state: string;
  try {
    state = createFeishuOAuthState(returnTo);
    destination = createFeishuOAuthAuthorizeUrl(getFeishuOAuthConfig(), state);
  } catch {
    return createAuthErrorResponse({
      title: "登录配置不可用",
      description:
        "飞书 OAuth 参数未正确配置，请联系管理员检查应用 ID 和回调地址。",
      status: 500,
    });
  }

  const response = NextResponse.redirect(destination);
  response.cookies.set(feishuOAuthStateCookieName, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: feishuOAuthStateCookiePath,
    maxAge: feishuOAuthStateMaxAgeSeconds,
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
