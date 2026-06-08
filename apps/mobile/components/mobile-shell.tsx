import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"

const navItems = ["团购", "现货", "订单", "发布", "我的"] as const

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

      <main className="mx-auto w-full max-w-md px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid min-h-16 w-full max-w-md grid-cols-5 gap-1 px-2 py-2">
          {navItems.map((item, index) => (
            <Button
              key={item}
              type="button"
              variant={index === 0 ? "default" : "ghost"}
              size="sm"
              className="min-h-11 min-w-0 rounded-full px-2 text-[13px]"
            >
              <span className="truncate">{item}</span>
            </Button>
          ))}
        </div>
      </nav>
    </div>
  )
}
