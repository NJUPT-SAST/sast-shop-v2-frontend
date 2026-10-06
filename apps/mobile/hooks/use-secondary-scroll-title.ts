"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function useSecondaryScrollTitle() {
  const pathname = usePathname();
  const [title, setTitle] = useState({
    pathname: "",
    text: "",
    visible: false,
  });
  const headerRef = useRef<HTMLElement | null>(null);
  const headerRefCallback = useCallback((element: HTMLElement | null) => {
    headerRef.current = element;
  }, []);

  useEffect(() => {
    const main = document.querySelector("main");
    const header = headerRef.current;
    if (!main || !header) return;

    let heading: HTMLHeadingElement | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let visible = false;

    const publishTitle = () => {
      const text = heading?.textContent ?? "";
      setTitle((current) =>
        current.pathname === pathname &&
        current.text === text &&
        current.visible === visible
          ? current
          : { pathname, text, visible },
      );
    };

    const updateTitle = () => {
      const nextHeading = main.querySelector("h1");
      if (nextHeading !== heading) {
        intersectionObserver?.disconnect();
        heading = nextHeading;
        visible = false;
        if (heading) {
          intersectionObserver = new IntersectionObserver(
            ([entry]) => {
              visible = entry.intersectionRatio <= 0.5;
              publishTitle();
            },
            { root: main, threshold: [0, 0.5, 1] },
          );
          intersectionObserver.observe(heading);
        }
      }
      publishTitle();
    };

    const mutationObserver = new MutationObserver(updateTitle);
    mutationObserver.observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const frame = requestAnimationFrame(updateTitle);

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [pathname]);

  return {
    titleText: title.pathname === pathname ? title.text : "",
    showTitle: title.pathname === pathname && title.visible,
    headerRef: headerRefCallback,
  };
}
