"use client"

import { useIsDesktop } from "@/lib/hooks/use-media-query"
import { AnimatePresence, m } from "motion/react"
import { useEffect } from "react"
import { BottomSheet } from "./sheet"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  ariaLabel?: string
  children: React.ReactNode
  /** Maximum width of the modal on desktop (defaults to 28rem ~ 448px). */
  desktopMaxWidthClass?: string
}

const dialogVariants = {
  closed: { opacity: 0, scale: 0.96, y: 8 },
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 400, damping: 30 },
  },
}

const overlayVariants = {
  closed: { opacity: 0, transition: { duration: 0.15 } },
  open: { opacity: 1, transition: { duration: 0.18 } },
}

// Renders a centered modal on desktop, a bottom sheet on mobile.
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  ariaLabel,
  children,
  desktopMaxWidthClass = "max-w-md",
}: Props) {
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (!open || !isDesktop) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, isDesktop])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  if (!isDesktop) {
    return (
      <BottomSheet ariaLabel={ariaLabel} onOpenChange={onOpenChange} open={open} title={title}>
        {children}
      </BottomSheet>
    )
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
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <m.div
              animate="open"
              aria-label={title ?? ariaLabel}
              aria-modal
              className={`pointer-events-auto w-full ${desktopMaxWidthClass} rounded-shop-lg bg-shop-bg-white shadow-shop-xl`}
              exit="closed"
              initial="closed"
              role="dialog"
              variants={dialogVariants}
            >
              {title ? (
                <h2 className="border-b border-shop-border-light px-5 py-3 text-[16px] font-semibold text-shop-text-primary">
                  {title}
                </h2>
              ) : null}
              <div className="p-5">{children}</div>
            </m.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
