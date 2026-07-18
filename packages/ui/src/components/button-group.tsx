"use client";

import * as React from "react";

import { cn } from "#lib/utils";

function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="button-group"
      role="group"
      className={cn(
        "inline-flex items-center rounded-md shadow-xs [&>*:not(:first-child)]:-ml-px [&>[data-slot=button]]:rounded-none [&>[data-slot=button]]:shadow-none [&>[data-slot=button]:first-child]:rounded-l-md [&>[data-slot=button]:focus-visible]:relative [&>[data-slot=button]:focus-visible]:z-10 [&>[data-slot=button]:last-child]:rounded-r-md",
        className,
      )}
      {...props}
    />
  );
}

function ButtonGroupText({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="button-group-text"
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center border border-input bg-background px-3 text-sm font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { ButtonGroup, ButtonGroupText };
