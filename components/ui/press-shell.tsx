"use client"

import { m } from "motion/react"
import type { ComponentProps } from "react"

// Wraps a non-button tappable element with a subtle scale-on-press feedback.
// Use only for `<Link>` / `<div role="button">`-style targets — actual buttons
// already get press feedback from CSS (active:scale-95).
export function PressShell({ children, ...rest }: ComponentProps<typeof m.div>) {
  return (
    <m.div whileTap={{ scale: 0.97 }} {...rest}>
      {children}
    </m.div>
  )
}
