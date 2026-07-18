import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
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
          <header className="sticky top-0 z-20 border-b border-border/80 bg-background/85 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-end px-8">
              <Button asChild variant="outline" size="sm">
                <Link href="/profile">我的资料</Link>
              </Button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl px-8 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
