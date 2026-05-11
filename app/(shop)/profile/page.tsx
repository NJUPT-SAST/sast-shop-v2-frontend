"use client"

import { AddressPicker } from "@/components/address/address-picker"
import { MobileHeader } from "@/components/layout/mobile-header"
import { useAuthMe, useLogout, useOrders } from "@/lib/api/queries"
import { useAddressStore } from "@/lib/stores/address-store"
import { usePreferenceStore } from "@/lib/stores/preference-store"
import { isTauri, openExternal } from "@/lib/tauri"
import { Avatar, Button, Skeleton, Switch } from "@heroui/react"
import { Icon } from "@iconify/react"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function ProfilePage() {
  const { data: me, isPending } = useAuthMe()
  const logout = useLogout()
  const myOrders = useOrders({ role: "buyer", limit: 50 })
  const myListings = useOrders({ role: "seller", limit: 50 })
  const addresses = useAddressStore((s) => s.addresses)
  const theme = usePreferenceStore((s) => s.theme)
  const setTheme = usePreferenceStore((s) => s.setTheme)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Apply selected theme to <html data-theme> on mount and when changed.
  useEffect(() => {
    if (typeof document === "undefined") return
    const html = document.documentElement
    if (theme === "dark") html.dataset.theme = "dark"
    else if (theme === "light") delete html.dataset.theme
    else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (prefersDark) html.dataset.theme = "dark"
      else delete html.dataset.theme
    }
  }, [theme])

  function handleLogin() {
    const url = "/api/auth/feishu/login?redirect=/profile"
    if (isTauri()) {
      void openExternal(window.location.origin + url)
    } else {
      window.location.href = url
    }
  }

  return (
    <>
      <MobileHeader title="个人中心" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 md:gap-4 md:px-8 md:py-8">
        {isPending ? (
          <Skeleton className="h-32 w-full rounded-shop-lg" />
        ) : me ? (
          <section className="shop-section flex !flex-row items-center gap-4">
            <Avatar
              className="size-14 shrink-0 shadow-shop-md bg-gradient-to-br from-shop-primary to-shop-primary-hover"
              color="accent"
              size="lg"
            >
              {me.avatar_url ? <Avatar.Image alt={me.name} src={me.avatar_url} /> : null}
              <Avatar.Fallback className="text-[18px] font-semibold text-shop-text-on-primary">
                {me.name.slice(0, 1)}
              </Avatar.Fallback>
            </Avatar>
            <div className="flex flex-1 flex-col">
              <span className="text-[16px] font-semibold text-shop-text-primary">{me.name}</span>
              <span className="text-[12px] text-shop-text-tertiary">
                {me.department || me.email || "—"}
                {me.is_admin ? " · 管理员" : ""}
              </span>
            </div>
          </section>
        ) : (
          <section className="shop-section flex flex-col items-center gap-3 py-8 text-center">
            <Icon
              className="size-10 text-shop-primary"
              icon="material-symbols:waving-hand-rounded"
            />
            <p className="text-[14px] text-shop-text-secondary">登录飞书后即可下单与上架</p>
            <Button onPress={handleLogin} variant="primary">
              <Icon className="size-4" icon="material-symbols:login-rounded" />
              飞书登录
            </Button>
          </section>
        )}

        {me ? (
          <section className="grid grid-cols-3 gap-2 rounded-shop-lg bg-shop-bg-white p-4 shadow-shop-sm">
            <Stat label="买入订单" value={myOrders.data?.total ?? 0} />
            <Stat label="卖出订单" value={myListings.data?.total ?? 0} />
            <Stat label="保存地址" value={addresses.length} />
          </section>
        ) : null}

        <section className="grid grid-cols-2 gap-2">
          <ShortcutCard
            href="/orders"
            icon="material-symbols:receipt-long-rounded"
            title="我的订单"
          />
          <ShortcutCard
            href="/my/listings"
            icon="material-symbols:storefront-outline-rounded"
            title="我发布的"
          />
          <ShortcutCard
            href="/publish"
            icon="material-symbols:add-circle-rounded"
            title="发布商品"
          />
          <Button
            className="shop-row !rounded-shop-md w-full"
            onPress={() => setPickerOpen(true)}
            variant="ghost"
          >
            <div className="shop-row__leading">
              <Icon className="size-5" icon="material-symbols:home-pin-rounded" />
            </div>
            <span className="shop-row__title text-left">收货地址簿</span>
            <Icon className="shop-row__chevron" icon="material-symbols:chevron-right-rounded" />
          </Button>
          {me?.is_admin ? (
            <ShortcutCard
              href="/admin"
              icon="material-symbols:dashboard-rounded"
              title="管理后台"
            />
          ) : null}
        </section>

        <section className="shop-section">
          <h2 className="shop-section__title">偏好设置</h2>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-shop-text-primary">深色主题</span>
              <span className="text-[12px] text-shop-text-tertiary">跟随当前选择立即生效</span>
            </div>
            <Switch
              isSelected={theme === "dark"}
              onChange={(v) => setTheme(v ? "dark" : "light")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-shop-text-primary">跟随系统</span>
              <span className="text-[12px] text-shop-text-tertiary">根据系统外观自动切换</span>
            </div>
            <Switch
              isSelected={theme === "system"}
              onChange={(v) => setTheme(v ? "system" : theme === "dark" ? "dark" : "light")}
            />
          </div>
        </section>

        {me ? (
          <Button isPending={logout.isPending} onPress={() => logout.mutate()} variant="ghost">
            <Icon className="size-4" icon="material-symbols:logout-rounded" />
            退出登录
          </Button>
        ) : null}
      </div>
      <AddressPicker mode="manage" onOpenChange={setPickerOpen} open={pickerOpen} />
    </>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[20px] font-bold tabular-nums text-shop-primary">{value}</span>
      <span className="text-[12px] text-shop-text-tertiary">{label}</span>
    </div>
  )
}

function ShortcutCard({ href, icon, title }: { href: string; icon: string; title: string }) {
  return (
    <Link className="shop-row !rounded-shop-md" href={href}>
      <div className="shop-row__leading">
        <Icon className="size-5" icon={icon} />
      </div>
      <span className="shop-row__title text-left">{title}</span>
      <Icon className="shop-row__chevron" icon="material-symbols:chevron-right-rounded" />
    </Link>
  )
}
