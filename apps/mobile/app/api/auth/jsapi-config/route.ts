import { getJSAPIAuthConfig } from "@sast-shop/api"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

import { mobileAppConfig } from "@/lib/app-config"
import { getServerAuthMode } from "@/lib/auth-mode"
import { normalizeJsapiSigningUrl } from "@/lib/jsapi-config"
import { getDirectServerServiceOptions } from "@/lib/server-service-options"

const sessionCookieName = "sast_shop_session"

export async function GET(request: NextRequest) {
  if (
    getServerAuthMode() === "required" &&
    !(await cookies()).get(sessionCookieName)?.value
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let signingUrl: string
  try {
    signingUrl = normalizeJsapiSigningUrl(
      request.nextUrl.searchParams.get("url") ?? "",
      mobileAppConfig.appOrigin,
    )
    if (
      process.env.NODE_ENV === "production" &&
      new URL(signingUrl).protocol !== "https:"
    ) {
      throw new Error("HTTPS is required")
    }
  } catch {
    return NextResponse.json({ error: "Invalid signing URL" }, { status: 400 })
  }

  try {
    const config = await getJSAPIAuthConfig(
      signingUrl,
      await getDirectServerServiceOptions(),
    )
    return NextResponse.json(config, {
      headers: { "cache-control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "JSAPI configuration is unavailable" },
      { status: 503 },
    )
  }
}
