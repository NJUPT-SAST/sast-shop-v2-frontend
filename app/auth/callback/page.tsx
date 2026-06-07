"use client"

import { queryKeys } from "@/lib/api/queries"
import { Spinner } from "@heroui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

// The Go backend handles the actual OAuth code exchange and writes the cookie
// before 302-ing to this path. We just need to invalidate /api/auth/me so the
// next render shows the logged-in state, then go back to wherever the user
// started (`?redirect=` carried through the OAuth flow).
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackInner />
    </Suspense>
  )
}

function CallbackFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-shop-text-secondary">正在完成登录…</p>
      </div>
    </div>
  )
}

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()
  const qc = useQueryClient()

  useEffect(() => {
    qc.invalidateQueries({ queryKey: queryKeys.authMe })
    const redirect = params.get("redirect") || "/"
    router.replace(redirect.startsWith("/") ? redirect : "/")
  }, [params, qc, router])

  return <CallbackFallback />
}
