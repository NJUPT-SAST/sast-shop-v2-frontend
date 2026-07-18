import * as React from "react";
import { RiLoader4Line } from "@remixicon/react";

import { cn } from "#lib/utils";

function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof RiLoader4Line>) {
  return (
    <RiLoader4Line
      data-slot="spinner"
      className={cn(
        "animate-spin text-current motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
