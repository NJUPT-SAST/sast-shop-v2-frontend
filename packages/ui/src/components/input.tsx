import * as React from "react";

import { cn } from "#lib/utils";
import {
  textControlContentStyles,
  textControlStateStyles,
  textControlSurfaceStyles,
} from "#lib/text-control-styles";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        textControlSurfaceStyles,
        textControlContentStyles,
        textControlStateStyles,
        "h-11 py-1 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground disabled:pointer-events-none md:h-9",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
