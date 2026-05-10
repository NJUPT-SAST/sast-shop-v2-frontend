"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"

// 56x56 coral FAB that lifts above the bottom tab bar via a notch.
// Tapping it routes to /publish.
export function MobileFabPublish() {
  const router = useRouter()
  return (
    <button
      aria-label="发布商品"
      className="shop-fab"
      onClick={() => router.push("/publish")}
      type="button"
    >
      <Icon className="size-7" icon="material-symbols:add-rounded" />
    </button>
  )
}
