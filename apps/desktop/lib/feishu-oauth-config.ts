import "server-only";

import { desktopAppConfig } from "@/lib/app-config";
import { resolveFeishuOAuthConfig } from "@/lib/feishu-oauth";

export function getFeishuOAuthConfig() {
  return resolveFeishuOAuthConfig({
    appId: process.env.FEISHU_APP_ID ?? process.env.NEXT_PUBLIC_FEISHU_APP_ID,
    redirectUri: process.env.FEISHU_REDIRECT_URI,
    appOrigin: desktopAppConfig.appOrigin,
    authorizeUrl: process.env.FEISHU_OAUTH_AUTHORIZE_URL,
    production: process.env.NODE_ENV === "production",
  });
}
