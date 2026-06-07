"use client"

import { AnimatePresence, type PanInfo, m } from "motion/react"
import { useEffect } from "react"

type SheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  /** Show the drag handle at the top of the sheet. */
  showHandle?: boolean
  /** Aria label when no title is provided. */
  ariaLabel?: string
}

const overlayVariants = {
  closed: { opacity: 0, transition: { duration: 0.18 } },
  open: { opacity: 1, transition: { duration: 0.18 } },
}

const sheetVariants = {
  closed: { y: "100%", transition: { duration: 0.2 } },
  open: { y: 0, transition: { type: "spring" as const, stiffness: 380, damping: 36 } },
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  title,
  showHandle = true,
  ariaLabel,
}: SheetProps) {
  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Esc to close.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 600) onOpenChange(false)
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <m.div
            animate="open"
            aria-hidden
            className="fixed inset-0 z-40 bg-shop-bg-overlay backdrop-blur-sm"
            exit="closed"
            initial="closed"
            onClick={() => onOpenChange(false)}
            variants={overlayVariants}
          />
          <m.div
            animate="open"
            aria-label={title ?? ariaLabel}
            aria-modal
            className="shop-sheet"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            drag="y"
            exit="closed"
            initial="closed"
            onDragEnd={handleDragEnd}
            role="dialog"
            variants={sheetVariants}
          >
            {showHandle ? <div aria-hidden className="shop-sheet__handle" /> : null}
            {title ? (
              <h2 className="px-5 pt-3 text-[16px] font-semibold text-shop-text-primary">
                {title}
              </h2>
            ) : null}
            <div className="px-5 pt-3 pb-2">{children}</div>
          </m.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
