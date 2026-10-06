"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { LoadFailure } from "#components/load-failure";
import { cn } from "#lib/utils";

export function InfiniteListStatus({
  hasMore,
  loading,
  error,
  hasItems,
  onLoadMore,
  loadingFallback,
  errorIllustration,
  endMessage = "已经到底了",
  endMessageClassName,
}: {
  hasMore: boolean;
  loading: boolean;
  error: boolean;
  hasItems: boolean;
  onLoadMore: () => void;
  loadingFallback: ReactNode;
  errorIllustration?: ReactNode;
  endMessage?: ReactNode;
  endMessageClassName?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null); //当哨兵进入视口 → 代表用户滚动接近底部 → 触发加载下一页。

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
        <LoadFailure
          variant="compact"
          surface="plain"
          illustration={errorIllustration}
          title="加载更多失败"
          onRetry={onLoadMore}
        />
      ) : null}
      {!hasMore && hasItems && !loading ? (
        <p
          className={cn(
            "text-center text-sm text-muted-foreground",
            endMessageClassName,
          )}
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
