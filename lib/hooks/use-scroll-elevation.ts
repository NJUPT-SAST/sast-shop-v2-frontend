"use client"

import { useEffect, useState } from "react"

// Returns true once the window has scrolled past `threshold` pixels.
// Used by sticky headers to toggle their elevation shadow.
export function useScrollElevation(threshold = 4): boolean {
  const [elevated, setElevated] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const onScroll = () => setElevated(window.scrollY > threshold)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [threshold])

  return elevated
}
