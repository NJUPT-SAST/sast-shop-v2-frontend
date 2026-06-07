// React Query hooks. Single source of fetch calls in the app — never call
// `api.*` from components directly, always go through a hook here. The hooks
// own the cache key shape, optimistic updates, and invalidation strategy.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "./client"
import { endpoints } from "./endpoints"
import type {
  ConfirmPaymentInput,
  ConfirmReceiptInput,
  CreateListingInput,
  CreateOrderInput,
  Listing,
  ListingsQuery,
  Order,
  OrdersQuery,
  Paginated,
  PayInput,
  PayResponse,
  PresignInput,
  PresignResponse,
  ReviewRequest,
  ReviewStatus,
  SetShippingFeeInput,
  ShipOrderInput,
  User,
  VoteResponse,
  VoteSelection,
} from "./types"

// ---- Query keys -------------------------------------------------------------

export const queryKeys = {
  authMe: ["auth", "me"] as const,
  listings: (params: ListingsQuery = {}) => ["listings", params] as const,
  listing: (id: string) => ["listings", id] as const,
  orders: (params: OrdersQuery = {}) => ["orders", params] as const,
  order: (id: string) => ["orders", id] as const,
  adminReviews: (status?: ReviewStatus) => ["admin", "reviews", status ?? "all"] as const,
  adminListings: (params?: Record<string, unknown>) => ["admin", "listings", params ?? {}] as const,
  adminOrders: (params?: Record<string, unknown>) => ["admin", "orders", params ?? {}] as const,
}

// ---- Auth -------------------------------------------------------------------

export function useAuthMe() {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: async () => {
      try {
        return await api.get<User>(endpoints.auth.me)
      } catch (err) {
        // 401 just means anonymous — surface as null instead of error.
        if (err instanceof Error && /401|UNAUTHORIZED/i.test(err.message)) {
          return null
        }
        throw err
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>(endpoints.auth.logout),
    onSuccess: () => {
      qc.setQueryData(queryKeys.authMe, null)
      qc.invalidateQueries()
    },
  })
}

// ---- Listings ---------------------------------------------------------------

export function useListings(params: ListingsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.listings(params),
    queryFn: () =>
      api.get<Paginated<Listing>>(endpoints.listings.list, {
        query: params as Record<string, string | number | boolean | undefined>,
      }),
  })
}

export function useListing(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.listing(id) : ["listings", "noop"],
    queryFn: () => api.get<Listing>(endpoints.listings.detail(id as string)),
    enabled: Boolean(id),
  })
}

export function useCreateListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListingInput) => api.post<Listing>(endpoints.listings.create, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] })
    },
  })
}

export function useUpdateListing(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<CreateListingInput>) =>
      api.put<Listing>(endpoints.listings.update(id), input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.listing(id), data)
      qc.invalidateQueries({ queryKey: ["listings"] })
    },
  })
}

export function useDeleteListing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del<void>(endpoints.listings.delete(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] })
    },
  })
}

// ---- Voting -----------------------------------------------------------------

export function useVote(listingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (selections: VoteSelection[]) =>
      api.post<VoteResponse>(endpoints.listings.vote(listingId), { selections }),
    onSuccess: (data) => {
      qc.setQueryData<Listing | undefined>(queryKeys.listing(listingId), (old) => {
        if (!old) return old
        return { ...old, current_votes: data.current_votes }
      })
      qc.invalidateQueries({ queryKey: queryKeys.listing(listingId) })
    },
  })
}

export function useUnvote(listingId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (variantId?: string) =>
      api.del<void>(
        endpoints.listings.vote(listingId),
        variantId ? { variant_id: variantId } : undefined
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.listing(listingId) })
    },
  })
}

// ---- Storage ----------------------------------------------------------------

export function usePresign() {
  return useMutation({
    mutationFn: (input: PresignInput) =>
      api.post<PresignResponse>(endpoints.storage.presign, input),
  })
}

// ---- Orders -----------------------------------------------------------------

export function useOrders(params: OrdersQuery = {}) {
  return useQuery({
    queryKey: queryKeys.orders(params),
    queryFn: () =>
      api.get<Paginated<Order>>(endpoints.orders.list, {
        query: params as Record<string, string | number | boolean | undefined>,
      }),
  })
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.order(id) : ["orders", "noop"],
    queryFn: () => api.get<Order>(endpoints.orders.detail(id as string)),
    enabled: Boolean(id),
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const order = query.state.data
      // Poll while waiting for backend confirmation of an external action.
      if (
        order &&
        (order.status === "pending_payment" ||
          order.status === "pending_confirm" ||
          order.shipping_status === "awaiting_payment")
      ) {
        return 5000
      }
      return false
    },
  })
}

