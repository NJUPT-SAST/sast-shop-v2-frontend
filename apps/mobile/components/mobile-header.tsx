"use client";

import {
  useMobilePathname as usePathname,
  useMobileNavigation,
} from "./mobile-navigation-feedback";
import { useMobileRouter as useRouter } from "@/components/mobile-navigation-feedback";
import { RiArrowLeftLine, RiHomeLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { useSecondaryScrollTitle } from "@/hooks/use-secondary-scroll-title";
import { MobileHeaderActionSlot } from "./mobile-header-actions";

const mainRoutes = ["/shop", "/group", "/orders", "/profile"] as const;

export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { titleText, showTitle, headerRef } = useSecondaryScrollTitle();
  const pendingPath = useMobileNavigation()?.pendingPath;
  const isMainRoute = mainRoutes.some((route) => route === pathname);
  const showScrollTitle = !pendingPath && showTitle && titleText.length > 0;

  if (isMainRoute) {
    return null;
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl"
    >
      <div className="grid min-h-13 w-full grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 px-2 sm:px-4 md:px-6 has-[[data-slot=mobile-header-action]]:grid-cols-[6.5rem_minmax(0,1fr)_6.5rem]">
        <div className="flex items-center justify-self-start">
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            className="border-0 bg-transparent shadow-none"
            aria-label="返回上一页"
            onClick={() => {
              if (
                pathname.startsWith("/pocket/") &&
                window.history.length <= 1
              ) {
                router.replace("/orders?tab=pocket");
                return;
              }
              router.back();
            }}
          >
            <RiArrowLeftLine />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            className="border-0 bg-transparent shadow-none"
            aria-label="返回首页"
            onClick={() => router.replace("/shop")}
          >
            <RiHomeLine />
          </Button>
        </div>

        <div className="min-w-0 text-center">
          {showScrollTitle ? (
            <span className="block truncate text-[15px] font-semibold leading-5">
              {titleText}
            </span>
          ) : (
            <span className="block h-5" aria-hidden="true" />
          )}
        </div>
        <MobileHeaderActionSlot />
      </div>
    </header>
  );
}
