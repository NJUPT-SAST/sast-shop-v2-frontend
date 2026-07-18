import {
  getSpotOrderDetail,
  listBuyerErrandOrders,
  listErrandTasks,
  listSpotOrders,
  type SpotOrder,
} from "@sast-shop/api"

import { OrdersView } from "@/components/orders-view"
import { getServerServiceOptions } from "@/lib/server-service-options"
import { getOrderFiltersFromParams } from "@/lib/order-filters"

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const rawParams = await searchParams
  const filters = getOrderFiltersFromParams(new URLSearchParams(
    Object.entries(rawParams).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  ))
  const options = await getServerServiceOptions()
  const results = await Promise.allSettled([
    listSpotOrders({ ...options, perspective: "purchaser" }),
    listSpotOrders({ ...options, perspective: "seller" }),
    listBuyerErrandOrders(options),
    listErrandTasks(options),
  ])
  const buyerSpotOrders =
    results[0].status === "fulfilled"
      ? await enrichPendingOrders(results[0].value, options)
      : []
  const sellerSpotOrders =
    results[1].status === "fulfilled"
      ? await enrichPendingOrders(results[1].value, options)
      : []

  return (
    <OrdersView
      initialFilters={filters}
      spotBuyerOrders={buyerSpotOrders}
      spotSellerOrders={sellerSpotOrders}
      buyerErrandOrders={results[2].status === "fulfilled" ? results[2].value : []}
      errandTasks={results[3].status === "fulfilled" ? results[3].value : []}
      errors={{
        spotBuyer: results[0].status === "rejected",
        spotSeller: results[1].status === "rejected",
        errandParticipant: results[2].status === "rejected",
        errandCaptain: results[3].status === "rejected",
      }}
    />
  )
}

async function enrichPendingOrders(
  orders: SpotOrder[],
  options: Awaited<ReturnType<typeof getServerServiceOptions>>,
) {
  return Promise.all(
    orders.map((order) =>
      order.status === "pending_payment"
        ? getSpotOrderDetail(order.id, options).catch(() => order)
        : order,
    ),
  )
}
