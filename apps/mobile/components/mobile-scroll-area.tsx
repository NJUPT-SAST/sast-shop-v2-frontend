"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
} from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/utils";
import {
  PULL_REFRESH_THRESHOLD,
  resolvePullGestureAxis,
  shouldRefreshAfterPull,
  type PullGestureAxis,
} from "../lib/pull-gesture";
import { useMobileScroll } from "./mobile-scroll-context";

interface ScrollbarState {
  visible: boolean;
  thumbHeight: number;
  thumbTop: number;
}

const SCROLLBAR_TRACK_INSET = 8;
const MAX_PULL_DISTANCE = 72;

export function MobileScrollArea({
  children,
  hasBottomNav,
}: {
  children: ReactNode;
  hasBottomNav: boolean;
}) {
  const pathname = usePathname();
  const viewportRef = useRef<HTMLElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const gestureAxisRef = useRef<PullGestureAxis>("undetermined");
  const activePullDistanceRef = useRef(0);
  const [isPulling, setIsPulling] = useState(false);
  const [scrollbar, setScrollbar] = useState<ScrollbarState>({
    visible: false,
    thumbHeight: 0,
    thumbTop: 0,
  });
  const {
    footerHeight,
    isRefreshing,
    pullDistance,
    registerViewport,
    setPullDistance,
    syncScrollState,
    refresh,
  } = useMobileScroll();

  const updateScrollbar = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = viewport;
    const maxScrollTop = scrollHeight - clientHeight;

    if (maxScrollTop <= 1) {
      setScrollbar({ visible: false, thumbHeight: 0, thumbTop: 0 });
      return;
    }

    const trackHeight = Math.max(clientHeight - SCROLLBAR_TRACK_INSET * 2, 0);
    const thumbHeight = Math.max(
      (clientHeight / scrollHeight) * trackHeight,
      32,
    );
    const thumbTop = (scrollTop / maxScrollTop) * (trackHeight - thumbHeight);

    setScrollbar({ visible: true, thumbHeight, thumbTop });
  }, []);

  const handleViewportRef = useCallback(
    (viewport: HTMLElement | null) => {
      viewportRef.current = viewport;
      registerViewport(viewport);
    },
    [registerViewport],
  );

  const handleScroll = useCallback(() => {
    updateScrollbar();
    syncScrollState();
  }, [syncScrollState, updateScrollbar]);

  const updatePullDistance = useCallback(
    (distance: number) => {
      activePullDistanceRef.current = distance;
      setPullDistance(distance);
    },
    [setPullDistance],
  );

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!viewportRef.current || viewportRef.current.scrollTop > 2) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    gestureAxisRef.current = "undetermined";
  }, []);

  const handleTouchMove = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const touchStartX = touchStartXRef.current;
      const touchStartY = touchStartYRef.current;
      const viewport = viewportRef.current;

      if (
        touchStartX === null ||
        touchStartY === null ||
        !viewport ||
        isRefreshing
      ) {
        return;
      }

      const currentX = event.touches[0]?.clientX ?? touchStartX;
      const currentY = event.touches[0]?.clientY ?? touchStartY;
      const deltaX = currentX - touchStartX;
      const deltaY = currentY - touchStartY;

      if (gestureAxisRef.current === "undetermined") {
        gestureAxisRef.current = resolvePullGestureAxis(deltaX, deltaY);
      }

      if (gestureAxisRef.current !== "vertical") {
        return;
      }

      if (deltaY <= 0 || viewport.scrollTop > 2) {
        updatePullDistance(0);
        setIsPulling(false);
        return;
      }

      const nextDistance = Math.min(deltaY * 0.45, MAX_PULL_DISTANCE);
      updatePullDistance(nextDistance);
      setIsPulling(true);

      if (event.cancelable) {
        event.preventDefault();
      }
    },
    [isRefreshing, updatePullDistance],
  );

  const finishPullGesture = useCallback(
    (cancelled: boolean) => {
      const completedDistance = activePullDistanceRef.current;
      activePullDistanceRef.current = 0;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      gestureAxisRef.current = "undetermined";
      setIsPulling(false);

      if (shouldRefreshAfterPull(completedDistance, cancelled)) {
        if (refresh()) return;
      }

      setPullDistance(0);
    },
    [refresh, setPullDistance],
  );

  const handleTouchEnd = useCallback(() => {
    finishPullGesture(false);
  }, [finishPullGesture]);

  const handleTouchCancel = useCallback(() => {
    finishPullGesture(true);
  }, [finishPullGesture]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const rafId = requestAnimationFrame(updateScrollbar);

    const resizeObserver = new ResizeObserver(updateScrollbar);
    resizeObserver.observe(viewport);

    if (viewport.firstElementChild) {
      resizeObserver.observe(viewport.firstElementChild);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [pathname, updateScrollbar]);

  const visualPullDistance = Math.max(isRefreshing ? 48 : 0, pullDistance);
  const showRefreshIndicator = isRefreshing || pullDistance > 0;

  return (
    <div
      className={cn(
        "relative mx-auto flex min-h-0 w-full max-w-5xl flex-1",
        hasBottomNav && "mb-[calc(4rem+1px+env(safe-area-inset-bottom))]",
      )}
      style={footerHeight > 0 ? { marginBottom: footerHeight } : undefined}
    >
      {showRefreshIndicator ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center"
          style={{
            opacity: Math.min(visualPullDistance / PULL_REFRESH_THRESHOLD, 1),
          }}
        >
          <div className="flex h-9 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium text-muted-foreground">
            <Spinner
              className={cn("size-4", !isRefreshing && "animate-none")}
            />
            <span>{isRefreshing ? "正在刷新" : "下拉刷新"}</span>
          </div>
        </div>
      ) : null}
      <main
        ref={handleViewportRef}
        className={cn(
          "app-scrollbar flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 md:px-6",
          scrollbar.visible ? "pb-2" : "pb-6",
          !isPulling &&
            "transition-transform duration-200 motion-reduce:transition-none",
        )}
        style={{ transform: `translateY(${visualPullDistance}px)` }}
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {children}
      </main>
      {scrollbar.visible ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1 top-2 z-30 w-1.5"
          style={{ bottom: SCROLLBAR_TRACK_INSET }}
        >
          <div
            className="absolute right-0 w-1.5 rounded-full bg-foreground/25"
            style={{
              height: scrollbar.thumbHeight,
              transform: `translateY(${scrollbar.thumbTop}px)`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
