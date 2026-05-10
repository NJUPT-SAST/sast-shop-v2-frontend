"use client"

import { useAuthMe } from "@/lib/api/queries"
import { useAuthStore } from "@/lib/stores/auth-store"
import { isTauri, openExternal } from "@/lib/tauri"
import { Spinner } from "@heroui/react"
import { Icon } from "@iconify/react"
import { useEffect } from "react"

type Mode = "required" | "admin" | "anonymous-ok"

function loginUrl(): string {
  if (typeof window === "undefined") return "/api/auth/feishu/login"
  const here = window.location.pathname + window.location.search
  return `/api/auth/feishu/login?redirect=${encodeURIComponent(here)}`
}

function FullscreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-shop-text-secondary">{label}</p>
    </div>
  )
}

function NotAdmin() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon className="size-12 text-shop-warning" icon="material-symbols:lock-outline" />
      <h2 className="text-xl font-semibold text-shop-text-primary">仅限管理员</h2>
      <p className="max-w-sm text-sm text-shop-text-secondary">
        当前账户没有 SAST Shop 管理权限。如需协助，请联系平台维护者。
      </p>
    </div>
  )
}

/**
 * Wraps a subtree to enforce authentication. `mode` controls behaviour:
 *   - "anonymous-ok": render children regardless; `useAuthMe` still runs to
 *     populate the store so headers/profile shortcut work.
 *   - "required": redirect to the Feishu OAuth login when unauthenticated.
 *   - "admin": render `NotAdmin` if logged-in but not admin; redirect if
 *     unauthenticated.
 */
export function AuthGuard({
  mode = "required",
  children,
}: {
  mode?: Mode
  children: React.ReactNode
}) {
  const { data, isFetching, isError } = useAuthMe()
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (isFetching) return
    if (isError) {
      setUser(null)
      return
    }
    setUser(data ?? null)
  }, [data, isError, isFetching, setUser])

  if (mode === "anonymous-ok") {
    return <>{children}</>
  }

  if (isFetching) {
    return <FullscreenSpinner label="正在确认登录状态…" />
  }

  if (!data) {
    if (typeof window !== "undefined") {
      const url = loginUrl()
      if (isTauri()) {
        void openExternal(window.location.origin + url)
      } else {
        window.location.href = url
      }
    }
    return <FullscreenSpinner label="正在跳转登录…" />
  }

  if (mode === "admin" && !data.is_admin) {
    return <NotAdmin />
  }

  return <>{children}</>
}
