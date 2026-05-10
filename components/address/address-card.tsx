"use client"

import type { Address } from "@/lib/stores/address-store"
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
        <button
          aria-checked={selected}
          aria-label="选择此地址"
          className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-shop-primary bg-shop-primary text-shop-text-on-primary" : "border-shop-border bg-shop-bg-white text-transparent"}`}
          onClick={onSelect}
          role="radio"
          type="button"
        >
          {selected ? (
            <Icon className="size-3" icon="material-symbols:check-small-rounded" />
          ) : null}
        </button>
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
          <div className="mt-1 flex gap-3 text-[12px]">
            {!address.isDefault && onSetDefault ? (
              <button
                className="text-shop-text-tertiary transition hover:text-shop-primary"
                onClick={onSetDefault}
                type="button"
              >
                设为默认
              </button>
            ) : null}
            {onEdit ? (
              <button
                className="text-shop-text-tertiary transition hover:text-shop-primary"
                onClick={onEdit}
                type="button"
              >
                编辑
              </button>
            ) : null}
            {onRemove ? (
              <button
                className="text-shop-text-tertiary transition hover:text-shop-danger"
                onClick={onRemove}
                type="button"
              >
                删除
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
