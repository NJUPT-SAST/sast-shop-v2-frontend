import type { ReactNode } from "react";
import { DesktopNav } from "./desktop-nav";

export function DesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-dvh flex-col border-r border-border bg-card">
          <div className="flex min-h-16 items-center border-b border-border px-6">
            <p className="truncate text-base font-semibold leading-6">
              SAST 商城
            </p>
          </div>

          <DesktopNav />
        </aside>

        <div className="flex min-w-0 flex-col">
          <main className="mx-auto w-full max-w-7xl px-8 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
