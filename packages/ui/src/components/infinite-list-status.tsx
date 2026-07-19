"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "#components/button";

export function InfiniteListStatus({
  hasMore,
  loading,
  error,
  hasItems,
  onLoadMore,
  loadingFallback,
  endMessage = "已经到底了",
}: {
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  hasItems: boolean;
  onLoadMore: () => void;
  loadingFallback: ReactNode;
  endMessage?: ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || error) return;

    const scrollParent = getScrollParent(sentinel);
    const Observer = window.IntersectionObserver;
    if (typeof Observer === "function") {
      const observer = new Observer(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
        },
        { root: scrollParent, rootMargin: "320px 0px" },
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    }

    const checkPosition = () => {
      const sentinelTop = sentinel.getBoundingClientRect().top;
      const viewportBottom = scrollParent
        ? scrollParent.getBoundingClientRect().bottom
        : window.innerHeight;
      if (sentinelTop <= viewportBottom + 320) onLoadMore();
    };
    const target: EventTarget = scrollParent ?? window;
    target.addEventListener("scroll", checkPosition, { passive: true });
    window.addEventListener("resize", checkPosition);
    checkPosition();
    return () => {
      target.removeEventListener("scroll", checkPosition);
      window.removeEventListener("resize", checkPosition);
    };
  }, [error, hasMore, loading, onLoadMore]);

  return (
    <>
      {loading ? loadingFallback : null}
      {hasMore && !error ? (
        <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />
      ) : null}
      {error ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={onLoadMore}>
            重新加载
          </Button>
        </div>
      ) : null}
      {!hasMore && hasItems && !loading ? (
        <p
          className="text-center text-sm text-muted-foreground"
          aria-live="polite"
        >
          {endMessage}
        </p>
      ) : null}
    </>
  );
}

function getScrollParent(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}
