"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useMobilePathname } from "./mobile-navigation-feedback";
import { getPageTransitionDirection } from "@/lib/page-transition";

export function MobilePageTransition({ children }: { children: ReactNode }) {
  const pathname = useMobilePathname();
  const previousPathRef = useRef(pathname);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const direction = getPageTransitionDirection(
      previousPathRef.current,
      pathname,
    );
    previousPathRef.current = pathname;

    const container = containerRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!direction || !container?.animate || reducedMotion.matches) return;

    const animation = container.animate(
      [
        {
          transform: `translateX(${direction === "forward" ? 24 : -24}px)`,
          opacity: 0.8,
        },
        { transform: "translateX(0)", opacity: 1 },
      ],
      { duration: 250, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    const handleMotionPreference = () => {
      if (reducedMotion.matches) animation.cancel();
    };
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      reducedMotion.removeEventListener("change", handleMotionPreference);
      animation.cancel();
    };
  }, [pathname]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
