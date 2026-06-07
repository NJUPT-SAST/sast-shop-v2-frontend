"use client"

import { useAuthStore } from "@/lib/stores/auth-store"
import { usePreferenceStore } from "@/lib/stores/preference-store"
import { Avatar, Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export type SidebarItem = {
  href: string
  label: string
  icon: string
  adminOnly?: boolean
}

const SHOP_NAV: SidebarItem[] = [
  { href: "/", label: "首页", icon: "material-symbols:home-rounded" },
  { href: "/secondhand", label: "二手商城", icon: "material-symbols:storefront-rounded" },
  { href: "/crowdfund", label: "众筹专区", icon: "material-symbols:campaign-rounded" },
  { href: "/orders", label: "我的订单", icon: "material-symbols:receipt-long-rounded" },
  { href: "/publish", label: "发布商品", icon: "material-symbols:add-circle-rounded" },
  { href: "/profile", label: "个人中心", icon: "material-symbols:person-rounded" },
]

const ADMIN_NAV: SidebarItem[] = [
  {
    adminOnly: true,
    href: "/admin",
    icon: "material-symbols:dashboard-rounded",
    label: "管理首页",
  },
  {
    adminOnly: true,
    href: "/admin/reviews",
    icon: "material-symbols:fact-check-rounded",
    label: "审核队列",
  },
  {
    adminOnly: true,
    href: "/admin/listings",
    icon: "material-symbols:inventory-2-rounded",
    label: "全部商品",
  },
  {
    adminOnly: true,
    href: "/admin/orders",
    icon: "material-symbols:assignment-rounded",
    label: "全部订单",
  },
]

function isItemActive(pathname: string, item: SidebarItem): boolean {
  if (item.href === "/") return pathname === "/"
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export function PCSidebar() {
  const pathname = usePathname() ?? "/"
  const isAdmin = useAuthStore((s) => s.user?.is_admin === true)
  const user = useAuthStore((s) => s.user)
  const collapsed = usePreferenceStore((s) => s.sidebarCollapsed)
  const toggleSidebar = usePreferenceStore((s) => s.toggleSidebar)

  return (
    <aside
      aria-label="主导航"
      className={`sticky top-0 hidden h-[100svh] shrink-0 self-start overflow-hidden border-r border-shop-border-light bg-shop-bg-white transition-[width] md:flex md:flex-col ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className={`flex items-center gap-2 px-4 py-4 ${collapsed ? "justify-center" : ""}`}>
        <Link
          aria-label="SAST Shop 首页"
          className={`flex size-9 items-center justify-center rounded-shop-md bg-shop-primary text-shop-text-on-primary shadow-shop-sm transition active:scale-95 ${collapsed ? "" : "shrink-0"}`}
          href="/"
        >
          <Icon className="size-5" icon="material-symbols:storefront-rounded" />
        </Link>
        {!collapsed ? (
          <span className="truncate text-[15px] font-semibold text-shop-text-primary">
            SAST Shop
          </span>
        ) : null}
        {!collapsed ? (
          <Button
            aria-label="折叠侧边栏"
            className="ml-auto"
            isIconOnly
            onPress={toggleSidebar}
            size="sm"
            variant="ghost"
          >
            <Icon className="size-4" icon="material-symbols:dock-to-right-rounded" />
          </Button>
        ) : null}
      </div>
      {collapsed ? (
        <Button
          aria-label="展开侧边栏"
          className="mx-auto"
          isIconOnly
          onPress={toggleSidebar}
          size="sm"
          variant="ghost"
        >
          <Icon className="size-4" icon="material-symbols:dock-to-left-rounded" />
        </Button>
      ) : null}
      <hr className="border-shop-border-light" />
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {SHOP_NAV.map((item) => (
          <NavLink
            active={isItemActive(pathname, item)}
            collapsed={collapsed}
            item={item}
            key={item.href}
          />
        ))}
        {isAdmin ? (
          <>
            <div
              className={`mt-4 mb-1 ${collapsed ? "border-t-2 border-shop-border-light" : "px-3 text-[11px] font-semibold uppercase tracking-widest text-shop-text-tertiary"}`}
            >
              {collapsed ? null : "管理"}
            </div>
            {ADMIN_NAV.map((item) => (
              <NavLink
                active={isItemActive(pathname, item)}
                collapsed={collapsed}
                item={item}
                key={item.href}
              />
            ))}
          </>
        ) : null}
      </nav>
      <div
        className={`mt-auto m-2 rounded-shop-md bg-shop-bg-tinted p-2 ${collapsed ? "flex justify-center" : ""}`}
      >
        {user ? (
          <Link
            aria-label="个人中心"
            className={`flex items-center gap-2 ${collapsed ? "" : "w-full"}`}
            href="/profile"
          >
            <Avatar className="shrink-0" color="accent" size="sm">
              {user.avatar_url ? <Avatar.Image alt="" src={user.avatar_url} /> : null}
              <Avatar.Fallback>{user.name.slice(0, 1)}</Avatar.Fallback>
            </Avatar>
            {!collapsed ? (
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium text-shop-text-primary">
                  {user.name}
                </span>
                <span className="truncate text-[11px] text-shop-text-tertiary">
                  {user.is_admin ? "管理员" : (user.department ?? "用户")}
                </span>
              </div>
            ) : null}
          </Link>
        ) : (
          <Link
            aria-label="登录"
            className="flex w-full items-center justify-center gap-2 rounded-shop-sm bg-shop-primary px-3 py-2 text-[13px] font-medium text-shop-text-on-primary transition active:scale-95"
            href="/profile"
          >
            <Icon className="size-4" icon="material-symbols:login-rounded" />
            {!collapsed ? <span>登录</span> : null}
          </Link>
        )}
      </div>
    </aside>
  )
}

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: SidebarItem
  active: boolean
  collapsed: boolean
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`relative flex items-center gap-3 rounded-shop-sm px-3 py-2 text-[14px] transition ${
        active
          ? "bg-shop-primary-wash font-semibold text-shop-primary"
          : "text-shop-text-secondary hover:bg-shop-bg-tinted hover:text-shop-text-primary"
      } ${collapsed ? "justify-center" : ""}`}
      href={item.href}
      title={collapsed ? item.label : undefined}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-shop-primary"
        />
      ) : null}
      <Icon className="size-5 shrink-0" icon={item.icon} />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  )
}
