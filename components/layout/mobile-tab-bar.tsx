"use client"

import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import { m } from "motion/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

const TABS = [
  { href: "/", label: "首页", icon: "material-symbols:home-rounded" },
  {
    href: "/secondhand",
    label: "商城",
    icon: "material-symbols:storefront-rounded",
  },
  { href: "/orders", label: "订单", icon: "material-symbols:receipt-long-rounded" },
  { href: "/profile", label: "我的", icon: "material-symbols:person-rounded" },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function MobileTabBar() {
  const pathname = usePathname() ?? "/"
  const router = useRouter()
  const publishActive = isActive(pathname, "/publish")

  // Two pairs of tabs flank the center FAB.
  const left = TABS.slice(0, 2)
  const right = TABS.slice(2)

  return (
    <nav
      aria-label="主导航"
      className="sticky bottom-0 z-30 mt-auto flex h-16 items-stretch border-t border-shop-border-light bg-shop-bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "var(--shop-safe-bottom)" }}
    >
      {left.map((tab) => (
        <TabButton active={isActive(pathname, tab.href)} key={tab.href} {...tab} />
      ))}

      {/* Center FAB. Reserves a 64px slot so the bar layout stays balanced. */}
      <div className="relative flex w-16 shrink-0 items-start justify-center">
        <Button
          aria-current={publishActive ? "page" : undefined}
          aria-label="发布商品"
          className={`absolute -top-5 !size-14 !rounded-full shadow-shop-fab ${publishActive ? "ring-2 ring-shop-primary-soft" : ""}`}
          isIconOnly
          onPress={() => router.push("/publish")}
          variant="primary"
        >
          <Icon className="size-7" icon="material-symbols:add-rounded" />
        </Button>
      </div>

      {right.map((tab) => (
        <TabButton active={isActive(pathname, tab.href)} key={tab.href} {...tab} />
      ))}
    </nav>
  )
}

function TabButton({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: string
  active: boolean
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition active:scale-95 ${
        active ? "text-shop-primary" : "text-shop-text-tertiary hover:text-shop-text-secondary"
      }`}
      href={href}
    >
      {active ? (
        <m.span
          aria-hidden
          className="absolute top-1.5 h-1 w-1 rounded-full bg-shop-primary"
          layoutId="mobileTabIndicator"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      ) : null}
      <Icon className="size-6" icon={icon} />
      <span>{label}</span>
    </Link>
  )
}
