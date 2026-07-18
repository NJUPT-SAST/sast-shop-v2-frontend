export type SpotGoodsPageMeta = {
  currentPage: number;
  pageSize: number;
  totalCount: number;
};

export type SpotGoodsLoadTrigger = "manual" | "search" | "viewport";

export function mergeSpotGoodsPages<T extends { id: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) merged.set(item.id, item);
  return [...merged.values()];
}

export function hasMoreSpotGoods({
  currentPage,
  pageSize,
  totalCount,
}: SpotGoodsPageMeta): boolean {
  if (
    !Number.isInteger(currentPage) ||
    currentPage <= 0 ||
    !Number.isInteger(pageSize) ||
    pageSize <= 0 ||
    !Number.isInteger(totalCount) ||
    totalCount <= 0
  ) {
    return false;
  }

  return currentPage * pageSize < totalCount;
}

export function resolveNextSpotGoodsPage({
  loading,
  loadMoreError,
  trigger,
  query,
  ...page
}: SpotGoodsPageMeta & {
  loading: boolean;
  loadMoreError: boolean;
  trigger: SpotGoodsLoadTrigger;
  query: string;
}): number | null {
  if (loading || !hasMoreSpotGoods(page)) return null;
  if (trigger === "search" && (!query.trim() || loadMoreError)) return null;
  return page.currentPage + 1;
}
