"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { MobileHeader } from "./mobile-header"
import { MobileScrollProvider } from "./mobile-scroll-context"
import { MobileScrollArea } from "./mobile-scroll-area"

const mainRoutes = ["/shop", "/group", "/orders", "/profile"] as const

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isMainRoute = mainRoutes.some((route) => route === pathname)

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <MobileScrollProvider>
        <MobileHeader />

        <MobileScrollArea hasBottomNav={isMainRoute}>
          {children}
        </MobileScrollArea>

        {isMainRoute ? <MobileBottomNav /> : null}
      </MobileScrollProvider>
    </div>
  )
}
