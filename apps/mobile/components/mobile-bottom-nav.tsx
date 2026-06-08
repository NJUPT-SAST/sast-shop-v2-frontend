"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, type MouseEvent } from "react"
import {
  RiAddLine,
  RiArrowRightSLine,
  RiFileList3Line,
  RiGroupLine,
  RiStore2Line,
  RiStoreLine,
  RiUser3Line,
} from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { cn } from "@workspace/ui/lib/utils"
import { useMobileScroll } from "./mobile-scroll-context"

const navItems = [
  { label: "商城", href: "/shop", icon: RiStore2Line },
  { label: "团购", href: "/group", icon: RiGroupLine },
  { label: "订单", href: "/orders", icon: RiFileList3Line },
  { label: "我的", href: "/profile", icon: RiUser3Line },
] as const

const NAV_CLICK_DEBOUNCE_MS = 350

const publishActions = [
  {
    label: "上架现货",
    description: "把手头库存发布到商城，买家可直接付款。",
    href: "/publish/spot",
    icon: RiStoreLine,
  },
] as const

export function MobileBottomNav() {
  const pathname = usePathname()
  const lastCurrentRoutePressAtRef = useRef(0)
  const { handleCurrentRoutePress, scrollToTop } = useMobileScroll()

  function handleNavClick(event: MouseEvent<HTMLAnchorElement>, isActive: boolean) {
    if (isActive) {
      const now = Date.now()
      event.preventDefault()

      if (
        now - lastCurrentRoutePressAtRef.current <
        NAV_CLICK_DEBOUNCE_MS
      ) {
        return
      }

      lastCurrentRoutePressAtRef.current = now
      handleCurrentRoutePress()
      return
    }

    scrollToTop()
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

        <Drawer>
          <DrawerTrigger asChild>
            <Button
              type="button"
              size="icon-lg"
              className="-mt-8 size-14 rounded-full"
              aria-label="打开发布入口"
            >
              <RiAddLine data-icon="inline-start" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="mx-auto w-full max-w-md">
              <DrawerHeader className="px-0 text-left">
                <DrawerTitle>发布</DrawerTitle>
                <DrawerDescription>
                  现货发布走商城，跑腿补货入口保留在团购页。
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex flex-col gap-2 pb-4">
                {publishActions.map((action) => (
                  <DrawerClose key={action.href} asChild>
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-auto min-h-16 justify-start rounded-lg px-4 py-3"
                    >
                      <Link href={action.href}>
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                          <action.icon />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-medium">
                            {action.label}
                          </span>
                          <span className="block truncate text-xs font-normal text-muted-foreground">
                            {action.description}
                          </span>
                        </span>
                        <RiArrowRightSLine data-icon="inline-end" />
                      </Link>
                    </Button>
                  </DrawerClose>
                ))}
              </div>
            </div>
          </DrawerContent>
        </Drawer>

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
  )
}

function NavLink({
  item,
  pathname,
  onNavClick,
}: {
  item: (typeof navItems)[number]
  pathname: string
  onNavClick: (event: MouseEvent<HTMLAnchorElement>, isActive: boolean) => void
}) {
  const isActive = pathname.startsWith(item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      onClick={(event) => onNavClick(event, isActive)}
      className={cn(
        "flex min-w-14 flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="size-5" />
      <span>{item.label}</span>
    </Link>
  )
}
