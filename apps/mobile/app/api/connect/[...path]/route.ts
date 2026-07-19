import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  createConnectProxyAbort,
  sessionCookieName,
} from "@sast-shop/api/server";

import { getServerAuthMode } from "@/lib/auth-mode";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";

const maxConnectRequestBodyBytes = 1024 * 1024;
const serverOnlyAuthMethods = new Set([
  "sast.sastshopv2.user.v1.AuthService/Login",
  "sast.sastshopv2.user.v1.AuthService/GetJSAPIAuthConfig",
]);

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const blockedRequestHeaders = new Set([
  ...hopByHopHeaders,
  "authorization",
  "content-length",
  "cookie",
  "forwarded",
  "host",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
]);

const blockedResponseHeaders = new Set([
  ...hopByHopHeaders,
  "content-encoding",
  "content-length",
  "location",
  "set-cookie",
  "access-control-allow-credentials",
  "access-control-allow-headers",
  "access-control-allow-methods",
  "access-control-allow-origin",
  "access-control-expose-headers",
  "access-control-max-age",
]);

type ConnectRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

function isSameOriginRequest(request: NextRequest): boolean {
  const requestOrigin = request.nextUrl.origin;
  const origin = request.headers.get("origin");

  if (origin) return origin === requestOrigin;

  const referer = request.headers.get("referer");
  if (!referer) return false;

  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url;
}

function buildTargetUrl(baseUrl: string, path: string[], search: string): URL {
  if (path.some((part) => part === "." || part === "..")) {
    throw new Error("Invalid Connect path");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const encodedPath = path.map((part) => encodeURIComponent(part)).join("/");
  const targetUrl = new URL(`${encodedPath}${search}`, normalizedBaseUrl);

  if (
    targetUrl.origin !== normalizedBaseUrl.origin ||
    !targetUrl.pathname.startsWith(normalizedBaseUrl.pathname)
  ) {
    throw new Error("Invalid Connect target");
  }

  return targetUrl;
}

function buildRequestHeaders(
  requestHeaders: Headers,
  sessionToken: string | undefined,
): Headers {
  const headers = new Headers();

  for (const [name, value] of requestHeaders) {
    if (!blockedRequestHeaders.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  }

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`);
  }

  return headers;
}

function buildResponseHeaders(responseHeaders: Headers): Headers {
  const headers = new Headers();

  for (const [name, value] of responseHeaders) {
    if (!blockedResponseHeaders.has(name.toLowerCase())) {
      headers.set(name, value);
    }
  }

  return headers;
}

async function readBoundedRequestBody(
  request: NextRequest,
  signal: AbortSignal,
) {
  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > maxConnectRequestBodyBytes
  ) {
    throw new RangeError("request body too large");
  }

  if (!request.body) {
    return undefined;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const cancelReader = () => {
    void reader.cancel(signal.reason).catch(() => undefined);
  };
  signal.addEventListener("abort", cancelReader, { once: true });
  if (signal.aborted) {
    cancelReader();
    signal.removeEventListener("abort", cancelReader);
    throw signal.reason;
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (signal.aborted) throw signal.reason;
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxConnectRequestBodyBytes) {
        await reader.cancel();
        throw new RangeError("request body too large");
      }

      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancelReader);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body.buffer as ArrayBuffer;
}

async function proxyConnectRequest(
  request: NextRequest,
  context: ConnectRouteContext,
) {
  const authMode = getServerAuthMode();
  const sessionToken = (await cookies()).get(sessionCookieName)?.value;

  if (authMode === "required" && !sessionToken) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  if (
    authMode === "required" &&
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    !isSameOriginRequest(request)
  ) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 },
    );
  }

  let connectBaseUrl: string;
  try {
    connectBaseUrl = getServerConnectBaseUrl();
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
  let targetUrl: URL;

  try {
    targetUrl = buildTargetUrl(connectBaseUrl, path, request.nextUrl.search);
  } catch {
    return NextResponse.json(
      { error: "CONNECT_BASE_URL is invalid" },
      { status: 500 },
    );
  }

  const upstreamAbort = createConnectProxyAbort(request.signal);
  try {
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : await readBoundedRequestBody(request, upstreamAbort.signal);
    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: buildRequestHeaders(
        request.headers,
        authMode === "required" ? sessionToken : undefined,
      ),
      body,
      redirect: "manual",
      signal: upstreamAbort.signal,
    });

    const responseHeaders = buildResponseHeaders(upstreamResponse.headers);
    if (upstreamResponse.status === 401) {
      responseHeaders.set("cache-control", "no-store");
    }

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json(
        { error: "Request body is too large" },
        { status: 413 },
      );
    }
    if (upstreamAbort.didTimeout()) {
      return NextResponse.json(
        { code: "deadline_exceeded", message: "Upstream request timed out" },
        { status: 504, headers: { "cache-control": "no-store" } },
      );
    }
    throw error;
  } finally {
    upstreamAbort.dispose();
  }
}

export const GET = proxyConnectRequest;
export const POST = proxyConnectRequest;
export const PUT = proxyConnectRequest;
export const PATCH = proxyConnectRequest;
export const DELETE = proxyConnectRequest;
