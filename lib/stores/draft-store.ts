// Persisted publish-form drafts. Each slot stores the form's last `watch()` snapshot
// so users can leave the page and resume later. Slots are separate so all 3 form
// types can carry independent drafts simultaneously. v2 adds optional `lastStep`
// so multi-step crowdfund flows resume at the same step the user left.

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type DraftSlot = "secondhand" | "vote" | "presale"

export type DraftEntry<T = unknown> = {
  values: T
  updatedAt: string
  /** For stepper-based forms (crowdfund). Optional — undefined for single-page (secondhand). */
  lastStep?: number
}

type DraftState = {
  drafts: Partial<Record<DraftSlot, DraftEntry>>
  set: <T>(slot: DraftSlot, values: T, lastStep?: number) => void
  // biome-ignore lint/suspicious/noExplicitAny: callers cast to a known shape via the second type param
  get: <T = any>(slot: DraftSlot) => DraftEntry<T> | undefined
  clear: (slot: DraftSlot) => void
  clearAll: () => void
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      set: (slot, values, lastStep) =>
        set((s) => {
          const prev = s.drafts[slot]
          return {
            drafts: {
              ...s.drafts,
              [slot]: {
                values,
                updatedAt: new Date().toISOString(),
                lastStep: lastStep ?? prev?.lastStep,
              },
            },
          }
        }),
      // biome-ignore lint/suspicious/noExplicitAny: T is supplied by the caller
      get: <T = any>(slot: DraftSlot) => get().drafts[slot] as DraftEntry<T> | undefined,
      clear: (slot) =>
        set((s) => {
          const { [slot]: _removed, ...rest } = s.drafts
          return { drafts: rest }
        }),
      clearAll: () => set({ drafts: {} }),
    }),
    {
      name: "sast-shop:drafts",
      version: 2,
      // v1 drafts have no `lastStep` — leave undefined so consumers fall back to step 0.
      migrate: (persistedState, version) => {
        if (version < 2 && persistedState && typeof persistedState === "object") {
          return persistedState as DraftState
        }
        return persistedState as DraftState
      },
    }
  )
)
