"use client";

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export interface InfinitePage<T> {
  items: T[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

export function useInfinitePage<T>({
  initialPage,
  loadPage,
  getKey,
  identity,
}: {
  initialPage: InfinitePage<T>;
  loadPage: (page: number) => Promise<InfinitePage<T>>;
  getKey: (item: T) => string;
  identity: string;
}): {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  loadingMore: boolean;
  loadMoreError: boolean;
  hasMore: boolean;
  totalCount: number;
  loadMore: () => Promise<void>;
} {
  const [state, setState] = useState(() => createState(initialPage, identity));
  const loadingSourceRef = useRef<object | null>(null);

  if (state.initialPage !== initialPage || state.identity !== identity) {
    setState(createState(initialPage, identity));
  }

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback((action) => {
    setState((current) => ({
      ...current,
      items:
        typeof action === "function"
          ? (action as (items: T[]) => T[])(current.items)
          : action,
    }));
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingSourceRef.current === state.source || !state.hasMore) return;

    const source = state.source;
    loadingSourceRef.current = source;
    setState((current) =>
      current.source === source
        ? { ...current, loadingMore: true, loadMoreError: false }
        : current,
    );

    try {
      const nextPage = await loadPage(state.currentPage + 1);
      setState((current) =>
        current.source === source
          ? {
              ...current,
              items: mergeItems(current.items, nextPage.items, getKey),
              currentPage: nextPage.currentPage,
              totalCount: nextPage.totalCount,
              hasMore: nextPage.hasMore,
            }
          : current,
      );
    } catch {
      setState((current) =>
        current.source === source
          ? { ...current, loadMoreError: true }
          : current,
      );
    } finally {
      if (loadingSourceRef.current === source) loadingSourceRef.current = null;
      setState((current) =>
        current.source === source
          ? { ...current, loadingMore: false }
          : current,
      );
    }
  }, [getKey, loadPage, state]);

  return {
    items: state.items,
    setItems,
    loadingMore: state.loadingMore,
    loadMoreError: state.loadMoreError,
    hasMore: state.hasMore,
    totalCount: state.totalCount,
    loadMore,
  };
}

interface InfinitePageState<T> {
  source: object;
  initialPage: InfinitePage<T>;
  identity: string;
  items: T[];
  currentPage: number;
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: boolean;
}

function createState<T>(
  initialPage: InfinitePage<T>,
  identity: string,
): InfinitePageState<T> {
  return {
    source: {},
    initialPage,
    identity,
    items: initialPage.items,
    currentPage: initialPage.currentPage,
    totalCount: initialPage.totalCount,
    hasMore: initialPage.hasMore,
    loadingMore: false,
    loadMoreError: false,
  };
}

function mergeItems<T>(
  current: readonly T[],
  incoming: readonly T[],
  getKey: (item: T) => string,
): T[] {
  const merged = new Map(current.map((item) => [getKey(item), item]));
  for (const item of incoming) merged.set(getKey(item), item);
  return [...merged.values()];
}
