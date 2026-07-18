import type { Metadata } from "next"
import type { ReactNode } from "react"
import Script from "next/script"
import { Toaster } from "@workspace/ui/components/sonner"
import { AuthBootstrap } from "@/components/auth-bootstrap"
import { DesktopShell } from "@/components/desktop-shell"
import { desktopAppConfig } from "@/lib/app-config"
import { getServerAuthMode } from "@/lib/auth-mode"
import "./globals.css"

export const metadata: Metadata = {
  title: desktopAppConfig.appName,
  description: "SAST 商城桌面端运营工作台",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const authRequired = getServerAuthMode() === "required"
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        {authRequired ? <Script src="https://lf-scm-cn.feishucdn.com/lark/op/h5-js-sdk-1.5.34.js" strategy="beforeInteractive" /> : null}
        <AuthBootstrap enabled={authRequired} appId={process.env.NEXT_PUBLIC_FEISHU_APP_ID ?? ""}>
          <DesktopShell>{children}</DesktopShell>
        </AuthBootstrap>
        <Toaster />
      </body>
    </html>
  )
}
