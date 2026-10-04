"use client";

import { usePathname, useRouter } from "next/navigation";
import { RiArrowLeftLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { useSecondaryScrollTitle } from "@/hooks/use-secondary-scroll-title";
import { MobileHeaderActionSlot } from "./mobile-header-actions";

const mainRoutes = ["/shop", "/group", "/orders", "/profile"] as const;

export function MobileHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { titleText, showTitle, headerRef } = useSecondaryScrollTitle();
  const isMainRoute = mainRoutes.some((route) => route === pathname);
  const showScrollTitle = showTitle && titleText.length > 0;

  if (isMainRoute) {
    return null;
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl"
    >
      <div className="mx-auto grid min-h-13 w-full max-w-md grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-2 has-[[data-slot=mobile-header-action]]:grid-cols-[6.5rem_minmax(0,1fr)_6.5rem]">
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          className="justify-self-start border-0 bg-transparent shadow-none"
          aria-label="返回上一页"
          onClick={() => router.back()}
        >
          <RiArrowLeftLine />
        </Button>

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
