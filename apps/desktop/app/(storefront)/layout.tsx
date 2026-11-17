import { TransactionForegroundRefresh } from "@/components/transaction-foreground-refresh";
import type { ReactNode } from "react";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { DesktopShell } from "@/components/desktop-shell";
import { TransactionAgreementProvider } from "@/components/transaction-agreement-provider";
import { desktopAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import { resolveFeishuRedirectUri } from "../../../../config/feishu-redirect-uri";

export default function StorefrontLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authRequired = getServerAuthMode() === "required";
  return (
    <AuthBootstrap
      enabled={authRequired}
      appId={process.env.NEXT_PUBLIC_FEISHU_APP_ID ?? ""}
      redirectUri={
        authRequired
          ? resolveFeishuRedirectUri(
              process.env.NEXT_PUBLIC_FEISHU_REDIRECT_URI,
              desktopAppConfig.appOrigin,
              process.env.NODE_ENV === "production",
            )
          : undefined
      }
      dataSource={desktopAppConfig.dataSource}
      connectBaseUrl={desktopAppConfig.connectBaseUrl}
    >
      <TransactionAgreementProvider requireUserIdentity={authRequired}>
        <DesktopShell>
          <TransactionForegroundRefresh />
          {children}
        </DesktopShell>
      </TransactionAgreementProvider>
    </AuthBootstrap>
  );
}
