"use client"

import { AnimatePresence, m } from "motion/react"
import { usePathname } from "next/navigation"

const variants = {
  initial: { opacity: 0, y: 8 },
  enter: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const },
  },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <AnimatePresence initial={false} mode="wait">
      <m.div
        animate="enter"
        className="contents"
        exit="exit"
        initial="initial"
        key={pathname}
        variants={variants}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}
