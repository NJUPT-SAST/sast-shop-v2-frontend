"use client"

import { Button, CloseButton } from "@heroui/react"
import { AnimatePresence, m } from "motion/react"
import type { ReactNode } from "react"

type Props = {
  count: number
  onClear: () => void
  children: ReactNode
  /** Custom label for the count summary, e.g. "已选 3 条审核". */
  label?: string
}

// Sticky bar that animates in when at least one row is selected.
// Children are the right-aligned action buttons.
export function BulkActionBar({ count, onClear, children, label }: Props) {
  return (
    <AnimatePresence>
      {count > 0 ? (
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30 mb-3 flex items-center gap-3 rounded-shop-md border border-shop-primary-soft bg-shop-primary-wash/95 px-4 py-2.5 shadow-shop-md backdrop-blur"
          exit={{ opacity: 0, y: -8 }}
          initial={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <CloseButton aria-label="清空选择" onPress={onClear} />
          <span className="text-[14px] font-medium text-shop-text-primary">
            {label ?? `已选 ${count} 项`}
          </span>
          <div className="ml-auto flex items-center gap-2">{children}</div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

export { Button }
