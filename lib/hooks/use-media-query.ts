"use client"

import { useEffect, useState } from "react"

// SSR-safe media query hook. Returns false on the server, then settles to
// the real value on first effect run. Use for layout-shell decisions
// (mobile sheet vs desktop modal etc.).
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [query])

  return matches
}

export const useIsDesktop = () => useMediaQuery("(min-width: 768px)")
