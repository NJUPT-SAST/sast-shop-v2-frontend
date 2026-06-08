import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { ProfileManagement } from "./profile-management"

export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex min-h-13 w-full max-w-md items-center justify-between px-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-5">
              SAST 商城
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 shrink-0 px-4 text-primary hover:text-primary"
          >
            消息
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-4">
        {children}
      </main>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 mx-auto w-full max-w-md">
        <ProfileManagement />
      </div>

      <MobileBottomNav />
    </div>
  )
}
