"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type MouseEvent } from "react";
import {
  RiAddLine,
  RiFileList3Line,
  RiGroupLine,
  RiStore2Line,
  RiUser3Line,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useMobileScroll } from "./mobile-scroll-context";

const navItems = [
  { label: "商城", href: "/shop", icon: RiStore2Line },
  { label: "团购", href: "/group", icon: RiGroupLine },
  { label: "订单", href: "/orders", icon: RiFileList3Line },
  { label: "我的", href: "/profile", icon: RiUser3Line },
] as const;

const NAV_CLICK_DEBOUNCE_MS = 350;

export function MobileBottomNav() {
  const pathname = usePathname();
  const lastCurrentRoutePressAtRef = useRef(0);
  const { handleCurrentRoutePress, scrollToTop } = useMobileScroll();

  function handleNavClick(
    event: MouseEvent<HTMLAnchorElement>,
    isActive: boolean,
  ) {
    if (isActive) {
      const now = Date.now();
      event.preventDefault();

      if (now - lastCurrentRoutePressAtRef.current < NAV_CLICK_DEBOUNCE_MS) {
        return;
      }

      lastCurrentRoutePressAtRef.current = now;
      handleCurrentRoutePress();
      return;
    }

    scrollToTop();
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex h-16 w-full max-w-md items-center justify-around px-2">
        {navItems.slice(0, 2).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavClick={handleNavClick}
          />
        ))}

        <Button asChild size="icon-lg" className="-mt-8 size-14 rounded-full">
          <Link href="/publish/spot" aria-label="上架现货">
            <RiAddLine data-icon="inline-start" />
          </Link>
        </Button>

        {navItems.slice(2).map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onNavClick={handleNavClick}
          />
        ))}
      </div>
    </nav>
  );
}

function NavLink({
  item,
  pathname,
  onNavClick,
}: {
  item: (typeof navItems)[number];
  pathname: string;
  onNavClick: (event: MouseEvent<HTMLAnchorElement>, isActive: boolean) => void;
}) {
  const isActive = pathname.startsWith(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      onClick={(event) => onNavClick(event, isActive)}
      className={cn(
        "flex min-w-14 flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      <span>{item.label}</span>
    </Link>
  );
}
