import type { ComponentProps, ReactNode } from "react";
import { cn } from "#lib/utils";

function ModuleMark({
  className,
  children,
  ...props
}: ComponentProps<"svg"> & { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

export function SastGroupMark(props: ComponentProps<"svg">) {
  return (
    <ModuleMark {...props}>
      <path
        d="M5 11V8.5a4 4 0 0 1 8 0V11M18 13V9a4 4 0 0 1 8 0v4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 10h10v15H4a2 2 0 0 1-2-2l.7-11A2 2 0 0 1 4 10Zm1.9 7.2a.9.9 0 1 1 1.8 0 .9.9 0 0 1-1.8 0Zm4.3-.9a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Zm6.8-4.3h10a2 2 0 0 1 2 1.8l.9 11.8a2.3 2.3 0 0 1-2.3 2.4H18a2 2 0 0 1-2-2V14a2 2 0 0 1 1-2Zm2.7 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm5 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm-4.6 3a.9.9 0 0 1 1.2 0 2.6 2.6 0 0 0 3.5 0 .9.9 0 0 1 1.2 1.3 4.4 4.4 0 0 1-5.9 0 .9.9 0 0 1 0-1.3Z"
      />
    </ModuleMark>
  );
}

export function SastOrdersMark(props: ComponentProps<"svg">) {
  return (
    <ModuleMark {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 3h14a3 3 0 0 1 3 3v20.5a2 2 0 0 1-3 1.7l-3-1.7-4 2-4-2-3 1.7a2 2 0 0 1-3-1.7V6a3 3 0 0 1 3-3Zm2 6a1.25 1.25 0 0 0 0 2.5h10a1.25 1.25 0 0 0 0-2.5H11Zm0 6a1.25 1.25 0 0 0 0 2.5h10a1.25 1.25 0 0 0 0-2.5H11Zm0 6a1.25 1.25 0 0 0 0 2.5h6a1.25 1.25 0 0 0 0-2.5h-6Z"
      />
    </ModuleMark>
  );
}

export function SastProfileMark(props: ComponentProps<"svg">) {
  return (
    <ModuleMark {...props}>
      <circle cx="16" cy="9" r="6" fill="currentColor" />
      <path
        d="M16 18c-6 0-11 3.5-11 8v1a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-1c0-4.5-5-8-11-8Z"
        fill="currentColor"
      />
    </ModuleMark>
  );
}
