"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { resolveCurrentRoutePress } from "../lib/current-route-press";

const REFRESH_DEBOUNCE_MS = 2500;
const REFRESH_VISIBLE_MS = 800;

interface RefreshOptions {
  autoPull?: boolean;
}

interface MobileScrollContextValue {
  isRefreshing: boolean;
  pullDistance: number;
  registerViewport: (viewport: HTMLElement | null) => void;
  setPullDistance: (distance: number) => void;
  syncScrollState: () => void;
  scrollToTop: () => void;
  refresh: (options?: RefreshOptions) => boolean;
  handleCurrentRoutePress: () => void;
}

const MobileScrollContext = createContext<MobileScrollContextValue | null>(
  null,
);

export function MobileScrollProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const viewportRef = useRef<HTMLElement | null>(null);
  const lastRefreshAtRef = useRef(0);
  const refreshingRef = useRef(false);
  const refreshStartedAtRef = useRef(0);
  const refreshEndTimerRef = useRef<number | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshPending, startRefreshTransition] = useTransition();

  const syncScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    setIsAtTop(!viewport || viewport.scrollTop <= 2);
  }, []);

  const registerViewport = useCallback(
    (viewport: HTMLElement | null) => {
      viewportRef.current = viewport;
      syncScrollState();
    },
    [syncScrollState],
  );

  const scrollToTop = useCallback(() => {
    viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const refresh = useCallback(
    ({ autoPull = false }: RefreshOptions = {}) => {
      const now = Date.now();

      if (
        refreshingRef.current ||
        now - lastRefreshAtRef.current < REFRESH_DEBOUNCE_MS
      ) {
        return false;
      }

      refreshingRef.current = true;
      lastRefreshAtRef.current = now;
      setIsRefreshing(true);
      setPullDistance(autoPull ? 56 : 48);
      viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      refreshStartedAtRef.current = now;
      startRefreshTransition(() => router.refresh());
      return true;
    },
    [router],
  );

  useEffect(() => {
    if (!isRefreshing || refreshPending) return;

    const elapsed = Date.now() - refreshStartedAtRef.current;
    const remaining = Math.max(REFRESH_VISIBLE_MS - elapsed, 0);
    refreshEndTimerRef.current = window.setTimeout(() => {
      refreshingRef.current = false;
      refreshEndTimerRef.current = null;
      setIsRefreshing(false);
      setPullDistance(0);
      syncScrollState();
    }, remaining);

    return () => {
      if (refreshEndTimerRef.current !== null) {
        window.clearTimeout(refreshEndTimerRef.current);
        refreshEndTimerRef.current = null;
      }
    };
  }, [isRefreshing, refreshPending, syncScrollState]);

  const handleCurrentRoutePress = useCallback(() => {
    const viewport = viewportRef.current;
    const action = resolveCurrentRoutePress(viewport?.scrollTop ?? 0, isAtTop);

    if (action === "scroll-to-top") {
      scrollToTop();
      return;
    }

    refresh({ autoPull: true });
  }, [isAtTop, refresh, scrollToTop]);

  return (
    <MobileScrollContext.Provider
      value={{
        isRefreshing,
        pullDistance,
        registerViewport,
        setPullDistance,
        syncScrollState,
        scrollToTop,
        refresh,
        handleCurrentRoutePress,
      }}
    >
      {children}
    </MobileScrollContext.Provider>
  );
}

export function useMobileScroll() {
  const context = useContext(MobileScrollContext);

  if (!context) {
    throw new Error("useMobileScroll must be used within MobileScrollProvider");
  }

  return context;
}
