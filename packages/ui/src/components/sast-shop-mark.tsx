import type { ComponentProps } from "react";
import { cn } from "#lib/utils";

export function SastShopMark({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.5 11h17c1.2 0 2.2.9 2.3 2.1l1.1 13.4c.1 1.4-1 2.5-2.4 2.5h-19c-1.4 0-2.5-1.1-2.4-2.5l1.1-13.4c.1-1.2 1.1-2.1 2.3-2.1ZM12.75 18.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 1 1 2.5 0Zm9 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 1 1 2.5 0Zm-10.25 3.5a1 1 0 0 1 1.4 0 4.4 4.4 0 0 0 6.2 0 1 1 0 0 1 1.4 1.4 6.4 6.4 0 0 1-9 0 1 1 0 0 1 0-1.4Z"
      />
      <path
        d="M10 12V9a6 6 0 0 1 12 0v3"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
