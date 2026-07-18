import {
  listBuyerErrandOrders,
  listErrandTasks,
  listSpotOrders,
} from "@sast-shop/api";

import { OrdersView } from "@/components/orders-view";
import { getServerServiceOptions } from "@/lib/server-service-options";
import { getOrderFiltersFromParams } from "@/lib/order-filters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rawParams = await searchParams;
  const filters = getOrderFiltersFromParams(
    new URLSearchParams(
      Object.entries(rawParams).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    ),
  );
  const options = await getServerServiceOptions();
  const results = await Promise.allSettled([
    listSpotOrders({ ...options, perspective: "purchaser" }),
    listSpotOrders({ ...options, perspective: "seller" }),
    listBuyerErrandOrders(options),
    listErrandTasks(options),
  ]);
  const buyerSpotOrders =
    results[0].status === "fulfilled" ? results[0].value : [];
  const sellerSpotOrders =
    results[1].status === "fulfilled" ? results[1].value : [];

  return (
    <OrdersView
      initialFilters={filters}
      spotBuyerOrders={buyerSpotOrders}
      spotSellerOrders={sellerSpotOrders}
      buyerErrandOrders={
        results[2].status === "fulfilled" ? results[2].value : []
      }
      errandTasks={results[3].status === "fulfilled" ? results[3].value : []}
      errors={{
        spotBuyer: results[0].status === "rejected",
        spotSeller: results[1].status === "rejected",
        errandParticipant: results[2].status === "rejected",
        errandCaptain: results[3].status === "rejected",
      }}
    />
  );
}
