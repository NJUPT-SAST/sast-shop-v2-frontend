import { getJSAPIAuthConfig } from "@sast-shop/api";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { desktopAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import { getDirectServerServiceOptions } from "@/lib/server-service-options";

const sessionCookieName = "sast_shop_session";

export async function GET(request: NextRequest) {
  if (
    getServerAuthMode() === "required" &&
    !(await cookies()).get(sessionCookieName)?.value
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let signingUrl: URL;
  try {
    signingUrl = new URL(request.nextUrl.searchParams.get("url") ?? "");
    if (
      signingUrl.origin !== desktopAppConfig.appOrigin ||
      signingUrl.username ||
      signingUrl.password ||
      (process.env.NODE_ENV === "production" &&
        signingUrl.protocol !== "https:")
    ) {
      throw new Error("Invalid signing URL");
    }
    signingUrl.hash = "";
  } catch {
    return NextResponse.json({ error: "Invalid signing URL" }, { status: 400 });
  }

  try {
    const config = await getJSAPIAuthConfig(
      signingUrl.href,
      await getDirectServerServiceOptions(),
    );
    return NextResponse.json(config, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "JSAPI configuration is unavailable" },
      { status: 503 },
    );
  }
}
