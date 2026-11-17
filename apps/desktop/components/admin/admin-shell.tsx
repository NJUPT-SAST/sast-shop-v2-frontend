"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  RiArrowLeftLine,
  RiLogoutBoxRLine,
  RiShieldCheckLine,
} from "@remixicon/react";
import { Button } from "@workspace/ui/components/button";
import { adminSections } from "@/lib/admin-navigation";
import { useAdminSession } from "./admin-session";

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { identity, logout } = useAdminSession();
  return (
    <div className="grid h-dvh grid-cols-[11rem_minmax(0,1fr)] overflow-hidden bg-background lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-r bg-card">
        <Link
          href="/admin"
          className="flex min-h-16 items-center gap-2 border-b px-4 font-semibold"
        >
          <RiShieldCheckLine className="size-5 text-primary" />
          SAST 管理后台
        </Link>
        <nav
          aria-label="管理导航"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
        >
          {adminSections.map((section) => {
            const selected =
              section.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(section.href);
            return (
              <Button
                key={section.key}
                variant={selected ? "default" : "ghost"}
                asChild
                className="justify-start"
              >
                <Link
                  href={section.href}
                  aria-current={selected ? "page" : undefined}
                >
                  {section.title}
                </Link>
              </Button>
            );
          })}
        </nav>
        <div className="space-y-2 border-t p-3">
          <p className="truncate px-2 text-sm font-medium">{identity.name}</p>
          <p className="px-2 text-xs text-muted-foreground">
            {identity.role === "superadmin" ? "超级管理员" : "管理员"}
          </p>
          <Button variant="ghost" asChild className="w-full justify-start">
            <Link href="/shop">
              <RiArrowLeftLine />
              返回商城
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => void logout()}
          >
            <RiLogoutBoxRLine />
            退出登录
          </Button>
        </div>
      </aside>
      <main className="min-w-0 overflow-y-auto p-5 lg:p-7">{children}</main>
    </div>
  );
}
