import { loginWithLarkCode } from "@sast-shop/api"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

import { desktopAppConfig } from "@/lib/app-config"
import { getServerAuthMode } from "@/lib/auth-mode"
import { getServerConnectBaseUrl } from "@/lib/server-service-options"

const sessionCookieName = "sast_shop_session"
const maxCodeLength = 4096
const maxBodyBytes = 16 * 1024

export async function GET() {
  if (getServerAuthMode() !== "required") {
    return NextResponse.json({ authenticated: true })
  }
  return NextResponse.json({
    authenticated: Boolean((await cookies()).get(sessionCookieName)?.value),
  })
}

function isSameOrigin(request: NextRequest) {
  const source = request.headers.get("origin") ?? request.headers.get("referer")
  if (!source) return false
  try {
    return new URL(source).origin === request.nextUrl.origin
  } catch {
    return false
  }
}

async function readBoundedJson(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
    throw new RangeError()
  }
  if (!request.body) return null
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBodyBytes) {
      await reader.cancel()
      throw new RangeError()
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  return JSON.parse(text)
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }
  if (getServerAuthMode() !== "required") {
    return NextResponse.json({ authenticated: false })
  }

  let body: unknown
  try {
    body = await readBoundedJson(request)
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: "Request body is too large" }, { status: 413 })
    }
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const code =
    body && typeof body === "object" && !Array.isArray(body) && "code" in body
      ? (body as { code?: unknown }).code
      : null
  if (typeof code !== "string" || !code.trim() || code.length > maxCodeLength) {
    return NextResponse.json({ error: "Invalid authorization code" }, { status: 400 })
  }

  let connectBaseUrl: string
  try {
    connectBaseUrl = getServerConnectBaseUrl()
  } catch {
    return NextResponse.json({ error: "Authentication service is not configured" }, { status: 500 })
  }
  let session
  try {
    session = await loginWithLarkCode(code.trim(), {
      dataSource: desktopAppConfig.dataSource,
      connectBaseUrl,
    })
  } catch {
    return NextResponse.json({ error: "Authorization code exchange failed" }, { status: 401 })
  }
  const expires = new Date(session.expiresAt)
  ;(await cookies()).set(sessionCookieName, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  })
  return NextResponse.json({ authenticated: true, user: session.user, expiresAt: session.expiresAt })
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }
  ;(await cookies()).set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  })
  return NextResponse.json({ authenticated: false })
}
