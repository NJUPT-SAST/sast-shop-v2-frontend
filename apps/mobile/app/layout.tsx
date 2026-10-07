import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Toaster } from "@workspace/ui/components/sonner";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { MobileShell } from "@/components/mobile-shell";
import { ProfileDialogsProvider } from "@/components/profile-dialogs-provider";
import { TransactionAgreementProvider } from "@/components/transaction-agreement-provider";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
import { mobileOrientationBeforeSdkScript } from "@/lib/mobile-orientation";
import { resolveFeishuRedirectUri } from "../../../config/feishu-redirect-uri";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAST 商城",
  description: "SAST 商城移动端",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const authRequired = getServerAuthMode() === "required";
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <head>
        <meta name="showNavBar" content="false" lk-config="" />
        <meta name="showBottomNavBar" content="false" lk-config="" />
        <meta
          name="orientation"
          content="portrait"
          lk-config=""
          suppressHydrationWarning
        />
      </head>
      <body className="min-h-full">
        {authRequired ? (
          <>
            <Script id="mobile-orientation" strategy="beforeInteractive">
              {mobileOrientationBeforeSdkScript}
            </Script>
            <Script
              src="https://lf-scm-cn.feishucdn.com/lark/op/h5-js-sdk-1.5.34.js"
              strategy="beforeInteractive"
            />
          </>
        ) : null}
        <AuthBootstrap
          enabled={authRequired}
          appId={process.env.NEXT_PUBLIC_FEISHU_APP_ID ?? ""}
          redirectUri={
            authRequired
              ? resolveFeishuRedirectUri(
                  process.env.NEXT_PUBLIC_FEISHU_REDIRECT_URI,
                  mobileAppConfig.appOrigin,
                  process.env.NODE_ENV === "production",
                )
              : undefined
          }
          dataSource={mobileAppConfig.dataSource}
          connectBaseUrl={mobileAppConfig.connectBaseUrl}
        >
          <ProfileDialogsProvider
            dataSource={mobileAppConfig.dataSource}
            connectBaseUrl={mobileAppConfig.connectBaseUrl}
            overview={null}
            error={null}
          >
            <MobileShell
              dataSource={mobileAppConfig.dataSource}
              connectBaseUrl={mobileAppConfig.connectBaseUrl}
              authRequired={authRequired}
            >
              <TransactionAgreementProvider requireUserIdentity={authRequired}>
                {children}
              </TransactionAgreementProvider>
            </MobileShell>
          </ProfileDialogsProvider>
        </AuthBootstrap>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
