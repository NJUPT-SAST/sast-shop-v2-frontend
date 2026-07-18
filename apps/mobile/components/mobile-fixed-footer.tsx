"use client"

import { useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@workspace/ui/lib/utils"

export function MobileFixedFooter({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const isClient = useIsClient()

  const footer = (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-1/2 md:right-auto md:w-full md:max-w-3xl md:-translate-x-1/2 md:rounded-t-lg md:border",
        className
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 [&>[data-slot=button]]:min-h-11">
        {children}
      </div>
    </div>
  )

  if (!isClient) {
    return null
  }

  return createPortal(footer, document.body)
}

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

function emptySubscribe() {
  return () => {}
}
