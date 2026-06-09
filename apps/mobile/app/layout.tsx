import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Toaster } from "@workspace/ui/components/sonner"
import { MobileShell } from "@/components/mobile-shell"
import { ProfileDialogsProvider } from "@/components/profile-dialogs-provider"
import { mobileAppConfig } from "@/lib/app-config"
import { loadProfileOverview } from "@/lib/profile-overview"
import "./globals.css"

export const metadata: Metadata = {
  title: "SAST 商城",
  description: "SAST 商城移动端",
}

async function getProfileDialogsOverview() {
  try {
    return {
      overview: await loadProfileOverview(),
      error: null,
    }
  } catch {
    return {
      overview: null,
      error: "资料管理暂不可用，请确认数据源或稍后再试",
    }
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const profile = await getProfileDialogsOverview()

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <ProfileDialogsProvider
          dataSource={mobileAppConfig.dataSource}
          connectBaseUrl={mobileAppConfig.connectBaseUrl}
          overview={profile.overview}
          error={profile.error}
        >
          <MobileShell>{children}</MobileShell>
        </ProfileDialogsProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
