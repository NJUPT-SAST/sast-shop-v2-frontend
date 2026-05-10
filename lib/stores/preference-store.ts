// Persisted user-side preferences (UI-only, not security-relevant).
// Survives reloads via localStorage. Auto-creates entries on first read.

import { create } from "zustand"
import { persist } from "zustand/middleware"

const RECENT_SEARCH_LIMIT = 8

type PreferenceState = {
  theme: "light" | "dark" | "system"
  sidebarCollapsed: boolean
  ordersRole: "buyer" | "seller"
  recentSearches: string[]

  setTheme: (theme: PreferenceState["theme"]) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setOrdersRole: (role: "buyer" | "seller") => void
  pushSearch: (query: string) => void
  removeSearch: (query: string) => void
  clearSearches: () => void
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set) => ({
      theme: "system",
      sidebarCollapsed: false,
      ordersRole: "buyer",
      recentSearches: [],

      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setOrdersRole: (role) => set({ ordersRole: role }),
      pushSearch: (q) =>
        set((s) => {
          const trimmed = q.trim()
          if (!trimmed) return s
          const dedup = [trimmed, ...s.recentSearches.filter((x) => x !== trimmed)].slice(
            0,
            RECENT_SEARCH_LIMIT
          )
          return { recentSearches: dedup }
        }),
      removeSearch: (q) =>
        set((s) => ({ recentSearches: s.recentSearches.filter((x) => x !== q) })),
      clearSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: "sast-shop:preferences",
      version: 1,
    }
  )
)
