"use client"

import { registerUnauthorizedHandler } from "@/lib/api/client"
import { isTauri, openExternal } from "@/lib/tauri"
import { I18nProvider, Toast } from "@heroui/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LazyMotion, MotionConfig, domAnimation } from "motion/react"
import { useEffect, useState } from "react"

function buildLoginUrl(): string {
  if (typeof window === "undefined") return "/api/auth/feishu/login"
  const here = window.location.pathname + window.location.search
  return `/api/auth/feishu/login?redirect=${encodeURIComponent(here)}`
}

export function ClientProviders({
  lang,
  children,
}: {
  lang: string
  children: React.ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      })
  )

  // Single redirect on each session-wide 401. Subsequent 401s within the
  // navigation window are no-ops to avoid loops.
  useEffect(() => {
    let redirected = false
    registerUnauthorizedHandler(() => {
      if (redirected) return
      redirected = true
      const url = buildLoginUrl()
      if (isTauri()) {
        // Inside Tauri, OAuth happens in the user's default browser.
        void openExternal(window.location.origin + url)
        return
      }
      window.location.href = url
    })
  }, [])

  return (
    <I18nProvider locale={lang}>
      <MotionConfig reducedMotion="user">
        <LazyMotion features={domAnimation} strict>
          <QueryClientProvider client={queryClient}>
            {children}
            <Toast.Provider />
          </QueryClientProvider>
        </LazyMotion>
      </MotionConfig>
    </I18nProvider>
  )
}
