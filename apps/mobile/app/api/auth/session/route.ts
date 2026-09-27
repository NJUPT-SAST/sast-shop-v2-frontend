import { isSameOriginRequest } from "@/lib/request-origin";
import { loginWithLarkCode } from "@sast-shop/api";
import {
  createSessionUserCookie,
  getSessionCookieSecret,
  loginExchangeGuard,
  readSessionUserCookie,
  sessionCookieName,
  sessionUserCookieName,
} from "@sast-shop/api/server";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";

const maxCodeLength = 4096;
const maxBodyBytes = 16 * 1024;

export async function GET() {
  if (getServerAuthMode() !== "required") {
    return NextResponse.json(
      { authenticated: true },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  const user = await readSessionUserCookie(
    cookieStore.get(sessionUserCookieName)?.value,
    sessionToken,
    getSessionCookieSecret(),
  );
  return NextResponse.json(
    { authenticated: Boolean(sessionToken && user), user },
    { headers: { "cache-control": "no-store" } },
  );
}

async function readBoundedJson(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new RangeError();
  }
  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.byteLength;
    if (size > maxBodyBytes) {
      await reader.cancel();
      throw new RangeError();
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return JSON.parse(text);
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }
  if (getServerAuthMode() !== "required") {
    return NextResponse.json({ authenticated: true });
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        { error: "Request body is too large" },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const code =
    body && typeof body === "object" && !Array.isArray(body) && "code" in body
      ? (body as { code?: unknown }).code
      : null;
  if (typeof code !== "string" || !code.trim() || code.length > maxCodeLength) {
    return NextResponse.json(
      { error: "Invalid authorization code" },
      { status: 400 },
    );
  }

  let connectBaseUrl: string;
  let sessionSecret: string;
  try {
    connectBaseUrl = getServerConnectBaseUrl();
    sessionSecret = getSessionCookieSecret();
  } catch {
    return NextResponse.json(
      { error: "Authentication service is not configured" },
      { status: 500 },
    );
  }

  const permit = loginExchangeGuard.tryAcquire();
  if (!permit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts" },
      {
        status: 429,
        headers: {
          "cache-control": "no-store",
          "retry-after": String(permit.retryAfterSeconds),
        },
      },
    );
  }

  let session;
  let sessionUserCookie: string;
  try {
    session = await loginWithLarkCode(code.trim(), {
      dataSource: mobileAppConfig.dataSource,
      connectBaseUrl,
    });
    sessionUserCookie = await createSessionUserCookie(
      session.user,
      session.sessionToken,
      session.expiresAt,
      sessionSecret,
    );
  } catch {
    return NextResponse.json(
      { error: "Authorization code exchange failed" },
      { status: 401 },
    );
  } finally {
    permit.release();
  }

  const expires = new Date(session.expiresAt);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  } as const;
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, session.sessionToken, cookieOptions);
  cookieStore.set(sessionUserCookieName, sessionUserCookie, cookieOptions);

  return NextResponse.json(
    {
      authenticated: true,
      user: session.user,
      expiresAt: session.expiresAt,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  const expiredCookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  } as const;
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, "", expiredCookieOptions);
  cookieStore.set(sessionUserCookieName, "", expiredCookieOptions);

  return NextResponse.json(
    { authenticated: false },
    { headers: { "cache-control": "no-store" } },
  );
}
