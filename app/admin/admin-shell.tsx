"use client"

import { AuthGuard } from "@/components/auth-guard"
import { MobileTabBar } from "@/components/layout/mobile-tab-bar"
import { PCSidebar } from "@/components/layout/pc-sidebar"
import { PageTransition } from "@/components/motion/page-transition"

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard mode="admin">
      <div className="flex min-h-[100svh] bg-shop-bg-page">
        <PCSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
          <MobileTabBar />
        </div>
      </div>
    </AuthGuard>
  )
}
