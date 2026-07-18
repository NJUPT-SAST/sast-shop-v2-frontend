"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

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
  refresh: (options?: RefreshOptions) => void;
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
  const [isAtTop, setIsAtTop] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

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
        return;
      }

      refreshingRef.current = true;
      lastRefreshAtRef.current = now;
      setIsRefreshing(true);
      setPullDistance(autoPull ? 56 : 48);
      viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();

      window.setTimeout(() => {
        refreshingRef.current = false;
        setIsRefreshing(false);
        setPullDistance(0);
        syncScrollState();
      }, REFRESH_VISIBLE_MS);
    },
    [router, syncScrollState],
  );

  const handleCurrentRoutePress = useCallback(() => {
    const viewport = viewportRef.current;
    const atTop = !viewport || viewport.scrollTop <= 2;

    if (!atTop || !isAtTop) {
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
