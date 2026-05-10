// Cursor/page-based infinite query hooks. Backend already returns Paginated<T>
// with `has_more`, so we just walk page indices.

import { useInfiniteQuery } from "@tanstack/react-query"
import { api } from "./client"
import { endpoints } from "./endpoints"
import type {
  Listing,
  ListingsQuery,
  Order,
  OrdersQuery,
  Paginated,
  ReviewRequest,
  ReviewStatus,
} from "./types"

const DEFAULT_LIMIT = 20

function buildQuery(params: Record<string, unknown>, page: number, limit: number) {
  const out: Record<string, string | number | boolean> = { page, limit }
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    out[k] = v as string | number | boolean
  }
  return out
}

export function useInfiniteListings(
  params: Omit<ListingsQuery, "page" | "limit"> = {},
  limit = DEFAULT_LIMIT
) {
  return useInfiniteQuery({
    queryKey: ["listings", "infinite", params, limit] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<Listing>>(endpoints.listings.list, {
        query: buildQuery(params as Record<string, unknown>, pageParam as number, limit),
      }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
  })
}

export function useInfiniteOrders(
  params: Omit<OrdersQuery, "page" | "limit"> = {},
  limit = DEFAULT_LIMIT
) {
  return useInfiniteQuery({
    queryKey: ["orders", "infinite", params, limit] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<Order>>(endpoints.orders.list, {
        query: buildQuery(params as Record<string, unknown>, pageParam as number, limit),
      }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
  })
}

export function useInfiniteAdminListings(
  params: Record<string, unknown> = {},
  limit = DEFAULT_LIMIT
) {
  return useInfiniteQuery({
    queryKey: ["admin", "listings", "infinite", params, limit] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<Listing>>(endpoints.admin.listings, {
        query: buildQuery(params, pageParam as number, limit),
      }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
  })
}

export function useInfiniteAdminOrders(
  params: Record<string, unknown> = {},
  limit = DEFAULT_LIMIT
) {
  return useInfiniteQuery({
    queryKey: ["admin", "orders", "infinite", params, limit] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<Order>>(endpoints.admin.orders, {
        query: buildQuery(params, pageParam as number, limit),
      }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
  })
}

export function useInfiniteAdminReviews(status?: ReviewStatus, limit = DEFAULT_LIMIT) {
  return useInfiniteQuery({
    queryKey: ["admin", "reviews", "infinite", status ?? "all", limit] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<Paginated<ReviewRequest>>(endpoints.admin.reviews, {
        query: buildQuery({ status }, pageParam as number, limit),
      }),
    getNextPageParam: (lastPage) => (lastPage.has_more ? lastPage.page + 1 : undefined),
  })
}

// Flatten helper: chain pages.items into a single array.
export function flattenPages<T>(pages?: { items: T[] }[]): T[] {
  return pages ? pages.flatMap((p) => p.items) : []
}
