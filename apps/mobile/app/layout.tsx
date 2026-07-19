import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Toaster } from "@workspace/ui/components/sonner";
import { AuthBootstrap } from "@/components/auth-bootstrap";
import { MobileShell } from "@/components/mobile-shell";
import { ProfileDialogsProvider } from "@/components/profile-dialogs-provider";
import { mobileAppConfig } from "@/lib/app-config";
import { getServerAuthMode } from "@/lib/auth-mode";
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
      </head>
      <body className="min-h-full">
        {authRequired ? (
          <Script
            src="https://lf-scm-cn.feishucdn.com/lark/op/h5-js-sdk-1.5.34.js"
            strategy="beforeInteractive"
          />
        ) : null}
        <AuthBootstrap
          enabled={authRequired}
          appId={process.env.NEXT_PUBLIC_FEISHU_APP_ID ?? ""}
          dataSource={mobileAppConfig.dataSource}
          connectBaseUrl={mobileAppConfig.connectBaseUrl}
        >
          <ProfileDialogsProvider
            dataSource={mobileAppConfig.dataSource}
            connectBaseUrl={mobileAppConfig.connectBaseUrl}
            overview={null}
            error={null}
          >
            <MobileShell>{children}</MobileShell>
          </ProfileDialogsProvider>
        </AuthBootstrap>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
