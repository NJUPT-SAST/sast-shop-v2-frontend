"use client";

import { Activity, useCallback, type ReactNode } from "react";
import type { DataSource } from "@sast-shop/api";
import { usePathname } from "next/navigation";
import { useMobileKeyboard } from "@/hooks/use-mobile-keyboard";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobileHeader } from "./mobile-header";
import { MobileHeaderActionsProvider } from "./mobile-header-actions";
import { MobilePageTransition } from "./mobile-page-transition";
import {
  MobileNavigationProvider,
  useMobileNavigation,
  useMobilePathname,
} from "./mobile-navigation-feedback";
import { MobileNavigationSkeleton } from "./mobile-navigation-skeleton";
import { MobileScrollProvider } from "./mobile-scroll-context";
import { MobileScrollArea } from "./mobile-scroll-area";
import { hasCachedMobilePage } from "@/lib/mobile-page-cache";

const mainRoutes = ["/shop", "/group", "/orders", "/profile"] as const;

export function MobileShell({
  children,
  dataSource,
  connectBaseUrl,
  authRequired,
}: {
  children: ReactNode;
  dataSource: DataSource;
  connectBaseUrl: string;
  authRequired: boolean;
}) {
  const hasCachedPage = useCallback(
    (pathname: string) =>
      hasCachedMobilePage(pathname, {
        dataSource,
        connectBaseUrl,
        authRequired,
      }),
    [dataSource, connectBaseUrl, authRequired],
  );
  return (
    <MobileNavigationProvider hasCachedPage={hasCachedPage}>
      <MobileShellContent>{children}</MobileShellContent>
    </MobileNavigationProvider>
  );
}

function MobileShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const displayPath = useMobilePathname();
  const pendingPath = useMobileNavigation()?.pendingPath;
  const isMainRoute = mainRoutes.some((route) => route === displayPath);
  const isKeyboardOpen = useMobileKeyboard();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <MobileScrollProvider>
        <MobileHeaderActionsProvider>
          <MobileHeader />

          <MobilePageTransition>
            <MobileScrollArea
              key={pathname}
              hasBottomNav={isMainRoute && !isKeyboardOpen}
              pendingPath={pendingPath}
            >
              <Activity mode={pendingPath ? "hidden" : "visible"}>
                {children}
              </Activity>
              {pendingPath ? (
                <MobileNavigationSkeleton pathname={pendingPath} />
              ) : null}
            </MobileScrollArea>
          </MobilePageTransition>

          {isMainRoute ? <MobileBottomNav hidden={isKeyboardOpen} /> : null}
        </MobileHeaderActionsProvider>
      </MobileScrollProvider>
    </div>
  );
}
