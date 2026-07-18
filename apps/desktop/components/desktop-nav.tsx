"use client"

import type { ComponentType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiFileList3Line,
  RiGroupLine,
  RiShoppingBag3Line,
  RiUser3Line,
} from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"

interface DesktopNavItem {
  label: string
  href?: "/shop" | "/group" | "/orders" | "/profile"
  icon: ComponentType<{ className?: string }>
}

const navItems: DesktopNavItem[] = [
  { label: "现货商城", href: "/shop", icon: RiShoppingBag3Line },
  { label: "团购", href: "/group", icon: RiGroupLine },
  { label: "订单", href: "/orders", icon: RiFileList3Line },
  { label: "我的", href: "/profile", icon: RiUser3Line },
]

export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {navItems.map((item) => {
        const isActive = item.href ? pathname.startsWith(item.href) : false
        const Icon = item.icon

        if (!item.href) {
          return (
            <Button
              key={item.label}
              type="button"
              variant="ghost"
              size="lg"
              className="min-h-11 w-full justify-start px-4"
              disabled
            >
              <Icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Button>
          )
        }

        return (
          <Button
            key={item.label}
            variant={isActive ? "default" : "ghost"}
            size="lg"
            className="min-h-11 w-full justify-start px-4"
            asChild
          >
            <Link href={item.href}>
              <Icon className="size-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
