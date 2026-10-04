"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useMobileKeyboard } from "@/hooks/use-mobile-keyboard";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileHeader } from "./mobile-header";
import { MobileHeaderActionsProvider } from "./mobile-header-actions";
import { MobileScrollProvider } from "./mobile-scroll-context";
import { MobileScrollArea } from "./mobile-scroll-area";

const mainRoutes = ["/shop", "/group", "/orders", "/profile"] as const;

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isMainRoute = mainRoutes.some((route) => route === pathname);
  const isKeyboardOpen = useMobileKeyboard();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <MobileScrollProvider>
        <MobileHeaderActionsProvider>
          <MobileHeader />

          <MobileScrollArea
            key={pathname}
            hasBottomNav={isMainRoute && !isKeyboardOpen}
          >
            {children}
          </MobileScrollArea>

          {isMainRoute ? <MobileBottomNav hidden={isKeyboardOpen} /> : null}
        </MobileHeaderActionsProvider>
      </MobileScrollProvider>
    </div>
  );
}
