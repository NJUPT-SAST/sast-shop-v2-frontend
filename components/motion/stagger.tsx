"use client"

import { m } from "motion/react"
import type { ComponentProps, ReactNode } from "react"

export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] as const },
  },
}

type StaggerListProps = Omit<ComponentProps<typeof m.div>, "variants"> & {
  children: ReactNode
  /** Wait until first scrolled into view before staggering (good for long lists). */
  lazy?: boolean
}

export function StaggerList({ children, lazy, ...rest }: StaggerListProps) {
  if (lazy) {
    return (
      <m.div
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-10% 0px" }}
        whileInView="show"
        {...rest}
      >
        {children}
      </m.div>
    )
  }
  return (
    <m.div animate="show" initial="hidden" variants={staggerContainer} {...rest}>
      {children}
    </m.div>
  )
}

export function StaggerItem({ children, ...rest }: Omit<ComponentProps<typeof m.div>, "variants">) {
  return (
    <m.div variants={staggerItem} {...rest}>
      {children}
    </m.div>
  )
}
