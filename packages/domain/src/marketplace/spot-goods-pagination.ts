export type SpotGoodsPageMeta = {
  currentPage: number;
  pageSize: number;
  totalCount: number;
};

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
