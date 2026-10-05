import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

import { proxyProductImageUpload } from "../../../../../../server/product-image-upload";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import { getServerConnectBaseUrl } from "@/lib/server-service-options";

const sessionCookieName = "sast_shop_session";

export async function POST(request: NextRequest) {
  const sessionToken = (await cookies()).get(sessionCookieName)?.value;

  return proxyProductImageUpload(request, {
    appOrigin: mobileAppConfig.appOrigin,
    backendBaseUrl: getServerConnectBaseUrl(),
    isAuthenticationRequired: getServerAuthMode() === "required",
    sessionToken,
  });
}
