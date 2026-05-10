"use client"

import { useScrollElevation } from "@/lib/hooks/use-scroll-elevation"
import { isTauri } from "@/lib/tauri"
import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"

export function MobileHeader({
  title,
  showBack,
  rightSlot,
}: {
  title: string
  showBack?: boolean
  rightSlot?: React.ReactNode
}) {
  const router = useRouter()
  const elevated = useScrollElevation(4)
  const draggable = isTauri()
  return (
    <header
      className={`sticky top-0 z-30 flex h-13 items-center gap-3 border-b px-3 backdrop-blur-md transition-all md:hidden ${
        elevated
          ? "border-shop-border-light bg-shop-bg-white/95 shadow-shop-sm"
          : "border-transparent bg-shop-bg-page/80"
      }`}
      data-tauri-drag-region={draggable ? "" : undefined}
      style={{ paddingTop: "var(--shop-safe-top)" }}
    >
      {showBack ? (
        <button
          aria-label="返回"
          className="shop-icon-btn"
          onClick={() => router.back()}
          type="button"
        >
          <Icon className="size-6" icon="material-symbols:arrow-back-rounded" />
        </button>
      ) : (
        <div aria-hidden className="size-11" />
      )}
      <h1 className="flex-1 truncate text-center text-[16px] font-semibold text-shop-text-primary">
        {title}
      </h1>
      {rightSlot ?? <div aria-hidden className="size-11" />}
    </header>
  )
}
