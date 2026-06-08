"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "#lib/utils"

function Item({
  className,
  asChild = false,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
  variant?: "default" | "outline"
}) {
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="item"
      data-variant={variant}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[variant=outline]:border data-[variant=outline]:bg-card data-[variant=outline]:shadow-xs",
        className
      )}
      {...props}
    />
  )
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
      {...props}
    />
  )
}

function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-title"
      className={cn("font-medium leading-none", className)}
      {...props}
    />
  )
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn(
        "text-sm leading-5 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-actions"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  )
}

export { Item, ItemActions, ItemContent, ItemDescription, ItemTitle }
