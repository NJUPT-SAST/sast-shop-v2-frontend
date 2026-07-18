"use client";

import * as React from "react";
import { RiAddLine, RiSubtractLine } from "@remixicon/react";

import { Button } from "#components/button";
import { ButtonGroup, ButtonGroupText } from "#components/button-group";
import { cn } from "#lib/utils";

type QuantityStepperProps = Omit<
  React.ComponentProps<typeof ButtonGroup>,
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
    <ButtonGroup aria-label={label} className={className} {...props}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`减少${label}`}
        disabled={!canDecrement}
        onClick={() => onValueChange(Math.max(min, value - 1))}
      >
        <RiSubtractLine />
      </Button>
      <ButtonGroupText
        aria-live="polite"
        className={cn("h-11 min-w-11 px-2 tabular-nums md:h-9", valueClassName)}
      >
        {value}
      </ButtonGroupText>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`增加${label}`}
        disabled={!canIncrement}
        onClick={() => onValueChange(Math.min(max, value + 1))}
      >
        <RiAddLine />
      </Button>
    </ButtonGroup>
  );
}

export { QuantityStepper, type QuantityStepperProps };
