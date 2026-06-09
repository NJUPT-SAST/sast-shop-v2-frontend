import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { parseAuthMode } from "@/lib/auth-mode"

const sessionCookieName = "sast_shop_session"

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  }
}

function isSameOriginRequest(request: Request) {
  const requestOrigin = new URL(request.url).origin
  const origin = request.headers.get("origin")

  if (origin) {
    return origin === requestOrigin
  }

  const referer = request.headers.get("referer")

  return referer ? new URL(referer).origin === requestOrigin : false
}

async function readToken(request: Request): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null)

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return null
  }

  const token = (body as { token?: unknown }).token

  return typeof token === "string" ? token.trim() : null
}

export async function POST(request: Request) {
  const cookieStore = await cookies()

  if (parseAuthMode(process.env.AUTH_MODE) === "off") {
    cookieStore.delete(sessionCookieName)
    return new Response(null, { status: 204 })
  }

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
  }

  const token = await readToken(request)

  if (!token) {
    return NextResponse.json(
      { error: "Missing session token" },
      { status: 400 },
    )
  }

  cookieStore.set(sessionCookieName, token, sessionCookieOptions())

  return new Response(null, { status: 204 })
}

export async function DELETE() {
  const cookieStore = await cookies()

  cookieStore.delete(sessionCookieName)

  return new Response(null, { status: 204 })
}
