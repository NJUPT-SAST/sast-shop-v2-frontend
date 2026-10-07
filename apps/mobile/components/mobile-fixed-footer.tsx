"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@workspace/ui/lib/utils";
import { useMobileFooter } from "./mobile-scroll-context";

export function MobileFixedFooter({
  children,
  className,
  reserveSpace = true,
}: {
  children: ReactNode;
  className?: string;
  reserveSpace?: boolean;
}) {
  const isClient = useIsClient();
  const footerRef = useRef<HTMLElement>(null);
  const setFooterHeight = useMobileFooter();

  useEffect(() => {
    const element = footerRef.current;
    if (!element || !setFooterHeight || !reserveSpace) return;

    const updateHeight = () =>
      setFooterHeight(element.getBoundingClientRect().height);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => {
      observer.disconnect();
      setFooterHeight(0);
    };
  }, [isClient, setFooterHeight, reserveSpace]);

  const footer = (
    <footer
      ref={footerRef}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-1/2 md:right-auto md:w-full md:max-w-3xl md:-translate-x-1/2 md:rounded-t-lg md:border",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 [&>[data-slot=button]]:min-h-11">
        {children}
      </div>
    </footer>
  );

  if (!isClient) {
    return null;
  }

  return createPortal(footer, document.body);
}

function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function emptySubscribe() {
  return () => {};
}
