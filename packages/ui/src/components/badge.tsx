import * as React from "react";
import { cn } from "../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "muted"
    | "destructive"
    | "neutral"
    | "warning"
    | "info"
    | "payment"
    | "attention"
    | "review"
    | "success"
    | "danger";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
        variant === "default" && "bg-primary text-primary-foreground",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        variant === "outline" && "border text-foreground",
        variant === "muted" && "bg-muted text-muted-foreground",
        variant === "destructive" &&
          "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
        variant === "neutral" &&
          "border bg-[var(--badge-neutral)] text-[var(--badge-neutral-foreground)] border-[var(--badge-neutral-border)]",
        variant === "warning" &&
          "border bg-[var(--badge-warning)] text-[var(--badge-warning-foreground)] border-[var(--badge-warning-border)]",
        variant === "info" &&
          "border bg-[var(--badge-info)] text-[var(--badge-info-foreground)] border-[var(--badge-info-border)]",
        variant === "payment" &&
          "border bg-[var(--badge-payment)] text-[var(--badge-payment-foreground)] border-[var(--badge-payment-border)]",
        variant === "attention" &&
          "border bg-[var(--badge-attention)] text-[var(--badge-attention-foreground)] border-[var(--badge-attention-border)]",
        variant === "review" &&
          "border bg-[var(--badge-review)] text-[var(--badge-review-foreground)] border-[var(--badge-review-border)]",
        variant === "success" &&
          "border bg-[var(--badge-success)] text-[var(--badge-success-foreground)] border-[var(--badge-success-border)]",
        variant === "danger" &&
          "border bg-[var(--badge-danger)] text-[var(--badge-danger-foreground)] border-[var(--badge-danger-border)]",
        className,
      )}
      {...props}
    />
  );
}
