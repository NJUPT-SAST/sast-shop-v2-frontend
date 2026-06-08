"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@workspace/ui/lib/utils"

const navItems = [
  { label: "团购", href: "/" },
  { label: "现货", href: "/" },
  { label: "订单", href: "/" },
  { label: "发布", href: "/" },
  { label: "我的", href: "/profile" },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto grid min-h-16 w-full max-w-md grid-cols-5 gap-1 px-2 py-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/profile"
              ? pathname === "/profile"
              : item.label === "团购" && pathname === "/"

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center justify-center rounded-full px-2 text-[13px] font-medium transition-[background-color,color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
