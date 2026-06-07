"use client"

import { Checkbox } from "@heroui/react"
import type { MouseEvent } from "react"

type Props = {
  checked: boolean
  indeterminate?: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
  className?: string
}

// Tri-state checkbox (off / on / mixed) built on HeroUI v3 Checkbox.
// stopPropagation prevents row-click handlers from firing when the user toggles
// selection inside a clickable DataTable row.
export function RowSelectCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  className,
}: Props) {
  return (
    <span className={className} onClick={(e: MouseEvent) => e.stopPropagation()}>
      <Checkbox
        aria-label={ariaLabel ?? "选择行"}
        isIndeterminate={indeterminate}
        isSelected={checked}
        onChange={onChange}
      >
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox>
    </span>
  )
}
