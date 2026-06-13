import {
  listBuyerErrandOrders,
  listErrandTasks,
  listSpotOrders,
} from "@sast-shop/api"
import { OrdersView } from "@/components/orders-view"
import { mobileAppConfig } from "@/lib/app-config"
import { getOrderFiltersFromParams } from "@/lib/order-filters"

type OrdersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

async function getOrders() {
  const options = {
    dataSource: mobileAppConfig.dataSource,
    connectBaseUrl: mobileAppConfig.connectBaseUrl,
  }
  const [
    spotBuyerResult,
    spotSellerResult,
    buyerErrandResult,
    errandTaskResult,
  ] = await Promise.allSettled([
    listSpotOrders({ ...options, perspective: "purchaser" }),
    listSpotOrders({ ...options, perspective: "seller" }),
    listBuyerErrandOrders(options),
    listErrandTasks(options),
  ])

  return {
    spotBuyerOrders:
      spotBuyerResult.status === "fulfilled" ? spotBuyerResult.value : [],
    spotSellerOrders:
      spotSellerResult.status === "fulfilled" ? spotSellerResult.value : [],
    buyerErrandOrders:
      buyerErrandResult.status === "fulfilled" ? buyerErrandResult.value : [],
    errandTasks:
      errandTaskResult.status === "fulfilled" ? errandTaskResult.value : [],
    errors: {
      spotBuyer: spotBuyerResult.status === "rejected",
      spotSeller: spotSellerResult.status === "rejected",
      errandParticipant: buyerErrandResult.status === "rejected",
      errandCaptain: errandTaskResult.status === "rejected",
    },
  }
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const [result, params] = await Promise.all([
    getOrders(),
    searchParams ?? Promise.resolve({}),
  ])
  const initialFilters = getOrderFiltersFromParams(toURLSearchParams(params))

  return <OrdersView {...result} initialFilters={initialFilters} />
}

function toURLSearchParams(
  params: Record<string, string | string[] | undefined>
): URLSearchParams {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item))
      continue
    }

    if (value !== undefined) {
      search.set(key, value)
    }
  }

  return search
}
