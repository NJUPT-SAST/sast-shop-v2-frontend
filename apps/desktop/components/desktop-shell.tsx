"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SastShopMark } from "@workspace/ui/components/sast-shop-mark";
import { DesktopNav } from "./desktop-nav";

export function DesktopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isStoreProductRoute = /^\/group\/shop\/[^/]+\/?$/.test(pathname);
  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground">
      <div
        className={
          isStoreProductRoute
            ? "grid h-full grid-cols-1"
            : "grid h-full grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)]"
        }
      >
        {!isStoreProductRoute ? (
          <aside className="flex min-h-0 flex-col border-r border-border bg-card">
            <div className="flex min-h-16 shrink-0 items-center justify-center border-b border-border lg:justify-start lg:px-5">
              <Link
                href="/shop"
                aria-label="SAST 商城"
                className="-mx-2 flex min-h-11 min-w-0 items-center gap-2.5 rounded-md px-2 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <SastShopMark className="size-7 text-primary" />
                <span className="hidden truncate text-base font-semibold leading-6 lg:inline">
                  SAST 商城
                </span>
              </Link>
            </div>

            <DesktopNav />
          </aside>
        ) : null}

        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
          <main className="mx-auto w-full max-w-7xl px-5 py-6 xl:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
