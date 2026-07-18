import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { getServerAuthMode } from "@/lib/auth-mode";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";

const sessionCookieName = "sast_shop_session";
const maxBodyBytes = 1024 * 1024;
const serverOnlyAuthMethods = new Set([
  "sast.sastshopv2.user.v1.AuthService/Login",
  "sast.sastshopv2.user.v1.AuthService/GetJSAPIAuthConfig",
]);
const blockedRequestHeaders = new Set([
  "authorization",
  "connection",
  "content-length",
  "cookie",
  "host",
  "forwarded",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
]);
const blockedResponseHeaders = new Set([
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "access-control-expose-headers",
  "access-control-max-age",
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "location",
  "set-cookie",
  "transfer-encoding",
  "upgrade",
]);

type Context = { params: Promise<{ path?: string[] }> };

function isSameOrigin(request: NextRequest) {
  const source =
    request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;
  try {
    return new URL(source).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

async function readBody(request: NextRequest) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBodyBytes) throw new RangeError();
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBodyBytes) {
      await reader.cancel();
      throw new RangeError();
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

function copyHeaders(source: Headers, blocked: Set<string>) {
  const headers = new Headers();
  for (const [name, value] of source) {
    if (!blocked.has(name.toLowerCase())) headers.set(name, value);
  }
  return headers;
}

async function proxy(request: NextRequest, context: Context) {
  const authMode = getServerAuthMode();
  const sessionToken = (await cookies()).get(sessionCookieName)?.value;
  if (authMode === "required" && !sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !isSameOrigin(request)
  ) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  let base: string;
  try {
    base = getServerConnectBaseUrl();
  } catch {
    return NextResponse.json(
      { error: "CONNECT_BASE_URL is not configured or invalid" },
      { status: 500 },
    );
  }
  const { path = [] } = await context.params;
  if (serverOnlyAuthMethods.has(path.join("/"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let target: URL;
  try {
    if (path.some((part) => part === "." || part === "..")) {
      throw new Error("Invalid Connect path");
    }
    const baseUrl = new URL(base);
    if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
    target = new URL(
      `${path.map((part) => encodeURIComponent(part)).join("/")}${request.nextUrl.search}`,
      baseUrl,
    );
    if (
      target.origin !== baseUrl.origin ||
      !target.pathname.startsWith(baseUrl.pathname)
    ) {
      throw new Error("Invalid Connect target");
    }
  } catch {
    return NextResponse.json(
      { error: "CONNECT_BASE_URL is invalid" },
      { status: 500 },
    );
  }

  try {
    const headers = copyHeaders(request.headers, blockedRequestHeaders);
    if (authMode === "required" && sessionToken) {
      headers.set("authorization", `Bearer ${sessionToken}`);
    }
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await readBody(request),
      redirect: "manual",
    });
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: copyHeaders(upstream.headers, blockedResponseHeaders),
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        { error: "Request body is too large" },
        { status: 413 },
      );
    }
    throw error;
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
