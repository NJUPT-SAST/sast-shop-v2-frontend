"use client"

import type { ReactNode } from "react"
import { type StepDescriptor, Stepper } from "./stepper"

/**
 * Layout for stepper-based forms:
 *   - Mobile (< md): horizontal sticky step indicator at top + content full-width
 *   - Desktop (md+): vertical sticky rail on the left + content on the right
 *
 * The form's <header> can be passed via `desktopHeader` so titles only show on PC.
 */
export function StepShell({
  steps,
  current,
  onStepClick,
  desktopHeader,
  children,
}: {
  steps: ReadonlyArray<StepDescriptor>
  current: number
  onStepClick?: (index: number) => void
  desktopHeader?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 pb-28 md:flex-row md:gap-8 md:px-8 md:py-8">
      {/* Mobile: horizontal stepper */}
      <div className="sticky top-13 z-10 -mx-4 bg-shop-bg-page/95 px-4 py-2 backdrop-blur-md md:hidden">
        <Stepper
          current={current}
          onStepClick={onStepClick}
          orientation="horizontal"
          steps={steps}
        />
      </div>

      {/* Desktop: left rail */}
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-8 flex flex-col gap-3">
          {desktopHeader}
          <Stepper
            current={current}
            onStepClick={onStepClick}
            orientation="vertical"
            steps={steps}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3 md:gap-4">{children}</div>
    </div>
  )
}
