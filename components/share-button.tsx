"use client"

import { notify } from "@/lib/utils/toast"
import { Button, Tooltip } from "@heroui/react"
import { Icon } from "@iconify/react"

type Props = {
  title?: string
  text?: string
  url?: string
  className?: string
}

export function ShareButton({ title, text, url, className }: Props) {
  async function handleShare() {
    const target = url ?? (typeof window !== "undefined" ? window.location.href : "")
    if (!target) return
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url: target })
        return
      } catch {
        // User cancelled or unsupported — fall through to clipboard.
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(target)
      notify({ title: "链接已复制", color: "success" })
    }
  }

  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button
          aria-label="分享"
          className={`!size-11 !rounded-full ${className ?? ""}`}
          isIconOnly
          onPress={handleShare}
          variant="ghost"
        >
          <Icon className="size-5" icon="material-symbols:share-rounded" />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>分享</Tooltip.Content>
    </Tooltip>
  )
}
