"use client"

import { StickyActionBar } from "@/components/layout/sticky-action-bar"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"

export function StepNavBar({
  isFirst,
  isLast,
  isSubmitting,
  onPrev,
  onNext,
  onClearDraft,
  submitLabel = "提交审核",
  nextLabel = "下一步",
}: {
  isFirst: boolean
  isLast: boolean
  isSubmitting: boolean
  onPrev: () => void
  /** No-op on last step (form's onSubmit is used instead via type="submit"). */
  onNext: () => void
  onClearDraft: () => void
  submitLabel?: string
  nextLabel?: string
}) {
  return (
    <StickyActionBar>
      {!isFirst ? (
        <Button isDisabled={isSubmitting} onPress={onPrev} variant="ghost">
          <Icon className="size-4" icon="material-symbols:arrow-back-rounded" /> 上一步
        </Button>
      ) : (
        <Button isDisabled={isSubmitting} onPress={onClearDraft} variant="ghost">
          清空草稿
        </Button>
      )}

      {isLast ? (
        <Button className="flex-1" isPending={isSubmitting} type="submit" variant="primary">
          {submitLabel}
        </Button>
      ) : (
        <Button className="flex-1" isDisabled={isSubmitting} onPress={onNext} variant="primary">
          {nextLabel}
          <Icon className="size-4" icon="material-symbols:arrow-forward-rounded" />
        </Button>
      )}
    </StickyActionBar>
  )
}
