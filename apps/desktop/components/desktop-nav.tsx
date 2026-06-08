"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@workspace/ui/components/button"

interface DesktopNavItem {
  label: string
  href?: "/" | "/profile"
}

const navItems: DesktopNavItem[] = [
  { label: "工作台", href: "/" },
  { label: "团购" },
  { label: "现货" },
  { label: "订单" },
  { label: "发布" },
  { label: "我的", href: "/profile" },
]

export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {navItems.map((item) => {
        const isActive = item.href === pathname

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
              <span className="truncate">{item.label}</span>
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
