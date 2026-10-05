"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiAddLine } from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { SastShopMark } from "@workspace/ui/components/sast-shop-mark";
import {
  SastGroupMark,
  SastOrdersMark,
  SastProfileMark,
} from "@workspace/ui/components/sast-module-marks";

interface DesktopNavItem {
  label: string;
  href: "/shop" | "/group" | "/orders" | "/profile";
  icon: ComponentType<{ className?: string }>;
}

const navItems: DesktopNavItem[] = [
  { label: "商城", href: "/shop", icon: SastShopMark },
  { label: "团购", href: "/group", icon: SastGroupMark },
  { label: "订单", href: "/orders", icon: SastOrdersMark },
  { label: "我的", href: "/profile", icon: SastProfileMark },
];

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主导航"
      className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-4 lg:px-3"
    >
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Button
            key={item.label}
            variant={isActive ? "default" : "ghost"}
            size="lg"
            className="min-h-11 w-full justify-center px-2 lg:justify-start lg:px-3"
            asChild
          >
            <Link
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5" />
              <span className="hidden truncate lg:inline">{item.label}</span>
            </Link>
          </Button>
        );
      })}
      <div className="mt-auto pt-6">
        <Button
          className="min-h-11 w-full px-2 lg:justify-start lg:px-3"
          asChild
        >
          <Link href="/publish/spot" aria-label="上架现货" title="上架现货">
            <RiAddLine className="size-5" />
            <span className="hidden lg:inline">上架现货</span>
          </Link>
        </Button>
      </div>
    </nav>
  );
}
