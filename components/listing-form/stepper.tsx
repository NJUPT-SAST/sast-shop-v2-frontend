"use client"

import { Icon } from "@iconify/react"

export type StepDescriptor = {
  key: string
  title: string
  /** Form fields validated when leaving this step. Last step usually [] (whole-form check on submit). */
  fields: ReadonlyArray<string>
  /** Optional one-line caption shown beneath the title on the desktop rail. */
  caption?: string
}

export function Stepper({
  steps,
  current,
  onStepClick,
  orientation = "vertical",
}: {
  steps: ReadonlyArray<StepDescriptor>
  current: number
  /** Called when user clicks a previously-completed step. Future steps are non-interactive. */
  onStepClick?: (index: number) => void
  orientation?: "vertical" | "horizontal"
}) {
  const isVertical = orientation === "vertical"
  return (
    <ol
      aria-label="发布步骤"
      className={
        isVertical
          ? "flex flex-col gap-1"
          : "flex w-full snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-1"
      }
    >
      {steps.map((s, i) => {
        const status: "done" | "current" | "todo" =
          i < current ? "done" : i === current ? "current" : "todo"
        const reachable = status !== "todo"
        return (
          <li
            className={
              isVertical ? "" : "min-w-[40%] shrink-0 snap-start sm:min-w-[33%] md:min-w-[25%]"
            }
            key={s.key}
          >
            <button
              aria-current={status === "current" ? "step" : undefined}
              className={`group flex w-full items-center gap-3 rounded-shop-md px-3 py-2 text-left transition ${
                status === "current"
                  ? "bg-shop-primary-wash"
                  : reachable
                    ? "hover:bg-shop-bg-tinted"
                    : "opacity-60"
              }`}
              disabled={!reachable || !onStepClick}
              onClick={() => reachable && onStepClick?.(i)}
              type="button"
            >
              <span
                aria-hidden
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  status === "done"
                    ? "bg-shop-success text-white"
                    : status === "current"
                      ? "bg-shop-primary text-white"
                      : "border border-shop-border bg-shop-bg-white text-shop-text-tertiary"
                }`}
              >
                {status === "done" ? (
                  <Icon className="size-4" icon="material-symbols:check" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[14px] font-medium ${
                    status === "current" ? "text-shop-primary" : "text-shop-text-primary"
                  }`}
                >
                  {s.title}
                </span>
                {isVertical && s.caption ? (
                  <span className="block truncate text-[11px] text-shop-text-tertiary">
                    {s.caption}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
