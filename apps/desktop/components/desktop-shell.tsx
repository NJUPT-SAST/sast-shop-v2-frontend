import type { ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { DesktopNav } from "./desktop-nav"
import { ProfileManagement } from "./profile-management"

export function DesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-dvh flex-col border-r border-border bg-card">
          <div className="flex min-h-20 flex-col justify-center border-b border-border px-6">
            <p className="truncate text-base font-semibold leading-6">
              SAST 商城
            </p>
            <p className="truncate text-sm text-muted-foreground">PC 工作台</p>
          </div>

          <DesktopNav />

          <div className="border-t border-border px-4 py-4">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11 w-full justify-start px-4"
            >
              <span className="truncate">打开飞书侧边栏</span>
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-4 px-8">
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">
                  SAST Shop Console
                </p>
                <p className="truncate text-[17px] font-semibold leading-6">
                  商品与订单工作台
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <ProfileManagement />
                <Button type="button" variant="ghost" size="sm">
                  消息
                </Button>
                <Button type="button" size="sm">
                  新建发布
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl px-8 py-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
