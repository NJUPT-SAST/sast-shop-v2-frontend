import * as React from "react";

import { cn } from "#lib/utils";
import {
  textControlContentStyles,
  textControlStateStyles,
  textControlSurfaceStyles,
} from "#lib/text-control-styles";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        textControlSurfaceStyles,
        textControlContentStyles,
        textControlStateStyles,
        "flex field-sizing-content min-h-16 py-2",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
