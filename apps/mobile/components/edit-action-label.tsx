import type { ReactNode } from "react";
import { RiEditLine } from "@remixicon/react";

export function EditActionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 text-sm font-medium text-primary">
      <RiEditLine className="size-4" aria-hidden="true" />
      {children}
    </span>
  );
}
