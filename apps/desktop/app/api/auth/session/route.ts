import {
  getSessionCookieSecret,
  hasTrustedRequestOrigin,
  readSessionUserCookie,
  sessionCookieName,
  sessionUserCookieName,
} from "@sast-shop/api/server";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  clearDesktopAuthSessionCookies,
  createDesktopAuthSessionFromLarkCode,
  LoginConfigurationError,
  LoginRateLimitedError,
  setDesktopAuthSessionCookies,
} from "@/lib/auth-session";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";

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
  if (!hasTrustedRequestOrigin(request.headers, desktopAppConfig.appOrigin)) {
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

  try {
    const { session, sessionUserCookie } =
      await createDesktopAuthSessionFromLarkCode(code.trim());
    const response = NextResponse.json(
      {
        authenticated: true,
        user: session.user,
        expiresAt: session.expiresAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
    setDesktopAuthSessionCookies(response, session, sessionUserCookie);
    return response;
  } catch (error) {
    if (error instanceof LoginRateLimitedError) {
      return NextResponse.json(
        { error: "Too many login attempts" },
        {
          status: 429,
          headers: {
            "cache-control": "no-store",
            "retry-after": String(error.retryAfterSeconds),
          },
        },
      );
    }
    if (error instanceof LoginConfigurationError) {
      return NextResponse.json(
        { error: "Authentication service is not configured" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: "Authorization code exchange failed" },
      { status: 401 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedRequestOrigin(request.headers, desktopAppConfig.appOrigin)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }
  const response = NextResponse.json(
    { authenticated: false },
    { headers: { "cache-control": "no-store" } },
  );
  clearDesktopAuthSessionCookies(response);
  return response;
}
