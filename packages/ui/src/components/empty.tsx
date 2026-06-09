import * as React from "react"

import { cn } from "#lib/utils"

function Empty({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-36 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-8 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[36ch] text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export { Empty }
