"use client"

import { usePathname, useRouter } from "next/navigation"
import { RiArrowLeftLine } from "@remixicon/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useSecondaryScrollTitle } from "@/hooks/use-secondary-scroll-title"

const mainRoutes = ["/shop", "/group", "/orders", "/profile"] as const

export function MobileHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { titleText, titlePhase, headerRef, onTitleAnimationEnd } =
    useSecondaryScrollTitle()
  const isMainRoute = mainRoutes.some((route) => route === pathname)
  const showScrollTitle = titlePhase !== "hidden" && titleText.length > 0

  if (isMainRoute) {
    return null
  }

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl"
    >
      <div className="mx-auto grid min-h-13 w-full max-w-md grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="border-0 bg-transparent shadow-none"
          aria-label="返回上一页"
          onClick={() => router.back()}
        >
          <RiArrowLeftLine />
        </Button>

        <div className="min-w-0 text-center">
          {showScrollTitle ? (
            <span
              className={cn(
                "block truncate text-[15px] font-semibold leading-5",
                titlePhase === "enter" && "animate-slide-up",
                titlePhase === "exit" && "animate-slide-down"
              )}
              onAnimationEnd={onTitleAnimationEnd}
            >
              {titleText}
            </span>
          ) : (
            <span className="block h-5" aria-hidden="true" />
          )}
        </div>
        <span className="size-11" aria-hidden="true" />
      </div>
    </header>
  )
}
