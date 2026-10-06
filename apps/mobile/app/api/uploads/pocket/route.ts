import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { sessionCookieName } from "@sast-shop/api/server";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";
import { proxyPocketUpload } from "../../../../../../server/pocket-upload";
export async function POST(request: NextRequest) {
  return proxyPocketUpload(request, {
    appOrigin: mobileAppConfig.appOrigin,
    backendBaseUrl: getServerConnectBaseUrl(),
    isAuthenticationRequired: getServerAuthMode() === "required",
    sessionToken: (await cookies()).get(sessionCookieName)?.value,
    devUserId: process.env.NEXT_PUBLIC_DEV_USER_ID,
  });
}
