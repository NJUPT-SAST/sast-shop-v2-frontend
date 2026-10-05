"use client";

import * as React from "react";
import { RiAddLine, RiSubtractLine } from "@remixicon/react";

import { Button } from "#components/button";
import { cn } from "#lib/utils";

type QuantityStepperProps = Omit<
  React.ComponentProps<"div">,
  "children" | "onChange"
> & {
  value: number;
  onValueChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  valueClassName?: string;
};

function QuantityStepper({
  value,
  onValueChange,
  label,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  disabled = false,
  className,
  valueClassName,
  ...props
}: QuantityStepperProps) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-touch"
        className="rounded-full text-foreground"
        aria-label={`减少${label}`}
        disabled={!canDecrement}
        onClick={() => onValueChange(Math.max(min, value - 1))}
      >
        <RiSubtractLine />
      </Button>
      <span
        aria-live="polite"
        className={cn(
          "min-w-7 px-1 text-center text-sm font-medium tabular-nums text-foreground",
          valueClassName,
        )}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-touch"
        className="rounded-full text-foreground"
        aria-label={`增加${label}`}
        disabled={!canIncrement}
        onClick={() => onValueChange(Math.min(max, value + 1))}
      >
        <RiAddLine />
      </Button>
    </div>
  );
}

export { QuantityStepper, type QuantityStepperProps };
