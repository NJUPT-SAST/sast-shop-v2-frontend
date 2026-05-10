"use client"

import { ResponsiveSheet } from "@/components/motion/responsive-sheet"
import { Button } from "@heroui/react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive,
  loading,
  onConfirm,
}: Props) {
  async function handleConfirm() {
    await onConfirm()
    onOpenChange(false)
  }
  return (
    <ResponsiveSheet onOpenChange={onOpenChange} open={open} title={title}>
      <div className="flex flex-col gap-4">
        {description ? (
          <div className="text-[14px] leading-[20px] text-shop-text-secondary">{description}</div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button isDisabled={loading} onPress={() => onOpenChange(false)} variant="ghost">
            {cancelLabel}
          </Button>
          <Button
            isPending={loading}
            onPress={handleConfirm}
            variant={destructive ? "danger" : "primary"}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ResponsiveSheet>
  )
}
