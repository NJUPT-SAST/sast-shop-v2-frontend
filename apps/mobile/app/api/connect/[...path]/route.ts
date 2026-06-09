import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

import { parseAuthMode } from "@/lib/auth-mode"

const sessionCookieName = "sast_shop_session"

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

const blockedRequestHeaders = new Set([
  ...hopByHopHeaders,
  "authorization",
  "content-length",
  "cookie",
  "host",
])

const blockedResponseHeaders = new Set([
  ...hopByHopHeaders,
  "content-encoding",
  "content-length",
  "set-cookie",
])

type ConnectRouteContext = {
  params: Promise<{
    path?: string[]
  }>
}

function resolveConnectBaseUrl(): string | null {
  return (
    process.env.CONNECT_BASE_URL ??
    process.env.NEXT_PUBLIC_CONNECT_BASE_URL ??
    null
  )
}

function normalizeBaseUrl(baseUrl: string): URL {
  const url = new URL(baseUrl)

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`
  }

  return url
}

function buildTargetUrl(baseUrl: string, path: string[], search: string): URL {
  const encodedPath = path.map((part) => encodeURIComponent(part)).join("/")

  return new URL(`${encodedPath}${search}`, normalizeBaseUrl(baseUrl))
}

function buildRequestHeaders(
  requestHeaders: Headers,
  sessionToken: string | undefined,
): Headers {
  const headers = new Headers()

  for (const [name, value] of requestHeaders) {
    if (!blockedRequestHeaders.has(name.toLowerCase())) {
      headers.set(name, value)
    }
  }

  if (sessionToken) {
    headers.set("authorization", `Bearer ${sessionToken}`)
  }

  return headers
}

function buildResponseHeaders(responseHeaders: Headers): Headers {
  const headers = new Headers()

  for (const [name, value] of responseHeaders) {
    if (!blockedResponseHeaders.has(name.toLowerCase())) {
      headers.set(name, value)
    }
  }

  return headers
}

async function proxyConnectRequest(
  request: NextRequest,
  context: ConnectRouteContext,
) {
  const authMode = parseAuthMode(process.env.AUTH_MODE)
  const sessionToken = (await cookies()).get(sessionCookieName)?.value

  if (authMode === "required" && !sessionToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const connectBaseUrl = resolveConnectBaseUrl()

  if (!connectBaseUrl) {
    return NextResponse.json(
      { error: "CONNECT_BASE_URL is not configured" },
      { status: 500 },
    )
  }

  const { path = [] } = await context.params
  let targetUrl: URL

  try {
    targetUrl = buildTargetUrl(connectBaseUrl, path, request.nextUrl.search)
  } catch {
    return NextResponse.json(
      { error: "CONNECT_BASE_URL is invalid" },
      { status: 500 },
    )
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer()
  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: buildRequestHeaders(
      request.headers,
      authMode === "required" ? sessionToken : undefined,
    ),
    body,
    redirect: "manual",
  })

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildResponseHeaders(upstreamResponse.headers),
  })
}

export const GET = proxyConnectRequest
export const POST = proxyConnectRequest
export const PUT = proxyConnectRequest
export const PATCH = proxyConnectRequest
export const DELETE = proxyConnectRequest
