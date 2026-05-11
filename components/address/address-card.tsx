"use client"

import type { Address } from "@/lib/stores/address-store"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"

type Props = {
  address: Address
  selected?: boolean
  onSelect?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onSetDefault?: () => void
  variant?: "interactive" | "readonly"
}

export function AddressCard({
  address,
  selected,
  onSelect,
  onEdit,
  onRemove,
  onSetDefault,
  variant = "interactive",
}: Props) {
  const region = [address.province, address.city, address.district].filter(Boolean).join(" ")
  const interactive = variant === "interactive"
  return (
    <div
      className={`flex items-start gap-3 rounded-shop-md border bg-shop-bg-white p-4 transition ${
        selected ? "border-shop-primary shadow-shop-md" : "border-shop-border-light shadow-shop-sm"
      }`}
    >
      {interactive && onSelect ? (
        <Button
          aria-label={selected ? "已选择此地址" : "选择此地址"}
          aria-pressed={selected}
          className={`!size-5 !min-w-0 !rounded-full !p-0 ${selected ? "!bg-shop-primary !text-shop-text-on-primary" : ""}`}
          isIconOnly
          onPress={onSelect}
          size="sm"
          variant={selected ? "primary" : "outline"}
        >
          {selected ? (
            <Icon className="size-3" icon="material-symbols:check-small-rounded" />
          ) : null}
        </Button>
      ) : null}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[15px] font-semibold text-shop-text-primary">
            {address.recipient}
          </span>
          <span className="text-[13px] text-shop-text-secondary tabular-nums">{address.phone}</span>
          {address.isDefault ? (
            <span className="rounded-shop-xs bg-shop-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-shop-primary-press">
              默认
            </span>
          ) : null}
        </div>
        <p className="text-[13px] leading-[18px] text-shop-text-secondary">
          {region ? `${region} · ` : ""}
          {address.detail}
        </p>
        {interactive ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {!address.isDefault && onSetDefault ? (
              <Button onPress={onSetDefault} size="sm" variant="ghost">
                设为默认
              </Button>
            ) : null}
            {onEdit ? (
              <Button onPress={onEdit} size="sm" variant="ghost">
                编辑
              </Button>
            ) : null}
            {onRemove ? (
              <Button onPress={onRemove} size="sm" variant="ghost">
                删除
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
