"use client"

import { CATEGORIES, CATEGORY_ICONS, CATEGORY_LABELS, type Category } from "@/lib/categories"
import { Icon } from "@iconify/react"

type Props = {
  value: Category | null
  onChange: (next: Category | null) => void
  className?: string
}

export function CategoryChips({ value, onChange, className }: Props) {
  return (
    <div
      aria-label="商品分类"
      className={`scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 ${className ?? ""}`}
      role="radiogroup"
    >
      <Chip
        active={value === null}
        icon="material-symbols:apps-rounded"
        label="全部"
        onPress={() => onChange(null)}
      />
      {CATEGORIES.map((c) => (
        <Chip
          active={value === c}
          icon={CATEGORY_ICONS[c]}
          key={c}
          label={CATEGORY_LABELS[c]}
          onPress={() => onChange(c)}
        />
      ))}
    </div>
  )
}

function Chip({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean
  icon: string
  label: string
  onPress: () => void
}) {
  return (
    <button
      aria-checked={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-shop-pill border px-3 py-1.5 text-[13px] transition active:scale-95 ${
        active
          ? "border-shop-primary bg-shop-primary text-shop-text-on-primary"
          : "border-shop-border bg-shop-bg-white text-shop-text-secondary hover:border-shop-primary hover:text-shop-primary"
      }`}
      onClick={onPress}
      role="radio"
      type="button"
    >
      <Icon className="size-4" icon={icon} />
      <span>{label}</span>
    </button>
  )
}
