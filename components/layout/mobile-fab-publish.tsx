"use client"

import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"

// Floating action button anchored above the mobile tab bar via the bar's center notch.
export function MobileFabPublish() {
  const router = useRouter()
  return (
    <Button
      aria-label="发布商品"
      className="!size-14 !rounded-full shadow-shop-fab"
      isIconOnly
      onPress={() => router.push("/publish")}
      variant="primary"
    >
      <Icon className="size-7" icon="material-symbols:add-rounded" />
    </Button>
  )
}
