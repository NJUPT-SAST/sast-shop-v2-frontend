"use client"

import { CATEGORIES, CATEGORY_ICONS, CATEGORY_LABELS, type Category } from "@/lib/categories"
import { ToggleButton, ToggleButtonGroup } from "@heroui/react"
import { Icon } from "@iconify/react"

type Props = {
  value: Category | null
  onChange: (next: Category | null) => void
  className?: string
}

const ALL_KEY = "__all__"

export function CategoryChips({ value, onChange, className }: Props) {
  const selectedKey = value ?? ALL_KEY
  return (
    <div aria-label="商品分类" className={`-mx-4 overflow-x-auto px-4 pb-1 ${className ?? ""}`}>
      <ToggleButtonGroup
        aria-label="商品分类"
        disallowEmptySelection
        isDetached
        onSelectionChange={(keys) => {
          const first = Array.from(keys)[0] as string | undefined
          if (!first || first === ALL_KEY) {
            onChange(null)
          } else {
            onChange(first as Category)
          }
        }}
        selectedKeys={new Set([selectedKey])}
        selectionMode="single"
        size="sm"
      >
        <ToggleButton id={ALL_KEY}>
          <Icon className="size-4" icon="material-symbols:apps-rounded" />
          全部
        </ToggleButton>
        {CATEGORIES.map((c) => (
          <ToggleButton id={c} key={c}>
            <Icon className="size-4" icon={CATEGORY_ICONS[c]} />
            {CATEGORY_LABELS[c]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  )
}
