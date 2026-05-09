"use client"

import { I18nProvider, Toast } from "@heroui/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

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
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  )

  return (
    <I18nProvider locale={lang}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toast.Provider />
      </QueryClientProvider>
    </I18nProvider>
  )
}
