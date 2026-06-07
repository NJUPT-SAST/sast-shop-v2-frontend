// Client-side address book for /orders/confirm and /profile.
// API stores `shipping_address` as a flat string snapshot per order — this store
// keeps a richer structured form locally so users can pick from saved entries.

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Address = {
  id: string
  recipient: string
  phone: string
  province?: string
  city?: string
  district?: string
  detail: string
  isDefault: boolean
  createdAt: string
}

export type AddressInput = Omit<Address, "id" | "isDefault" | "createdAt"> & {
  isDefault?: boolean
}

type AddressState = {
  addresses: Address[]
  add: (input: AddressInput) => Address
  update: (id: string, patch: Partial<AddressInput>) => void
  remove: (id: string) => void
  setDefault: (id: string) => void
  getDefault: () => Address | undefined
}

function makeId(): string {
  return `addr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// Renders an Address into the snapshot string the API expects on createOrder.
export function formatAddress(a: Address): string {
  const region = [a.province, a.city, a.district].filter(Boolean).join(" ")
  const lines = [`${a.recipient} ${a.phone}`]
  if (region) lines.push(region)
  lines.push(a.detail)
  return lines.join("\n")
}

export const useAddressStore = create<AddressState>()(
  persist(
    (set, get) => ({
      addresses: [],

      add: (input) => {
        const isFirst = get().addresses.length === 0
        const next: Address = {
          id: makeId(),
          recipient: input.recipient,
          phone: input.phone,
          province: input.province,
          city: input.city,
          district: input.district,
          detail: input.detail,
          isDefault: input.isDefault ?? isFirst,
          createdAt: new Date().toISOString(),
        }
        set((s) => {
          const cleared = next.isDefault
            ? s.addresses.map((a) => ({ ...a, isDefault: false }))
            : s.addresses
          return { addresses: [next, ...cleared] }
        })
        return next
      },

      update: (id, patch) =>
        set((s) => {
          const willBeDefault = patch.isDefault === true
          return {
            addresses: s.addresses.map((a) => {
              if (a.id === id) return { ...a, ...patch, isDefault: willBeDefault || a.isDefault }
              if (willBeDefault) return { ...a, isDefault: false }
              return a
            }),
          }
        }),

      remove: (id) =>
        set((s) => {
          const removed = s.addresses.find((a) => a.id === id)
          const rest = s.addresses.filter((a) => a.id !== id)
          // If we removed the default, promote the first remaining.
          if (removed?.isDefault && rest.length > 0) {
            rest[0] = { ...rest[0], isDefault: true }
          }
          return { addresses: rest }
        }),

      setDefault: (id) =>
        set((s) => ({
          addresses: s.addresses.map((a) => ({ ...a, isDefault: a.id === id })),
        })),

      getDefault: () => get().addresses.find((a) => a.isDefault) ?? get().addresses[0],
    }),
    {
      name: "sast-shop:addresses",
      version: 1,
    }
  )
)
