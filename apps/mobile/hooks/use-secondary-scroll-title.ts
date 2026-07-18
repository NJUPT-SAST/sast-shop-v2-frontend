"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type TitlePhase = "enter" | "visible" | "exit" | "hidden";

export function useSecondaryScrollTitle() {
  const pathname = usePathname();
  const [titleText, setTitleText] = useState("");
  const [titlePhase, setTitlePhase] = useState<TitlePhase>("hidden");
  const headerRef = useRef<HTMLElement | null>(null);

  const headerRefCallback = useCallback((el: HTMLElement | null) => {
    headerRef.current = el;
  }, []);

  const onTitleAnimationEnd = useCallback(() => {
    setTitlePhase((previous) => {
      if (previous === "enter") return "visible";
      if (previous === "exit") return "hidden";
      return previous;
    });
  }, []);

  useEffect(() => {
    const h1 = document.querySelector<HTMLHeadingElement>("main h1");
    if (!h1) return;

    const headerElement = headerRef.current;
    if (!headerElement || headerElement.offsetHeight === 0) return;

    const updateTitle = () => {
      requestAnimationFrame(() => {
        setTitleText(h1.textContent ?? "");
      });
    };
    updateTitle();

    const mutationObserver = new MutationObserver(updateTitle);
    mutationObserver.observe(h1, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    let visible = false;
    let rafId = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry.intersectionRatio;
        const shouldShow = ratio <= 0.5;
        const h1Opacity = ratio >= 0.5 ? (ratio - 0.5) / 0.5 : 0;

        rafId = requestAnimationFrame(() => {
          h1.style.opacity = String(h1Opacity);

          if (shouldShow !== visible) {
            visible = shouldShow;
            setTitlePhase(shouldShow ? "enter" : "exit");
          }
        });
      },
      {
        rootMargin: `-${headerElement.offsetHeight}px 0px 0px 0px`,
        threshold: Array.from({ length: 41 }, (_, index) => index / 40),
      },
    );

    observer.observe(h1);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      cancelAnimationFrame(rafId);
      h1.style.opacity = "";
    };
  }, [pathname]);

  return {
    titleText,
    titlePhase,
    headerRef: headerRefCallback,
    onTitleAnimationEnd,
  };
}
