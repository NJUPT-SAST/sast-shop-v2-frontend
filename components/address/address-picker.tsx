"use client"

import { AddressCard } from "@/components/address/address-card"
import { AddressForm } from "@/components/address/address-form"
import { ResponsiveSheet } from "@/components/motion/responsive-sheet"
import { EmptyState } from "@/components/states/empty-state"
import { type Address, useAddressStore } from "@/lib/stores/address-store"
import { Button } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useState } from "react"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Currently selected address id (when picking). */
  selectedId?: string | null
  /** Picker mode: select an address & close. Manage mode: CRUD only. */
  mode?: "pick" | "manage"
  onPick?: (address: Address) => void
}

type View = "list" | "form"

export function AddressPicker({ open, onOpenChange, selectedId, mode = "pick", onPick }: Props) {
  const addresses = useAddressStore((s) => s.addresses)
  const add = useAddressStore((s) => s.add)
  const update = useAddressStore((s) => s.update)
  const remove = useAddressStore((s) => s.remove)
  const setDefault = useAddressStore((s) => s.setDefault)

  const [view, setView] = useState<View>("list")
  const [editing, setEditing] = useState<Address | undefined>(undefined)

  function backToList() {
    setView("list")
    setEditing(undefined)
  }

  return (
    <ResponsiveSheet
      onOpenChange={(next) => {
        if (!next) backToList()
        onOpenChange(next)
      }}
      open={open}
      title={view === "form" ? (editing ? "编辑地址" : "新建地址") : "我的收货地址"}
    >
      {view === "form" ? (
        <AddressForm
          initial={editing}
          onCancel={backToList}
          onSubmit={(input) => {
            if (editing) {
              update(editing.id, input)
            } else {
              add(input)
            }
            backToList()
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {addresses.length === 0 ? (
            <EmptyState
              description="新建一个地址，以后下单不用每次重写"
              icon="material-symbols:home-outline-rounded"
              title="还没有保存的地址"
            />
          ) : (
            <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
              {addresses.map((a) => (
                <AddressCard
                  address={a}
                  key={a.id}
                  onEdit={() => {
                    setEditing(a)
                    setView("form")
                  }}
                  onRemove={() => {
                    if (window.confirm(`删除地址「${a.detail}」？`)) remove(a.id)
                  }}
                  onSelect={
                    mode === "pick"
                      ? () => {
                          onPick?.(a)
                          onOpenChange(false)
                        }
                      : undefined
                  }
                  onSetDefault={() => setDefault(a.id)}
                  selected={mode === "pick" ? selectedId === a.id : a.isDefault}
                />
              ))}
            </div>
          )}
          <Button onPress={() => setView("form")} variant="ghost">
            <Icon className="size-4" icon="material-symbols:add-rounded" />
            新建地址
          </Button>
        </div>
      )}
    </ResponsiveSheet>
  )
}
