// Reflects the current user from GET /api/auth/me into a Zustand store so
// components can read auth state synchronously without subscribing to a hook.
// useAuthMe (lib/api/queries.ts) is the writer; everywhere else is read-only.

import type { User } from "@/lib/api/types"
import { create } from "zustand"

type AuthState = {
  user: User | null
  isLoading: boolean
  hasResolved: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  hasResolved: false,
  setUser: (user) => set({ user, isLoading: false, hasResolved: true }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, isLoading: false, hasResolved: true }),
}))

export const selectIsAuthenticated = (state: AuthState) => state.user !== null
export const selectIsAdmin = (state: AuthState) => state.user?.is_admin === true
