import { NextResponse } from "next/server";

import { parseConnectHealthUrl } from "../../../../../../config/connect-health-url";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";

export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      if (getServerAuthMode() !== "required") throw new Error();
      if (!process.env.NEXT_PUBLIC_FEISHU_APP_ID?.trim()) throw new Error();
      if (mobileAppConfig.dataSource === "remote") throw new Error();
    }
    const connectHealthUrl = parseConnectHealthUrl(
      process.env.CONNECT_HEALTH_URL,
    );
    const connectUrl = new URL(connectHealthUrl);
    const appUrl = new URL(mobileAppConfig.appOrigin);
    if (
      connectUrl.origin === appUrl.origin &&
      connectUrl.pathname.startsWith("/api/connect")
    ) {
      throw new Error();
    }

    const upstream = await fetch(connectHealthUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(3_000),
    });
    await upstream.body?.cancel();
    if (!upstream.ok) throw new Error();

    return NextResponse.json(
      { status: "ready" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "not_ready" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
