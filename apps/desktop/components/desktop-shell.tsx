import type { ReactNode } from "react";
import Link from "next/link";
import { SastShopMark } from "@workspace/ui/components/sast-shop-mark";
import { DesktopNav } from "./desktop-nav";

export function DesktopShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="grid min-h-dvh grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-dvh flex-col border-r border-border bg-card">
          <div className="flex min-h-16 items-center border-b border-border px-6">
            <Link
              href="/shop"
              className="-mx-2 flex min-h-11 min-w-0 items-center gap-2.5 rounded-md px-2 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <SastShopMark className="size-7 text-primary" />
              <span className="truncate text-base font-semibold leading-6">
                SAST 商城
              </span>
            </Link>
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
