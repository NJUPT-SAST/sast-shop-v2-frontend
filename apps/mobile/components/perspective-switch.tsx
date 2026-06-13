"use client"

import { useId, useRef, type KeyboardEvent } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { OrderOption, OrderView } from "@/lib/order-filters"

type PerspectiveSwitchProps<TValue extends OrderView> = {
  label: string
  value: TValue
  options: OrderOption<TValue>[]
  onValueChange: (value: TValue) => void
  className?: string
}

export function PerspectiveSwitch<TValue extends OrderView>({
  label,
  value,
  options,
  onValueChange,
  className,
}: PerspectiveSwitchProps<TValue>) {
  const labelId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0
  )

  function moveSelection(direction: 1 | -1) {
    if (options.length === 0) {
      return
    }

    const nextIndex =
      (activeIndex + direction + options.length) % options.length
    const nextOption = options[nextIndex]

    if (nextOption) {
      onValueChange(nextOption.value)
      buttonRefs.current[nextIndex]?.focus()
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      moveSelection(1)
      return
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      moveSelection(-1)
    }
  }

  return (
    <div className={cn("flex items-center", className)}>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="relative grid h-8 min-w-32 grid-cols-2 rounded-full bg-muted p-0.5 text-xs font-semibold text-muted-foreground shadow-inner"
        onKeyDown={handleKeyDown}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-primary transition-transform duration-200 ease-out"
          style={{
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        {options.map((option, index) => {
          const selected = option.value === value

          return (
            <button
              key={option.value}
              ref={(node) => {
                buttonRefs.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "relative z-10 overflow-hidden rounded-full px-3 text-ellipsis whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onValueChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
