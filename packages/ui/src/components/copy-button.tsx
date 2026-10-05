"use client";

import * as React from "react";
import { RiCheckLine, RiFileCopyLine } from "@remixicon/react";
import { toast } from "sonner";

import { Button } from "#components/button";
import { cn } from "#lib/utils";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Continue with the fallback when Clipboard API permission is unavailable.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) throw new Error("Copy command failed");
}

function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  async function handleCopy() {
    try {
      await copyText(value);
      setCopied(true);
      toast.success(`${label}已复制`);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("复制失败，请长按号码复制");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className={cn("size-6 text-muted-foreground", className)}
      aria-label={`复制${label}`}
      onClick={handleCopy}
    >
      <span className="relative size-4">
        <RiFileCopyLine
          className={cn(
            "absolute inset-0 size-4 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
            copied ? "scale-75 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <RiCheckLine
          className={cn(
            "absolute inset-0 size-4 text-primary transition-[opacity,transform] duration-200 motion-reduce:transition-none",
            copied ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        />
      </span>
    </Button>
  );
}

export { CopyButton };