export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateOrderInput) =>
      api.post<Order>(endpoints.orders.create, input, { idempotent: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] })
    },
  })
}

export function usePay(orderId: string) {
  return useMutation({
    mutationFn: (input: PayInput) => api.post<PayResponse>(endpoints.orders.pay(orderId), input),
  })
}

export function useConfirmReceipt(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConfirmReceiptInput) =>
      api.post<Order>(endpoints.orders.confirmReceipt(orderId), input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.order(orderId), data)
    },
  })
}

export function useConfirmPayment(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConfirmPaymentInput | undefined = {}) =>
      api.post<Order>(endpoints.orders.confirmPayment(orderId), input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.order(orderId), data)
    },
  })
}

export function useSetShippingFee(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetShippingFeeInput) =>
      api.post<Order>(endpoints.orders.setShippingFee(orderId), input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.order(orderId), data)
    },
  })
}

export function useConfirmShippingFee(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConfirmReceiptInput) =>
      api.post<Order>(endpoints.orders.confirmShippingFee(orderId), input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.order(orderId), data)
    },
  })
}

export function useShipOrder(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ShipOrderInput) => api.post<Order>(endpoints.orders.ship(orderId), input),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.order(orderId), data)
    },
  })
}

export function useCompleteOrder(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Order>(endpoints.orders.complete(orderId)),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.order(orderId), data)
    },
  })
}

// ---- Admin ------------------------------------------------------------------

export function useAdminReviews(status: ReviewStatus = "pending") {
  return useQuery({
    queryKey: queryKeys.adminReviews(status),
    queryFn: () =>
      api.get<Paginated<ReviewRequest>>(endpoints.admin.reviews, {
        query: { status },
      }),
  })
}

export function useApproveReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<ReviewRequest>(endpoints.admin.approve(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] })
    },
  })
}

export function useRejectReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<ReviewRequest>(endpoints.admin.reject(id), { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] })
    },
  })
}

export function useAdminListings(params: ListingsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminListings(params),
    queryFn: () =>
      api.get<Paginated<Listing>>(endpoints.admin.listings, {
        query: params as Record<string, string | number | boolean | undefined>,
      }),
  })
}

export function useAdminOrders(params: OrdersQuery = {}) {
  return useQuery({
    queryKey: queryKeys.adminOrders(params),
    queryFn: () =>
      api.get<Paginated<Order>>(endpoints.admin.orders, {
        query: params as Record<string, string | number | boolean | undefined>,
      }),
  })
}

export function useForceDelist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.del<void>(endpoints.admin.forceDelist(id), reason ? { reason } : undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "listings"] })
      qc.invalidateQueries({ queryKey: ["listings"] })
    },
  })
}

// ---- Bulk admin mutations --------------------------------------------------
//
// Backend has no bulk endpoint, so we fan out single-item calls and aggregate
// the result via Promise.allSettled. Callers receive { successCount, failed }.

export type BulkResult = {
  successCount: number
  failed: Array<{ id: string; error: unknown }>
}

async function fanOut<T>(
  ids: readonly string[],
  fn: (id: string) => Promise<T>
): Promise<BulkResult> {
  const settled = await Promise.allSettled(ids.map((id) => fn(id)))
  const failed: BulkResult["failed"] = []
  let successCount = 0
  settled.forEach((res, i) => {
    if (res.status === "fulfilled") successCount += 1
    else failed.push({ id: ids[i], error: res.reason })
  })
  return { successCount, failed }
}

export function useBulkForceDelist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, reason }: { ids: readonly string[]; reason?: string }) =>
      fanOut(ids, (id) =>
        api.del<void>(endpoints.admin.forceDelist(id), reason ? { reason } : undefined)
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "listings"] })
      qc.invalidateQueries({ queryKey: ["listings"] })
    },
  })
}

export function useBulkApproveReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: readonly string[]) =>
      fanOut(ids, (id) => api.post<ReviewRequest>(endpoints.admin.approve(id))),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] })
      qc.invalidateQueries({ queryKey: ["listings"] })
    },
  })
}

export function useBulkRejectReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, reason }: { ids: readonly string[]; reason: string }) =>
      fanOut(ids, (id) => api.post<ReviewRequest>(endpoints.admin.reject(id), { reason })),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] })
    },
  })
}
