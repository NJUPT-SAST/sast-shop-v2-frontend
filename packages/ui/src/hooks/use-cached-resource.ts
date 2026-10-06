"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  getResourceSnapshot,
  getServerResourceSnapshot,
  loadResource,
  subscribeResource,
} from "../lib/resource-cache";

export function useCachedResource<T>({
  cacheKey,
  load,
  staleTime,
  refreshKey,
  invalidateOnWrite = true,
}: {
  cacheKey: string;
  load: () => Promise<T>;
  staleTime: number;
  refreshKey?: string | object;
  invalidateOnWrite?: boolean;
}) {
  const loader = useRef(load);
  const previous = useRef({ cacheKey, refreshKey });
  useEffect(() => {
    loader.current = load;
  });
  const snapshot = useSyncExternalStore(
    useCallback(
      (listener) => subscribeResource(cacheKey, listener),
      [cacheKey],
    ),
    useCallback(() => getResourceSnapshot<T>(cacheKey), [cacheKey]),
    getServerResourceSnapshot<T>,
  );
  const refresh = useCallback(
    () =>
      loadResource(
        cacheKey,
        () => loader.current(),
        staleTime,
        true,
        invalidateOnWrite,
      ),
    [cacheKey, staleTime, invalidateOnWrite],
  );

  useEffect(() => {
    const force =
      previous.current.cacheKey === cacheKey &&
      previous.current.refreshKey !== refreshKey;
    previous.current = { cacheKey, refreshKey };
    void loadResource(
      cacheKey,
      () => loader.current(),
      staleTime,
      force,
      invalidateOnWrite,
    );
  }, [cacheKey, staleTime, refreshKey, snapshot.revision, invalidateOnWrite]);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "visible") {
        void loadResource(
          cacheKey,
          () => loader.current(),
          staleTime,
          false,
          invalidateOnWrite,
        );
      }
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [cacheKey, staleTime, invalidateOnWrite]);

  return { ...snapshot, refresh };
}
