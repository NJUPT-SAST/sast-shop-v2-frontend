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
        d="M7 10.5h18l-1.4 15H8.4l-1.4-15Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 11V8.5a5 5 0 0 1 10 0V11"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="m11.5 18 3 3 6-7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
