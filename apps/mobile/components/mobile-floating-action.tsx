"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

export function MobileFloatingAction({
  className,
  size = "icon-touch",
  ...props
}: ComponentProps<typeof Button>) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!isClient) return null;

  return createPortal(
    <Button
      size={size}
      className={cn(
        "fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-5 z-30 size-14 rounded-full shadow-lg shadow-foreground/15 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />,
    document.body,
  );
}

function emptySubscribe() {
  return () => {};
}
