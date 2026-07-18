import { NextResponse } from "next/server";

import { desktopAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";

export async function GET() {
  try {
    if (process.env.NODE_ENV === "production") {
      if (getServerAuthMode() !== "required") throw new Error();
      if (!process.env.NEXT_PUBLIC_FEISHU_APP_ID?.trim()) throw new Error();
      if (desktopAppConfig.dataSource === "remote") throw new Error();
    }
    const connectBaseUrl = getServerConnectBaseUrl();
    const connectUrl = new URL(connectBaseUrl);
    const appUrl = new URL(desktopAppConfig.appOrigin);
    if (
      connectUrl.origin === appUrl.origin &&
      connectUrl.pathname.startsWith("/api/connect")
    ) {
      throw new Error();
    }

    const upstream = await fetch(connectBaseUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(3_000),
    });
    await upstream.body?.cancel();
    if (upstream.status >= 500) throw new Error();

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
