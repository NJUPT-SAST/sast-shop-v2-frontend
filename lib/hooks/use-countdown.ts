"use client"

import { useEffect, useState } from "react"

export type CountdownParts = {
  totalMs: number
  expired: boolean
  days: number
  hours: number
  minutes: number
  seconds: number
}

function partsFromMs(ms: number): CountdownParts {
  const safe = Math.max(0, ms)
  const totalSec = Math.floor(safe / 1000)
  return {
    totalMs: safe,
    expired: ms <= 0,
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  }
}

// Re-renders once per second until target time. Pass null/undefined to disable.
export function useCountdown(target: string | number | Date | null | undefined): CountdownParts {
  const compute = () => {
    if (target == null) return partsFromMs(0)
    const t = target instanceof Date ? target.getTime() : new Date(target).getTime()
    return partsFromMs(t - Date.now())
  }
  const [parts, setParts] = useState<CountdownParts>(compute)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `compute` is a closure over `target`; recomputed each render is fine.
  useEffect(() => {
    if (target == null) return
    setParts(compute())
    const id = setInterval(() => setParts(compute()), 1000)
    return () => clearInterval(id)
  }, [target])

  return parts
}
