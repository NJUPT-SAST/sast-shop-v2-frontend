"use client"

import * as React from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "#components/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#components/drawer"
import { cn } from "#lib/utils"

type ResponsiveDialogMode = "dialog" | "drawer"

const ResponsiveDialogModeContext =
  React.createContext<ResponsiveDialogMode | null>(null)

function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", callback)
      return () => mql.removeEventListener("change", callback)
    },
    [query]
  )
  const getSnapshot = React.useCallback(
    () => window.matchMedia(query).matches,
    [query]
  )

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}

function useResponsiveDialogMode(): ResponsiveDialogMode {
  const mode = React.useContext(ResponsiveDialogModeContext)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  return mode ?? (isDesktop ? "dialog" : "drawer")
}

function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  forceDrawer = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  forceDrawer?: boolean
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const mode = forceDrawer || !isDesktop ? "drawer" : "dialog"

  if (mode === "dialog") {
    return (
      <ResponsiveDialogModeContext.Provider value={mode}>
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      </ResponsiveDialogModeContext.Provider>
    )
  }

  return (
    <ResponsiveDialogModeContext.Provider value={mode}>
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    </ResponsiveDialogModeContext.Provider>
  )
}

function ResponsiveDialogTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DialogTrigger>) {
  const mode = useResponsiveDialogMode()
  const Trigger = mode === "dialog" ? DialogTrigger : DrawerTrigger

  return <Trigger className={className} {...props} />
}

function ResponsiveDialogClose({
  className,
  ...props
}: React.ComponentProps<typeof DialogClose>) {
  const mode = useResponsiveDialogMode()
  const Close = mode === "dialog" ? DialogClose : DrawerClose

  return <Close className={className} {...props} />
}

function ResponsiveDialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  showCloseButton?: boolean
}) {
  const mode = useResponsiveDialogMode()

  if (mode === "dialog") {
    return (
      <DialogContent
        className={className}
        showCloseButton={showCloseButton}
        {...props}
      >
        {children}
      </DialogContent>
    )
  }

  return (
    <DrawerContent className={className} {...props}>
      {children}
    </DrawerContent>
  )
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const mode = useResponsiveDialogMode()
  const Header = mode === "dialog" ? DialogHeader : DrawerHeader

  return <Header className={className} {...props} />
}

function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const mode = useResponsiveDialogMode()

  if (mode === "dialog") {
    return <DialogFooter className={className} {...props} />
  }

  return <DrawerFooter className={cn("flex-row p-0 pt-6", className)} {...props} />
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const mode = useResponsiveDialogMode()
  const Title = mode === "dialog" ? DialogTitle : DrawerTitle

  return <Title className={className} {...props} />
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const mode = useResponsiveDialogMode()
  const Description = mode === "dialog" ? DialogDescription : DrawerDescription

  return <Description className={className} {...props} />
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
}
