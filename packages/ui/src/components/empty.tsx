import * as React from "react";

import { cn } from "#lib/utils";

function Empty({
  className,
  icon,
  illustration,
  title,
  description,
  action,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-h-36 w-full flex-col items-center justify-center gap-4 px-4 py-8 text-center",
        className,
      )}
      {...props}
    >
      {illustration ? (
        <div data-slot="empty-illustration">{illustration}</div>
      ) : icon ? (
        <div className="flex size-10 items-center justify-center text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-[36ch] text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export { Empty };
