"use client"

import { Icon } from "@iconify/react"

type Props = {
  checked: boolean
  indeterminate?: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
  className?: string
}

// Tri-state checkbox (off / on / mixed) — HeroUI v3 Checkbox doesn't expose
// the indeterminate flag yet, so we render a custom one with Iconify.
export function RowSelectCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  className,
}: Props) {
  const visualState = indeterminate ? "indeterminate" : checked ? "checked" : "off"
  return (
    <button
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel ?? "选择行"}
      className={`inline-flex size-5 items-center justify-center rounded border transition ${
        visualState === "off"
          ? "border-shop-border bg-shop-bg-white text-transparent hover:border-shop-primary"
          : "border-shop-primary bg-shop-primary text-shop-text-on-primary"
      } ${className ?? ""}`}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      role="checkbox"
      type="button"
    >
      {visualState === "checked" ? (
        <Icon className="size-3.5" icon="material-symbols:check-small-rounded" />
      ) : visualState === "indeterminate" ? (
        <Icon className="size-3.5" icon="material-symbols:remove-rounded" />
      ) : null}
    </button>
  )
}
