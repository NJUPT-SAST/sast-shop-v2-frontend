import type { Metadata } from "next"
import type { ReactNode } from "react"
import { DesktopShell } from "@/components/desktop-shell"
import { desktopAppConfig } from "@/lib/app-config"
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
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <DesktopShell>{children}</DesktopShell>
      </body>
    </html>
  )
}
