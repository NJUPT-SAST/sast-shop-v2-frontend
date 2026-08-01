import { FeatureUnavailableError } from "./errors";

export interface PageResult<T> {
  items: T[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;
}

interface CreatePageResultInput<T> {
  items: T[];
  currentPage: number;
  pageSize: number;
  totalCount: number;
  expectedPage: number;
  feature: string;
  hasMore?: boolean;
  maxItems?: number;
  validateOffset?: boolean;
}

export function createPageResult<T>({
  items,
  currentPage,
  pageSize,
  totalCount,
  expectedPage,
  feature,
  hasMore,
  maxItems = pageSize,
  validateOffset = true,
}: CreatePageResultInput<T>): PageResult<T> {
  if (
    !Number.isInteger(currentPage) ||
    currentPage !== expectedPage ||
    !Number.isInteger(pageSize) ||
    pageSize <= 0 ||
    !Number.isInteger(totalCount) ||
    totalCount < 0 ||
    items.length > maxItems ||
    (validateOffset &&
      items.length > 0 &&
      totalCount < (currentPage - 1) * pageSize + items.length)
  ) {
    throw new FeatureUnavailableError(`${feature}.pagination`);
  }

  return {
    items,
    currentPage,
    pageSize,
    totalCount,
    hasMore: hasMore ?? currentPage * pageSize < totalCount,
  };
}
