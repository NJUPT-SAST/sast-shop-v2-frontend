import type { Metadata } from "next"
import type { ReactNode } from "react"
import { MobileShell } from "@/components/mobile-shell"
import "./globals.css"

export const metadata: Metadata = {
  title: "SAST 商城",
  description: "SAST 商城移动端",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <MobileShell>{children}</MobileShell>
      </body>
    </html>
  )
}
