import type { ReactNode } from "react"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { MobileHeader } from "./mobile-header"
import { MobileScrollProvider } from "./mobile-scroll-context"
import { MobileScrollArea } from "./mobile-scroll-area"

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <MobileScrollProvider>
        <MobileHeader />

        <MobileScrollArea>
          {children}
        </MobileScrollArea>

        <MobileBottomNav />
      </MobileScrollProvider>
    </div>
  )
}
