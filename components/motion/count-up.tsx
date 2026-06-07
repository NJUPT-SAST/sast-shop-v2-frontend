"use client"

import { animate, m, useMotionValue, useTransform } from "motion/react"
import { useEffect } from "react"

type Props = {
  to: number
  duration?: number
  format?: (n: number) => string
  className?: string
  /** Useful for screen readers — overrides the live numeric content for a11y. */
  ariaLabel?: string
}

const defaultFormat = (n: number) => Math.round(n).toString()

// Smoothly animates a number from its previous value to `to`.
// Used for vote tallies, progress percentages, supporter counts.
export function CountUp({
  to,
  duration = 0.8,
  format = defaultFormat,
  className,
  ariaLabel,
}: Props) {
  const mv = useMotionValue(0)
  const text = useTransform(mv, format)

  useEffect(() => {
    const controls = animate(mv, to, { duration, ease: "easeOut" })
    return () => controls.stop()
  }, [to, duration, mv])

  return (
    <m.span aria-label={ariaLabel} aria-live="polite" className={className}>
      {text}
    </m.span>
  )
}
